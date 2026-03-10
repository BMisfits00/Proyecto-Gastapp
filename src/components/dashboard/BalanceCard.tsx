import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../../utils/formatters';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';

interface Props {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  currency?: string;
}

export function BalanceCard({ totalBalance, monthlyIncome, monthlyExpenses, currency = 'ARS' }: Props) {
  return (
    <LinearGradient
      colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.label}>Balance total</Text>
      <Text style={styles.balance}>{formatCurrency(totalBalance, currency)}</Text>

      <View style={styles.row}>
        <View style={styles.stat}>
          <View style={styles.statIcon}>
            <Ionicons name="arrow-down-outline" size={14} color={Colors.income} />
          </View>
          <View>
            <Text style={styles.statLabel}>Ingresos</Text>
            <Text style={styles.statValue}>{formatCurrency(monthlyIncome, currency)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: Colors.expense + '22' }]}>
            <Ionicons name="arrow-up-outline" size={14} color={Colors.expense} />
          </View>
          <View>
            <Text style={styles.statLabel}>Gastos</Text>
            <Text style={[styles.statValue, { color: Colors.expense }]}>
              {formatCurrency(monthlyExpenses, currency)}
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  label: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.sm, marginBottom: Spacing.xs },
  balance: { color: Colors.text, fontSize: FontSize.xxxl, fontWeight: '800', marginBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.income + '22',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: { color: 'rgba(255,255,255,0.65)', fontSize: FontSize.xs },
  statValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  divider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: Spacing.md },
});
