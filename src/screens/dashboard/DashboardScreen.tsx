import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { useAuthContext } from '../../contexts/AuthContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useMonthlyTransactions, useLast6MonthsTransactions } from '../../hooks/useTransactions';
import { useMetrics, useMonthlyChartData } from '../../hooks/useMetrics';
import { accountService } from '../../services/accountService';
import { BalanceCard } from '../../components/dashboard/BalanceCard';
import { MetricCard } from '../../components/dashboard/MetricCard';
import { TransactionItem } from '../../components/transactions/TransactionItem';
import { formatCurrency } from '../../utils/formatters';
import { Colors, FontSize, Spacing } from '../../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

export function DashboardScreen() {
  const { user } = useAuthContext();
  const { data: accounts, refetch: refetchAccounts } = useAccounts();
  const { data: monthlyTx, isLoading, refetch: refetchMonthly } = useMonthlyTransactions();
  const { data: allTx, refetch: refetchAll } = useLast6MonthsTransactions();

  const metrics = useMetrics(monthlyTx);
  const chartData = useMonthlyChartData(allTx);
  const totalBalance = accountService.getTotalBalance(accounts ?? []);

  const refetch = () => {
    refetchAccounts();
    refetchMonthly();
    refetchAll();
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const barData = {
    labels: chartData.map((d) => d.label),
    datasets: [
      { data: chartData.map((d) => d.income), color: () => Colors.income },
      { data: chartData.map((d) => d.expenses), color: () => Colors.expense },
    ],
    legend: ['Ingresos', 'Gastos'],
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Saludo */}
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>Hola, {user?.user_metadata?.full_name?.split(' ')[0] ?? 'usuario'} 👋</Text>
          <Text style={styles.monthLabel}>
            {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </Text>
        </View>

        {/* Balance card */}
        <BalanceCard
          totalBalance={totalBalance}
          monthlyIncome={metrics.monthlyIncome}
          monthlyExpenses={metrics.monthlyExpenses}
        />

        {/* Métricas de salud */}
        <Text style={styles.sectionTitle}>Salud financiera</Text>
        <View style={styles.metricsRow}>
          <MetricCard
            label="Tasa de ahorro"
            value={`${metrics.savingsRate}%`}
            icon="trending-up-outline"
            color={metrics.savingsRate >= 20 ? Colors.income : Colors.warning}
            subtitle={metrics.savingsRate >= 20 ? 'Buen ritmo' : 'Mejorable'}
          />
          <View style={{ width: Spacing.sm }} />
          <MetricCard
            label="Gasto en ocio"
            value={`${metrics.leisureRatio}%`}
            icon="game-controller-outline"
            color={metrics.leisureRatio <= 15 ? Colors.income : Colors.warning}
          />
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            label="Ahorro neto"
            value={formatCurrency(metrics.netSavings)}
            icon="save-outline"
            color={metrics.netSavings >= 0 ? Colors.income : Colors.expense}
          />
          <View style={{ width: Spacing.sm }} />
          <MetricCard
            label="Cuentas activas"
            value={`${accounts?.length ?? 0}`}
            icon="wallet-outline"
            color={Colors.primary}
          />
        </View>

        {/* Gráfico evolución */}
        {chartData.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Evolución mensual</Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={barData}
                width={SCREEN_WIDTH - Spacing.lg * 2}
                height={180}
                yAxisLabel="$"
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: Colors.card,
                  backgroundGradientFrom: Colors.card,
                  backgroundGradientTo: Colors.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(123,104,238,${opacity})`,
                  labelColor: () => Colors.textSecondary,
                  barPercentage: 0.5,
                }}
                style={{ borderRadius: 12 }}
                showValuesOnTopOfBars={false}
                fromZero
              />
            </View>
          </>
        )}

        {/* Últimas transacciones */}
        <Text style={styles.sectionTitle}>Últimos movimientos</Text>
        {monthlyTx?.slice(0, 5).map((tx) => (
          <TransactionItem key={tx.id} transaction={tx} />
        ))}
        {(!monthlyTx || monthlyTx.length === 0) && (
          <Text style={styles.empty}>Sin movimientos este mes</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  greeting: { paddingTop: Spacing.md, marginBottom: Spacing.md },
  greetingText: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  monthLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2, textTransform: 'capitalize' },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md, marginTop: Spacing.lg },
  metricsRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  chartContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: Spacing.sm },
  empty: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.xl },
});
