'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Account } from '@/lib/types';
import { TrendingUp, TrendingDown, Wallet, PiggyBank, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDayNum = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const lastDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
      
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      const sixMonthsIso = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

      const [{ data: accs }, { data: txs }, { data: allTxs }] = await Promise.all([
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user.id).gte('date', firstDay).lte('date', lastDay).order('date', { ascending: false }),
        supabase.from('transactions').select('*').eq('user_id', user.id).gte('date', sixMonthsIso).order('date', { ascending: true }),
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
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1E40AF]" />
          <p className="text-slate-500 text-sm">Cargando posición global...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Posición Global</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen financiero consolidado del período en curso</p>
      </div>

      {/* Métricas con shadcn Card Estilo Bancario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card className="p-6 border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Total Disponible</span>
            <div className="bg-blue-50 text-[#1E40AF] p-2.5 rounded-lg border border-blue-100">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#1E3A8A] tracking-tight">{fmt(totalBalance)}</p>
          <p className="text-xs text-slate-500 mt-2 font-medium">{accounts.length} cuentas bancarias activas</p>
        </Card>

        <Card className="p-6 border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingresos del Mes</span>
            <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-lg border border-emerald-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-700 tracking-tight">{fmt(monthlyIncome)}</p>
          <div className="flex items-center gap-1 text-xs text-emerald-700 mt-2 font-semibold">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Acreditaciones</span>
          </div>
        </Card>

        <Card className="p-6 border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gastos del Mes</span>
            <div className="bg-red-50 text-red-700 p-2.5 rounded-lg border border-red-100">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-red-700 tracking-tight">{fmt(monthlyExpenses)}</p>
          <div className="flex items-center gap-1 text-xs text-red-700 mt-2 font-semibold">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Débitos y consumos</span>
          </div>
        </Card>

        <Card className="p-6 border-slate-200 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ratio de Ahorro</span>
            <div className="bg-amber-50 text-amber-700 p-2.5 rounded-lg border border-amber-100">
              <PiggyBank className="w-5 h-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 tracking-tight">{savingsRate.toFixed(1)}%</p>
          <div className="mt-2">
            <Badge variant={savingsRate >= 20 ? 'success' : savingsRate >= 10 ? 'default' : 'destructive'}>
              {savingsRate >= 20 ? 'Excelente ritmo' : savingsRate >= 10 ? 'Moderado' : 'Atención'}
            </Badge>
          </div>
        </Card>
      </div>

      {/* Gráfico en shadcn Card */}
      <Card className="p-6 border-slate-200 shadow-xs">
        <CardHeader className="p-0 pb-6">
          <CardTitle className="text-slate-900 font-bold">Evolución de Flujo de Fondos</CardTitle>
          <CardDescription className="text-slate-500">Histórico semestral de cobros vs. pagos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {chartData.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Sin datos para graficar en este período</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="mes" stroke="#64748B" tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} />
                <YAxis stroke="#64748B" tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: 8, color: '#0F172A', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ color: '#0F172A', fontWeight: 700 }}
                  formatter={(v) => fmt(Number(v))}
                />
                <Legend wrapperStyle={{ color: '#64748B', fontSize: 12, paddingTop: 12 }} />
                <Bar dataKey="Ingresos" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Últimas transacciones */}
      <Card className="p-6 border-slate-200 shadow-xs">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-slate-900 font-bold">Últimos Movimientos Registrados</CardTitle>
          <CardDescription className="text-slate-500">Detalle cronológico de las operaciones recientes</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No hay transacciones registradas este mes.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3.5 hover:bg-slate-50/80 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        t.type === 'income'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : t.type === 'transfer'
                          ? 'bg-blue-50 text-[#1E40AF] border border-blue-100'
                          : 'bg-red-50 text-red-700 border border-red-100'
                      }`}
                    >
                      {t.type === 'income' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : t.type === 'transfer' ? (
                        <ArrowRightLeft className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-slate-900 text-sm font-semibold">
                        {t.description || t.category?.name || (t.type === 'transfer' ? 'Transferencia' : 'Sin descripción')}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5 font-medium">{t.date}</p>
                    </div>
                  </div>
                  <span
                    className={`font-bold text-sm tracking-tight ${
                      t.type === 'income'
                        ? 'text-emerald-700'
                        : t.type === 'transfer'
                        ? 'text-[#1E40AF]'
                        : 'text-red-700'
                    }`}
                  >
                    {t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄ ' : '-'}{fmt(Number(t.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
