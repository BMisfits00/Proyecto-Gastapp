import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, LineChart } from 'react-native-chart-kit';
import { useMonthlyTransactions, useLast6MonthsTransactions } from '../../hooks/useTransactions';
import { useMetrics, useMonthlyChartData } from '../../hooks/useMetrics';
import { formatCurrency } from '../../utils/formatters';
import { Card } from '../../components/common/Card';
import { Colors, FontSize, Spacing } from '../../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

const CHART_CONFIG = {
  backgroundColor: Colors.card,
  backgroundGradientFrom: Colors.card,
  backgroundGradientTo: Colors.card,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(123,104,238,${opacity})`,
  labelColor: () => Colors.textSecondary,
  propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primary },
};

export function ReportsScreen() {
  const { data: monthlyTx, isLoading } = useMonthlyTransactions();
  const { data: allTx } = useLast6MonthsTransactions();
  const metrics = useMetrics(monthlyTx);
  const chartData = useMonthlyChartData(allTx);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  // Pie chart data para categorías
  const pieData = metrics.expensesByCategory.slice(0, 6).map((c) => ({
    name: c.category_name,
    population: c.total,
    color: c.category_color,
    legendFontColor: Colors.textSecondary,
    legendFontSize: 12,
  }));

  // Line chart para evolución
  const lineData = {
    labels: chartData.map((d) => d.label),
    datasets: [
      {
        data: chartData.map((d) => d.income || 0),
        color: () => Colors.income,
        strokeWidth: 2,
      },
      {
        data: chartData.map((d) => d.expenses || 0),
        color: () => Colors.expense,
        strokeWidth: 2,
      },
    ],
    legend: ['Ingresos', 'Gastos'],
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Reportes</Text>
        <Text style={styles.subtitle}>
          {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
        </Text>

        {/* Resumen del mes */}
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={[styles.summaryValue, { color: Colors.income }]}>
              {formatCurrency(metrics.monthlyIncome)}
            </Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Gastos</Text>
            <Text style={[styles.summaryValue, { color: Colors.expense }]}>
              {formatCurrency(metrics.monthlyExpenses)}
            </Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Ahorro</Text>
            <Text style={[styles.summaryValue, { color: metrics.netSavings >= 0 ? Colors.income : Colors.expense }]}>
              {formatCurrency(metrics.netSavings)}
            </Text>
          </Card>
        </View>

        {/* Tasa de ahorro */}
        <Card style={styles.savingsCard}>
          <View style={styles.savingsHeader}>
            <Text style={styles.sectionTitle}>Tasa de ahorro</Text>
            <Text style={[styles.savingsPercent, { color: metrics.savingsRate >= 20 ? Colors.income : Colors.warning }]}>
              {metrics.savingsRate}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, {
                width: `${Math.min(metrics.savingsRate, 100)}%`,
                backgroundColor: metrics.savingsRate >= 20 ? Colors.income : Colors.warning,
              }]}
            />
          </View>
          <Text style={styles.savingsHint}>
            {metrics.savingsRate >= 30
              ? 'Excelente ahorro'
              : metrics.savingsRate >= 20
              ? 'Buen ritmo de ahorro'
              : metrics.savingsRate >= 10
              ? 'Podés mejorar un poco'
              : 'Atención: ahorro bajo'}
          </Text>
        </Card>

        {/* Gastos por categoría */}
        {pieData.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Gastos por categoría</Text>
            <Card>
              <PieChart
                data={pieData}
                width={SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2}
                height={180}
                chartConfig={CHART_CONFIG}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="10"
                absolute={false}
              />
            </Card>

            {/* Lista detallada */}
            <View style={styles.categoryList}>
              {metrics.expensesByCategory.map((cat) => (
                <View key={cat.category_id} style={styles.categoryRow}>
                  <View style={[styles.categoryDot, { backgroundColor: cat.category_color }]} />
                  <Text style={styles.categoryName}>{cat.category_name}</Text>
                  <Text style={styles.categoryPct}>{cat.percentage}%</Text>
                  <Text style={styles.categoryAmount}>{formatCurrency(cat.total)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Evolución mensual */}
        {chartData.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>Evolución 6 meses</Text>
            <Card>
              <LineChart
                data={lineData}
                width={SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2}
                height={200}
                chartConfig={CHART_CONFIG}
                bezier
                style={{ borderRadius: 12 }}
                fromZero
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800', marginTop: Spacing.md },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginBottom: Spacing.lg, textTransform: 'capitalize' },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginVertical: Spacing.md },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: Colors.textSecondary, fontSize: FontSize.xs, marginBottom: 4 },
  summaryValue: { fontSize: FontSize.sm, fontWeight: '700' },
  savingsCard: { marginBottom: Spacing.sm },
  savingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  savingsPercent: { fontSize: FontSize.xxl, fontWeight: '800' },
  progressBar: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  savingsHint: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.sm },
  categoryList: { marginTop: Spacing.sm },
  categoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  categoryDot: { width: 10, height: 10, borderRadius: 5 },
  categoryName: { flex: 1, color: Colors.textSecondary, fontSize: FontSize.sm },
  categoryPct: { color: Colors.textMuted, fontSize: FontSize.xs, width: 36, textAlign: 'right' },
  categoryAmount: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', width: 80, textAlign: 'right' },
});
