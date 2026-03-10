import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction } from '../../types';
import { formatCurrency, formatRelativeDate } from '../../utils/formatters';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';

interface Props {
  transaction: Transaction;
  onPress?: () => void;
}

export function TransactionItem({ transaction, onPress }: Props) {
  const isIncome = transaction.type === 'income';
  const color = isIncome ? Colors.income : Colors.expense;
  const catColor = transaction.category?.color ?? Colors.primary;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      {/* Icono categoría */}
      <View style={[styles.iconBox, { backgroundColor: catColor + '22' }]}>
        <Ionicons
          name={(transaction.category?.icon ?? 'ellipsis-horizontal') as any}
          size={20}
          color={catColor}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.description} numberOfLines={1}>
          {transaction.description || transaction.category?.name || '—'}
        </Text>
        <Text style={styles.meta}>
          {transaction.account?.name} · {formatRelativeDate(transaction.date)}
        </Text>
      </View>

      {/* Monto */}
      <Text style={[styles.amount, { color }]}>
        {isIncome ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  info: { flex: 1 },
  description: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  amount: { fontSize: FontSize.md, fontWeight: '700' },
});
