import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAccounts } from '../../hooks/useAccounts';
import {
  useAccountTransactions,
  useAccountCreditCard,
  useCardMovements,
  useAccountInvestments,
} from '../../hooks/useAccountDetail';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';
import { formatCurrency, formatDate, formatRelativeDate } from '../../utils/formatters';
import { Transaction, CardMovement, Investment } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountDetail'>;

type Tab = 'income' | 'expense' | 'card' | 'investments';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'income',      label: 'Ingresos',    icon: 'arrow-down-circle-outline' },
  { key: 'expense',     label: 'Gastos',       icon: 'arrow-up-circle-outline' },
  { key: 'card',        label: 'Tarjeta',      icon: 'card-outline' },
  { key: 'investments', label: 'Inversiones',  icon: 'trending-up-outline' },
];

export function AccountDetailScreen({ route, navigation }: Props) {
  const { accountId, accountName } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('income');

  const { data: accounts } = useAccounts();
  const account = accounts?.find((a) => a.id === accountId);

  const incomeQuery    = useAccountTransactions(accountId, 'income');
  const expenseQuery   = useAccountTransactions(accountId, 'expense');
  const cardQuery      = useAccountCreditCard(accountId);
  const movementsQuery = useCardMovements(cardQuery.data?.id);
  const investQuery    = useAccountInvestments(accountId);

  const isLoading =
    (activeTab === 'income'      && incomeQuery.isLoading) ||
    (activeTab === 'expense'     && expenseQuery.isLoading) ||
    (activeTab === 'card'        && (cardQuery.isLoading || movementsQuery.isLoading)) ||
    (activeTab === 'investments' && investQuery.isLoading);

  const handleRefresh = () => {
    incomeQuery.refetch();
    expenseQuery.refetch();
    cardQuery.refetch();
    movementsQuery.refetch();
    investQuery.refetch();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{accountName}</Text>
          {account && (
            <Text style={styles.headerBalance}>{formatCurrency(account.balance, account.currency)}</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={15}
              color={activeTab === tab.key ? Colors.text : Colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        >
          {activeTab === 'income'      && <IncomeTab transactions={incomeQuery.data ?? []} />}
          {activeTab === 'expense'     && <ExpenseTab transactions={expenseQuery.data ?? []} />}
          {activeTab === 'card'        && <CardTab card={cardQuery.data ?? null} movements={movementsQuery.data ?? []} />}
          {activeTab === 'investments' && <InvestmentsTab investments={investQuery.data ?? []} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Tab: Ingresos ────────────────────────────────────────────────────────────

function IncomeTab({ transactions }: { transactions: Transaction[] }) {
  const total = transactions.reduce((s, t) => s + t.amount, 0);

  const byCategory = transactions.reduce<Record<string, { name: string; color: string; total: number }>>((acc, t) => {
    const id = t.category?.id ?? 'sin-categoria';
    if (!acc[id]) acc[id] = { name: t.category?.name ?? 'Sin categoría', color: t.category?.color ?? Colors.textMuted, total: 0 };
    acc[id].total += t.amount;
    return acc;
  }, {});

  return (
    <>
      <SummaryCard amount={total} label="Total ingresos" color={Colors.income} icon="arrow-down-circle" />
      <CategoryBreakdown items={Object.values(byCategory)} total={total} />
      <SectionTitle title="Movimientos" />
      {transactions.length === 0 && <EmptyState text="Sin ingresos registrados" />}
      {transactions.map((t) => <TransactionRow key={t.id} transaction={t} />)}
    </>
  );
}

// ─── Tab: Gastos ──────────────────────────────────────────────────────────────

function ExpenseTab({ transactions }: { transactions: Transaction[] }) {
  const total = transactions.reduce((s, t) => s + t.amount, 0);

  const byCategory = transactions.reduce<Record<string, { name: string; color: string; total: number }>>((acc, t) => {
    const id = t.category?.id ?? 'sin-categoria';
    if (!acc[id]) acc[id] = { name: t.category?.name ?? 'Sin categoría', color: t.category?.color ?? Colors.textMuted, total: 0 };
    acc[id].total += t.amount;
    return acc;
  }, {});

  return (
    <>
      <SummaryCard amount={total} label="Total gastos" color={Colors.expense} icon="arrow-up-circle" />
      <CategoryBreakdown items={Object.values(byCategory)} total={total} />
      <SectionTitle title="Movimientos" />
      {transactions.length === 0 && <EmptyState text="Sin gastos registrados" />}
      {transactions.map((t) => <TransactionRow key={t.id} transaction={t} />)}
    </>
  );
}

// ─── Tab: Tarjeta ─────────────────────────────────────────────────────────────

function CardTab({ card, movements }: { card: any | null; movements: CardMovement[] }) {
  if (!card) {
    return <EmptyState text="No hay tarjeta de crédito asociada a esta cuenta" icon="card-outline" />;
  }

  const totalARS = movements.filter((m) => m.currency === 'ARS').reduce((s, m) => s + m.amount, 0);
  const totalUSD = movements.filter((m) => m.currency === 'USD').reduce((s, m) => s + m.amount, 0);

  return (
    <>
      {/* Resumen de tarjeta */}
      <View style={styles.cardSummary}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardBrand}>{card.brand} {card.product}</Text>
            <Text style={styles.cardDigits}>•••• {card.last_digits}</Text>
          </View>
          <Ionicons name="card" size={32} color={Colors.primary} />
        </View>

        <View style={styles.cardGrid}>
          <CardStat label="Consumo ARS" value={formatCurrency(card.consumption_ars)} />
          <CardStat label="Consumo USD" value={`USD ${card.consumption_usd?.toFixed(2)}`} />
          <CardStat label="Pago mínimo" value={formatCurrency(card.min_payment)} />
          <CardStat label="Disponible ARS" value={formatCurrency(card.available_ars)} />
        </View>

        <View style={styles.cardDates}>
          <Text style={styles.cardDateText}>
            <Text style={styles.cardDateLabel}>Cierre: </Text>{card.closing_date}
          </Text>
          <Text style={styles.cardDateText}>
            <Text style={styles.cardDateLabel}>Vencimiento: </Text>
            {card.due_date ? formatDate(card.due_date) : '—'}
          </Text>
        </View>
      </View>

      {/* Totales del período */}
      <View style={styles.cardTotals}>
        <View style={styles.cardTotalItem}>
          <Text style={styles.cardTotalLabel}>ARS este período</Text>
          <Text style={styles.cardTotalValue}>{formatCurrency(totalARS)}</Text>
        </View>
        <View style={[styles.cardTotalItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
          <Text style={styles.cardTotalLabel}>USD este período</Text>
          <Text style={styles.cardTotalValue}>USD {totalUSD.toFixed(2)}</Text>
        </View>
      </View>

      <SectionTitle title={`Consumos (${movements.length})`} />
      {movements.length === 0 && <EmptyState text="Sin consumos registrados" />}
      {movements.map((m) => <CardMovementRow key={m.id} movement={m} />)}
    </>
  );
}

// ─── Tab: Inversiones ─────────────────────────────────────────────────────────

function InvestmentsTab({ investments }: { investments: Investment[] }) {
  const totalCapital = investments.reduce((s, i) => s + i.initial_amount, 0);
  const totalGain    = investments.reduce((s, i) => s + (i.gain_amount ?? 0), 0);

  return (
    <>
      <View style={styles.investSummary}>
        <View style={styles.investSummaryItem}>
          <Text style={styles.investSummaryLabel}>Capital invertido</Text>
          <Text style={styles.investSummaryValue}>{formatCurrency(totalCapital)}</Text>
        </View>
        <View style={[styles.investSummaryItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
          <Text style={styles.investSummaryLabel}>Ganancia estimada</Text>
          <Text style={[styles.investSummaryValue, { color: Colors.income }]}>{formatCurrency(totalGain)}</Text>
        </View>
      </View>

      <SectionTitle title={`Plazos fijos (${investments.length})`} />
      {investments.length === 0 && <EmptyState text="Sin inversiones registradas" icon="trending-up-outline" />}
      {investments.map((inv) => <InvestmentRow key={inv.id} investment={inv} />)}
    </>
  );
}

// ─── Componentes compartidos ──────────────────────────────────────────────────

function SummaryCard({ amount, label, color, icon }: { amount: number; label: string; color: string; icon: string }) {
  return (
    <View style={[styles.summaryCard, { borderColor: color + '40' }]}>
      <Ionicons name={icon as any} size={28} color={color} />
      <View style={{ marginLeft: Spacing.md }}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryAmount, { color }]}>{formatCurrency(amount)}</Text>
      </View>
    </View>
  );
}

function CategoryBreakdown({ items, total }: { items: { name: string; color: string; total: number }[]; total: number }) {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  if (sorted.length === 0) return null;

  return (
    <View style={styles.categoryBlock}>
      <Text style={styles.sectionTitle}>Por categoría</Text>
      {sorted.map((item) => {
        const pct = total > 0 ? (item.total / total) * 100 : 0;
        return (
          <View key={item.name} style={styles.categoryRow}>
            <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
            <Text style={styles.categoryName}>{item.name}</Text>
            <View style={styles.categoryBarWrap}>
              <View style={[styles.categoryBar, { width: `${pct}%` as any, backgroundColor: item.color + '60' }]} />
            </View>
            <Text style={styles.categoryAmount}>{formatCurrency(item.total)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TransactionRow({ transaction: t }: { transaction: Transaction }) {
  const isIncome = t.type === 'income';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: (t.category?.color ?? Colors.primary) + '20' }]}>
        <Ionicons name={(t.category?.icon ?? 'swap-horizontal-outline') as any} size={18} color={t.category?.color ?? Colors.primary} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDescription} numberOfLines={1}>{t.description ?? t.category?.name ?? 'Movimiento'}</Text>
        <Text style={styles.txDate}>{formatRelativeDate(t.date)}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isIncome ? Colors.income : Colors.expense }]}>
        {isIncome ? '+' : '-'}{formatCurrency(t.amount, t.currency)}
      </Text>
    </View>
  );
}

function CardMovementRow({ movement: m }: { movement: CardMovement }) {
  const isUSD = m.currency === 'USD';
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: Colors.primary + '20' }]}>
        <Ionicons name="card-outline" size={18} color={Colors.primary} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDescription} numberOfLines={1}>{m.merchant}</Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
          <Text style={styles.txDate}>{formatRelativeDate(m.date)}</Text>
          {m.installment && (
            <View style={styles.installmentBadge}>
              <Text style={styles.installmentText}>Cuota {m.installment}</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.txAmount, { color: Colors.expense }]}>
        {isUSD ? `USD ${m.amount.toFixed(2)}` : formatCurrency(m.amount)}
      </Text>
    </View>
  );
}

function InvestmentRow({ investment: inv }: { investment: Investment }) {
  const daysLeft = inv.maturity_date
    ? Math.ceil((new Date(inv.maturity_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <View style={styles.investRow}>
      <View style={styles.investRowHeader}>
        <View style={[styles.txIcon, { backgroundColor: Colors.warning + '20' }]}>
          <Ionicons name="trending-up" size={18} color={Colors.warning} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={styles.investName}>{inv.name}</Text>
          {inv.tna != null && (
            <Text style={styles.investSub}>TNA {inv.tna}% · {inv.term_days} días</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.investCapital}>{formatCurrency(inv.initial_amount)}</Text>
          {inv.gain_amount != null && (
            <Text style={styles.investGain}>+{formatCurrency(inv.gain_amount)}</Text>
          )}
        </View>
      </View>

      {inv.maturity_date && (
        <View style={styles.investFooter}>
          <Text style={styles.investMaturity}>
            Vence {formatDate(inv.maturity_date)}
          </Text>
          {daysLeft != null && (
            <View style={[styles.daysLeftBadge, { backgroundColor: daysLeft <= 7 ? Colors.warning + '30' : Colors.primary + '20' }]}>
              <Text style={[styles.daysLeftText, { color: daysLeft <= 7 ? Colors.warning : Colors.primary }]}>
                {daysLeft > 0 ? `${daysLeft}d` : 'Vencido'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cardStat}>
      <Text style={styles.cardStatLabel}>{label}</Text>
      <Text style={styles.cardStatValue}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function EmptyState({ text, icon = 'file-tray-outline' }: { text: string; icon?: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={40} color={Colors.textMuted} />
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  headerBalance: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },

  tabsScroll:   { flexGrow: 0 },
  tabsContent:  { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.sm },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  tabActive:    { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel:     { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '500' },
  tabLabelActive: { color: Colors.text },

  body:         { paddingHorizontal: Spacing.md, paddingBottom: Spacing.xxl, paddingTop: Spacing.sm },

  // Summary card
  summaryCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1 },
  summaryLabel: { color: Colors.textSecondary, fontSize: FontSize.sm },
  summaryAmount:{ fontSize: FontSize.xxl, fontWeight: '800', marginTop: 2 },

  // Category breakdown
  categoryBlock: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  categoryRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  categoryDot:   { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  categoryName:  { color: Colors.textSecondary, fontSize: FontSize.xs, width: 90 },
  categoryBarWrap: { flex: 1, height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden', marginHorizontal: Spacing.sm },
  categoryBar:   { height: 6, borderRadius: 3 },
  categoryAmount:{ color: Colors.text, fontSize: FontSize.xs, fontWeight: '600', minWidth: 70, textAlign: 'right' },

  sectionTitle: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.sm, marginTop: Spacing.xs },

  // Transaction row
  txRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  txIcon:       { width: 40, height: 40, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  txInfo:       { flex: 1 },
  txDescription:{ color: Colors.text, fontSize: FontSize.sm, fontWeight: '500' },
  txDate:       { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  txAmount:     { fontSize: FontSize.sm, fontWeight: '700' },

  installmentBadge: { backgroundColor: Colors.primary + '25', borderRadius: BorderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  installmentText:  { color: Colors.primaryLight, fontSize: 10, fontWeight: '600' },

  // Card tab
  cardSummary:  { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardBrand:    { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  cardDigits:   { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
  cardGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  cardStat:     { flex: 1, minWidth: '45%', backgroundColor: Colors.background, borderRadius: BorderRadius.sm, padding: Spacing.sm },
  cardStatLabel:{ color: Colors.textMuted, fontSize: FontSize.xs },
  cardStatValue:{ color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', marginTop: 2 },
  cardDates:    { flexDirection: 'row', justifyContent: 'space-between' },
  cardDateText: { color: Colors.textSecondary, fontSize: FontSize.xs },
  cardDateLabel:{ color: Colors.textMuted },

  cardTotals:   { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardTotalItem:{ flex: 1, padding: Spacing.md, alignItems: 'center' },
  cardTotalLabel:{ color: Colors.textMuted, fontSize: FontSize.xs },
  cardTotalValue:{ color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginTop: 4 },

  // Investment tab
  investSummary:     { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  investSummaryItem: { flex: 1, padding: Spacing.md, alignItems: 'center' },
  investSummaryLabel:{ color: Colors.textMuted, fontSize: FontSize.xs },
  investSummaryValue:{ color: Colors.text, fontSize: FontSize.md, fontWeight: '700', marginTop: 4 },

  investRow:       { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  investRowHeader: { flexDirection: 'row', alignItems: 'center' },
  investName:      { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  investSub:       { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  investCapital:   { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  investGain:      { color: Colors.income, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },
  investFooter:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  investMaturity:  { color: Colors.textMuted, fontSize: FontSize.xs },
  daysLeftBadge:   { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  daysLeftText:    { fontSize: FontSize.xs, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText:  { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: Spacing.md },
});
