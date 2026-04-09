import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAccounts, useCreateAccount, useDeleteAccount } from '../../hooks/useAccounts';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { accountService } from '../../services/accountService';
import { Colors, FontSize, Spacing, BorderRadius, AccountColors } from '../../constants/colors';
import { AppTabParamList, RootStackParamList } from '../../navigation/types';

const PROVIDERS = ['Mercado Pago', 'Ualá', 'Brubank', 'Lemon', 'Personal Pay', 'Banco Nación', 'Santander', 'Galicia', 'Efectivo'];
const ACCOUNT_TYPES: { type: AccountType; label: string; icon: string }[] = [
  { type: 'bank', label: 'Banco', icon: 'business-outline' },
  { type: 'virtual_wallet', label: 'Billetera virtual', icon: 'phone-portrait-outline' },
  { type: 'cash', label: 'Efectivo', icon: 'cash-outline' },
];

export function AccountsScreen() {
  const tabNav = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const stackNav = tabNav.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const { data: accounts, refetch } = useAccounts();
  const { mutate: createAccount, isPending } = useCreateAccount();
  const { mutate: deleteAccount } = useDeleteAccount();
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [provider, setProvider] = useState('');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState(AccountColors[0]);
  const [hasDailyYield, setHasDailyYield] = useState(false);
  const [yieldRate, setYieldRate] = useState('');

  const totalBalance = accountService.getTotalBalance(accounts ?? []);

  const resetForm = () => {
    setName(''); setType('bank'); setProvider(''); setBalance('');
    setColor(AccountColors[0]); setHasDailyYield(false); setYieldRate('');
  };

  const handleCreate = () => {
    if (!name.trim()) { Alert.alert('Error', 'Ingresá un nombre para la cuenta.'); return; }

    createAccount(
      {
        name: name.trim(),
        type,
        provider,
        balance: parseFloat(balance) || 0,
        currency: 'ARS',
        color,
        has_daily_yield: hasDailyYield,
        daily_yield_rate: parseFloat(yieldRate) || 0,
      },
      {
        onSuccess: () => { setShowModal(false); resetForm(); },
        onError: (e: any) => Alert.alert('Error', e.message),
      }
    );
  };

  const handleDelete = (account: Account) => {
    Alert.alert(
      'Eliminar cuenta',
      `¿Querés eliminar "${account.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteAccount(account.id) },
      ]
    );
  };

  const typeIcon = (t: AccountType) => ACCOUNT_TYPES.find((a) => a.type === t)?.icon ?? 'wallet-outline';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Cuentas</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
            <Ionicons name="add" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Balance total */}
        <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.totalCard}>
          <Text style={styles.totalLabel}>Balance total</Text>
          <Text style={styles.totalValue}>{formatCurrency(totalBalance)}</Text>
          <Text style={styles.totalSub}>{accounts?.length ?? 0} cuentas activas</Text>
        </LinearGradient>

        {/* Lista de cuentas */}
        {accounts?.map((acc) => (
          <TouchableOpacity
            key={acc.id}
            style={styles.accountCard}
            onPress={() => stackNav?.navigate('AccountDetail', { accountId: acc.id, accountName: acc.name })}
            activeOpacity={0.75}
          >
            <View style={[styles.accountIcon, { backgroundColor: (acc.color ?? Colors.primary) + '25' }]}>
              <Ionicons name={typeIcon(acc.type) as any} size={24} color={acc.color ?? Colors.primary} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{acc.name}</Text>
              <Text style={styles.accountProvider}>
                {acc.provider || ACCOUNT_TYPES.find((t) => t.type === acc.type)?.label}
                {acc.has_daily_yield && ` · ${(acc.daily_yield_rate * 100).toFixed(2)}% diario`}
              </Text>
            </View>
            <View style={styles.accountRight}>
              <Text style={styles.accountBalance}>{formatCurrency(acc.balance, acc.currency)}</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: 4 }}>
                <TouchableOpacity onPress={() => handleDelete(acc)} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {(!accounts || accounts.length === 0) && (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={56} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin cuentas</Text>
            <Text style={styles.emptyText}>Agregá tu primera cuenta para empezar</Text>
            <Button title="Agregar cuenta" onPress={() => setShowModal(true)} style={{ marginTop: Spacing.md }} />
          </View>
        )}
      </ScrollView>

      {/* Modal crear cuenta */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva cuenta</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Ionicons name="close" size={28} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Input label="Nombre" placeholder="Ej: Mi Mercado Pago" value={name} onChangeText={setName} icon="wallet-outline" />

            {/* Tipo de cuenta */}
            <Text style={styles.modalLabel}>Tipo de cuenta</Text>
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.type}
                  style={[styles.typeChip, type === t.type && styles.typeChipActive]}
                  onPress={() => setType(t.type)}
                >
                  <Ionicons name={t.icon as any} size={16} color={type === t.type ? Colors.text : Colors.textMuted} />
                  <Text style={[styles.typeChipText, type === t.type && styles.typeChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Proveedor */}
            <Text style={styles.modalLabel}>Proveedor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {PROVIDERS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.providerChip, provider === p && styles.providerChipActive]}
                  onPress={() => setProvider(p)}
                >
                  <Text style={[styles.providerText, provider === p && styles.providerTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Saldo inicial"
              placeholder="0"
              value={balance}
              onChangeText={setBalance}
              keyboardType="decimal-pad"
              icon="cash-outline"
            />

            {/* Color */}
            <Text style={styles.modalLabel}>Color</Text>
            <View style={styles.colorsRow}>
              {AccountColors.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                  onPress={() => setColor(c)}
                />
              ))}
            </View>

            {/* Rendimiento diario */}
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setHasDailyYield((v) => !v)}
            >
              <View>
                <Text style={styles.toggleLabel}>Rendimiento diario</Text>
                <Text style={styles.toggleSub}>Para billeteras con intereses (Ej: Mercado Fondo)</Text>
              </View>
              <View style={[styles.toggle, hasDailyYield && styles.toggleActive]}>
                <View style={[styles.toggleThumb, hasDailyYield && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            {hasDailyYield && (
              <Input
                label="Tasa diaria (%)"
                placeholder="Ej: 0.09"
                value={yieldRate}
                onChangeText={setYieldRate}
                keyboardType="decimal-pad"
                icon="trending-up-outline"
              />
            )}

            <Button title="Crear cuenta" onPress={handleCreate} loading={isPending} style={{ marginTop: Spacing.md }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800' },
  addBtn: { width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  totalCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg },
  totalLabel: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.sm },
  totalValue: { color: Colors.text, fontSize: FontSize.xxxl, fontWeight: '800', marginVertical: Spacing.xs },
  totalSub: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.sm },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  accountIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  accountInfo: { flex: 1 },
  accountName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  accountProvider: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  accountRight: { alignItems: 'flex-end' },
  accountBalance: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  deleteBtn: { padding: Spacing.xs, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', marginTop: Spacing.md },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: Spacing.xs, textAlign: 'center' },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.background },
  modalScroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  modalTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  modalLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.sm },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeChipText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '500' },
  typeChipTextActive: { color: Colors.text },
  providerChip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm },
  providerChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  providerText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  providerTextActive: { color: Colors.primary },
  colorsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  colorDot: { width: 32, height: 32, borderRadius: BorderRadius.full },
  colorDotActive: { borderWidth: 3, borderColor: Colors.text },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  toggleLabel: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  toggleSub: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2, maxWidth: '80%' },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.border, padding: 2, justifyContent: 'center' },
  toggleActive: { backgroundColor: Colors.primary },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.textMuted },
  toggleThumbActive: { backgroundColor: Colors.text, alignSelf: 'flex-end' },
});
