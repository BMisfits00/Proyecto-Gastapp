'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Account } from '@/lib/types';
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const [{ data: accs }, { data: txs }, { data: allTxs }] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user.id).gte('date', firstDay).lte('date', lastDay).order('date', { ascending: false }),
        supabase.from('transactions').select('*').eq('user_id', user.id).gte('date', sixMonthsAgo.toISOString().split('T')[0]).order('date', { ascending: true }),
      ]);

      setAccounts(accs || []);
      setTransactions(txs || []);
      setAllTransactions(allTxs || []);
      setLoading(false);
    }
    load();
  }, []);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const monthlyIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

  // Evolución mensual (últimos 6 meses)
  const monthlyMap: Record<string, { mes: string; Ingresos: number; Gastos: number }> = {};
  allTransactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es-AR', { month: 'short' });
    if (!monthlyMap[key]) monthlyMap[key] = { mes: label, Ingresos: 0, Gastos: 0 };
    if (t.type === 'income') monthlyMap[key].Ingresos += Number(t.amount);
    if (t.type === 'expense') monthlyMap[key].Gastos += Number(t.amount);
  });
  const chartData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[#8888AA]">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-[#8888AA] text-sm mt-1">Resumen financiero del mes</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Balance total" value={fmt(totalBalance)} icon={<Wallet size={20} />} color="text-[#7B68EE]" bg="bg-[#7B68EE]/10" />
        <MetricCard title="Ingresos del mes" value={fmt(monthlyIncome)} icon={<TrendingUp size={20} />} color="text-[#00D4AA]" bg="bg-[#00D4AA]/10" />
        <MetricCard title="Gastos del mes" value={fmt(monthlyExpenses)} icon={<TrendingDown size={20} />} color="text-[#FF6B6B]" bg="bg-[#FF6B6B]/10" />
        <MetricCard
          title="Tasa de ahorro"
          value={`${savingsRate.toFixed(1)}%`}
          icon={<PiggyBank size={20} />}
          color={savingsRate >= 20 ? 'text-[#00D4AA]' : savingsRate >= 10 ? 'text-[#FFB347]' : 'text-[#FF6B6B]'}
          bg={savingsRate >= 20 ? 'bg-[#00D4AA]/10' : savingsRate >= 10 ? 'bg-[#FFB347]/10' : 'bg-[#FF6B6B]/10'}
        />
      </div>

      {/* Gráfico */}
      <div className="bg-[#1A1A2E] rounded-2xl p-6 border border-[#2A2A45]">
        <h2 className="text-lg font-semibold text-white mb-6">Evolución mensual</h2>
        {chartData.length === 0 ? (
          <p className="text-[#8888AA] text-sm text-center py-16">Sin datos para mostrar</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A45" />
              <XAxis dataKey="mes" stroke="#8888AA" tick={{ fill: '#8888AA', fontSize: 12 }} />
              <YAxis stroke="#8888AA" tick={{ fill: '#8888AA', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#252540', border: '1px solid #2A2A45', borderRadius: 12 }} labelStyle={{ color: '#fff' }} formatter={(v) => fmt(Number(v))} />
              <Legend wrapperStyle={{ color: '#8888AA', fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill="#00D4AA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Últimas transacciones */}
      <div className="bg-[#1A1A2E] rounded-2xl p-6 border border-[#2A2A45]">
        <h2 className="text-lg font-semibold text-white mb-4">Últimas transacciones</h2>
        {transactions.length === 0 ? (
          <p className="text-[#8888AA] text-sm text-center py-8">No hay transacciones este mes</p>
        ) : (
          <div className="space-y-0">
            {transactions.slice(0, 8).map(t => (
              <div key={t.id} className="flex items-center justify-between py-3 border-b border-[#2A2A45] last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.type === 'income' ? 'bg-[#00D4AA]' : 'bg-[#FF6B6B]'}`} />
                  <div>
                    <p className="text-white text-sm font-medium">{t.description || 'Sin descripción'}</p>
                    <p className="text-[#8888AA] text-xs mt-0.5">{t.date}</p>
                  </div>
                </div>
                <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-[#00D4AA]' : 'text-[#FF6B6B]'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, bg }: {
  title: string; value: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className="bg-[#1A1A2E] rounded-2xl p-5 border border-[#2A2A45]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#8888AA] text-sm">{title}</p>
        <div className={`${bg} ${color} p-2 rounded-xl`}>{icon}</div>
      </div>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}
