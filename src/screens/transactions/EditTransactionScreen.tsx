import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateTransaction, useDeleteTransaction } from '../../hooks/useTransactions';
import { useAccounts } from '../../hooks/useAccounts';
import { useCategories } from '../../hooks/useCategories';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { TransactionType } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';

type EditTransactionRouteProp = RouteProp<RootStackParamList, 'EditTransaction'>;

export function EditTransactionScreen() {
  const navigation = useNavigation();
  const route = useRoute<EditTransactionRouteProp>();
  const { transaction } = route.params;

  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [description, setDescription] = useState(transaction.description ?? '');
  const [selectedAccountId, setSelectedAccountId] = useState(transaction.account_id);
  const [selectedCategoryId, setSelectedCategoryId] = useState(transaction.category_id ?? '');
  const [date, setDate] = useState(transaction.date);

  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories(type === 'transfer' ? undefined : type);
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Ingresá un monto válido mayor a 0.');
      return;
    }
    if (!selectedAccountId) {
      Alert.alert('Error', 'Seleccioná una cuenta.');
      return;
    }

    updateTransaction(
      {
        id: transaction.id,
        input: {
          type,
          amount: parsedAmount,
          currency: transaction.currency ?? 'ARS',
          description: description.trim() || undefined,
          account_id: selectedAccountId,
          category_id: selectedCategoryId || null,
          date,
        },
      },
      {
        onSuccess: () => {
          Alert.alert('Listo', 'Movimiento actualizado correctamente.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        },
        onError: (e: any) => {
          Alert.alert('Error', e.message ?? 'No se pudo actualizar el movimiento.');
        },
      }
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar movimiento',
      '¿Estás seguro de eliminar este movimiento? El saldo de la cuenta se revertirá automáticamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            deleteTransaction(transaction.id, {
              onSuccess: () => {
                navigation.goBack();
              },
              onError: (e: any) => {
                Alert.alert('Error', e.message ?? 'No se pudo eliminar el movimiento.');
              },
            });
          },
        },
      ]
    );
  };

  const TypeButton = ({ t, label }: { t: TransactionType; label: string }) => (
    <TouchableOpacity
      style={[
        styles.typeBtn,
        type === t && (t === 'income' ? styles.typeBtnIncome : styles.typeBtnExpense),
      ]}
      onPress={() => {
        setType(t);
        setSelectedCategoryId('');
      }}
    >
      <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={28} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.title}>Editar movimiento</Text>
            <TouchableOpacity onPress={handleDelete} disabled={isDeleting}>
              <Ionicons name="trash-outline" size={24} color={Colors.error} />
            </TouchableOpacity>
          </View>

          {/* Selector de Tipo */}
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

          {/* Fecha */}
          <Input
            label="Fecha (AAAA-MM-DD)"
            placeholder="2026-10-20"
            value={date}
            onChangeText={setDate}
            icon="calendar-outline"
          />

          {/* Descripción */}
          <Input
            label="Descripción (opcional)"
            placeholder="Ej: Supermercado"
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
                <Text
                  style={[
                    styles.chipText,
                    selectedAccountId === acc.id && styles.chipTextActive,
                  ]}
                >
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
                style={[
                  styles.catItem,
                  selectedCategoryId === cat.id && styles.catItemActive,
                ]}
                onPress={() => setSelectedCategoryId(cat.id)}
              >
                <Text style={styles.catIcon}>{cat.icon ?? '•'}</Text>
                <Text
                  style={[
                    styles.catText,
                    selectedCategoryId === cat.id && styles.catTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Botones de acción */}
          <Button
            title="Guardar cambios"
            onPress={handleSave}
            loading={isUpdating}
            style={styles.saveBtn}
          />

          <TouchableOpacity
            style={styles.deleteLink}
            onPress={handleDelete}
            disabled={isDeleting}
          >
            <Text style={styles.deleteLinkText}>Eliminar este movimiento</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  typeBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  typeBtnIncome: { backgroundColor: Colors.income + '20', borderColor: Colors.income },
  typeBtnExpense: { backgroundColor: Colors.expense + '20', borderColor: Colors.expense },
  typeBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  typeBtnTextActive: { color: Colors.text },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  chipsScroll: { marginBottom: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  chipTextActive: { color: Colors.primary },
  noData: { color: Colors.textMuted, fontSize: FontSize.sm, padding: Spacing.sm },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catItemActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  catIcon: { fontSize: 16 },
  catText: { color: Colors.textSecondary, fontSize: FontSize.sm },
  catTextActive: { color: Colors.primary, fontWeight: '600' },
  saveBtn: { marginTop: Spacing.md },
  deleteLink: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  deleteLinkText: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
