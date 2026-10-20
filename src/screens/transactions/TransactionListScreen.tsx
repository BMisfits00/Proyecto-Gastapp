import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteTransactions, useDeleteTransaction } from '../../hooks/useTransactions';
import { TransactionItem } from '../../components/transactions/TransactionItem';
import { Transaction } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';

type FilterType = 'all' | 'income' | 'expense';

export function TransactionListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState<FilterType>('all');
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteTransactions(20);
  const { mutate: deleteTransaction } = useDeleteTransaction();

  // Aplanar las páginas de la query infinita
  const allTransactions = data?.pages.flatMap((page) => page) ?? [];

  const filtered = allTransactions.filter((t) =>
    filter === 'all' ? true : t.type === filter
  );

  const handleDelete = (transaction: Transaction) => {
    Alert.alert(
      'Eliminar movimiento',
      `¿Deseás eliminar "${transaction.description || transaction.category?.name || 'este movimiento'}"? El saldo se revertirá automáticamente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => deleteTransaction(transaction.id),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate('EditTransaction', { transaction: item })}
      onLongPress={() => handleDelete(item)}
    >
      <TransactionItem transaction={item} />
    </TouchableOpacity>
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

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Movimientos</Text>
        <Text style={styles.hint}>Tocá para editar · Mantené presionado para borrar</Text>
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
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.primary}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={Colors.primary} size="small" />
              </View>
            ) : null
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
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800' },
  hint: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md, marginTop: Spacing.sm },
  footerLoader: { paddingVertical: Spacing.md, alignItems: 'center' },
});
