import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAllTransactions, useDeleteTransaction } from '../../hooks/useTransactions';
import { TransactionItem } from '../../components/transactions/TransactionItem';
import { Transaction } from '../../types';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';

type FilterType = 'all' | 'income' | 'expense';

export function TransactionListScreen() {
  const [filter, setFilter] = useState<FilterType>('all');
  const { data: transactions, isLoading, refetch } = useAllTransactions();
  const { mutate: deleteTransaction } = useDeleteTransaction();

  const filtered = transactions?.filter((t) =>
    filter === 'all' ? true : t.type === filter
  );

  const renderItem = ({ item }: { item: Transaction }) => (
    <TransactionItem
      transaction={item}
      onPress={() => {
        // TODO: navegar a detalle/edición
      }}
    />
  );

  const FilterButton = ({ type, label }: { type: FilterType; label: string }) => (
    <TouchableOpacity
      style={[styles.filterBtn, filter === type && styles.filterActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Movimientos</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        <FilterButton type="all" label="Todos" />
        <FilterButton type="income" label="Ingresos" />
        <FilterButton type="expense" label="Gastos" />
      </View>

      {/* Lista */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="receipt-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Sin movimientos</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800' },
  filters: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  filterBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  filterTextActive: { color: Colors.text },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: Spacing.xxl },
  emptyText: { color: Colors.textMuted, marginTop: Spacing.md, fontSize: FontSize.md },
});
