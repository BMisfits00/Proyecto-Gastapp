import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCreateTransaction } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { TransactionType } from '../../types';
import { todayISO } from '../../utils/formatters';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';

export function AddTransactionScreen() {
  const navigation = useNavigation();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [date] = useState(todayISO());

  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories(type === 'transfer' ? undefined : type);
  const { mutate: createTransaction, isPending } = useCreateTransaction();

  const handleSubmit = () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Ingresá un monto válido.');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('Error', 'Seleccioná una cuenta.');
      return;
    }

    createTransaction(
      {
        type,
        amount: parseFloat(amount),
        currency: 'ARS',
        description,
        account_id: selectedAccountId,
        category_id: selectedCategoryId || null,
        date,
      },
      {
        onSuccess: () => {
          Alert.alert('Listo', 'Movimiento registrado.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        },
        onError: (e: any) => {
          Alert.alert('Error', e.message ?? 'No se pudo guardar el movimiento.');
        },
      }
    );
  };

  const TypeButton = ({ t, label }: { t: TransactionType; label: string }) => (
    <TouchableOpacity
      style={[styles.typeBtn, type === t && (t === 'income' ? styles.typeBtnIncome : styles.typeBtnExpense)]}
      onPress={() => { setType(t); setSelectedCategoryId(''); }}
    >
      <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={28} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.title}>Nuevo movimiento</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Tipo */}
          <View style={styles.typeRow}>
            <TypeButton t="expense" label="Gasto" />
            <TypeButton t="income" label="Ingreso" />
          </View>

          {/* Monto */}
          <Input
            label="Monto"
            placeholder="0"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            icon="cash-outline"
          />

          {/* Descripción */}
          <Input
            label="Descripción (opcional)"
            placeholder="Ej: Almuerzo con amigos"
            value={description}
            onChangeText={setDescription}
            icon="create-outline"
          />

          {/* Cuenta */}
          <Text style={styles.label}>Cuenta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {accounts?.map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={[styles.chip, selectedAccountId === acc.id && styles.chipActive]}
                onPress={() => setSelectedAccountId(acc.id)}
              >
                <View style={[styles.chipDot, { backgroundColor: acc.color ?? Colors.primary }]} />
                <Text style={[styles.chipText, selectedAccountId === acc.id && styles.chipTextActive]}>
                  {acc.name}
                </Text>
              </TouchableOpacity>
            ))}
            {(!accounts || accounts.length === 0) && (
              <Text style={styles.noData}>Sin cuentas creadas</Text>
            )}
          </ScrollView>

          {/* Categoría */}
          <Text style={[styles.label, { marginTop: Spacing.md }]}>Categoría</Text>
          <View style={styles.categoriesGrid}>
            {categories?.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catItem, selectedCategoryId === cat.id && styles.catItemActive]}
                onPress={() => setSelectedCategoryId(cat.id)}
              >
                <Text style={styles.catIcon}>{cat.icon ?? '•'}</Text>
                <Text style={[styles.catText, selectedCategoryId === cat.id && styles.catTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Guardar movimiento"
            onPress={handleSubmit}
            loading={isPending}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md, marginBottom: Spacing.md,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  typeBtnIncome: { backgroundColor: Colors.income + '20', borderColor: Colors.income },
  typeBtnExpense: { backgroundColor: Colors.expense + '20', borderColor: Colors.expense },
  typeBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  typeBtnTextActive: { color: Colors.text },
  label: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.sm },
  chipsScroll: { marginBottom: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  chipTextActive: { color: Colors.primary },
  noData: { color: Colors.textMuted, fontSize: FontSize.sm, padding: Spacing.sm },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  catItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md, backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  catItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  catIcon: { fontSize: 16 },
  catText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  catTextActive: { color: Colors.primary, fontWeight: '600' },
  saveBtn: { marginTop: Spacing.md },
});
