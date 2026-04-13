'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/lib/types';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

const COLORS = ['#7B68EE', '#00D4AA', '#FF6B6B', '#FFB347', '#FF6B9D', '#60A5FA', '#34D399', '#FBBF24'];

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data } = await supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0])
        .order('date', { ascending: true });

      setTransactions(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

  // Gastos por categoría (mes actual)
  const now = new Date();
  const currentMonthExpenses = transactions.filter(t =>
    t.type === 'expense' &&
    new Date(t.date).getMonth() === now.getMonth() &&
    new Date(t.date).getFullYear() === now.getFullYear()
  );

  const byCat: Record<string, { name: string; total: number }> = {};
  currentMonthExpenses.forEach(t => {
    const cat = t.category?.name || 'Sin categoría';
    if (!byCat[cat]) byCat[cat] = { name: cat, total: 0 };
    byCat[cat].total += Number(t.amount);
  });
  const pieData = Object.values(byCat).sort((a, b) => b.total - a.total);

  // Evolución mensual
  const monthlyMap: Record<string, { mes: string; Ingresos: number; Gastos: number }> = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
    if (!monthlyMap[key]) monthlyMap[key] = { mes: label, Ingresos: 0, Gastos: 0 };
    if (t.type === 'income') monthlyMap[key].Ingresos += Number(t.amount);
    if (t.type === 'expense') monthlyMap[key].Gastos += Number(t.amount);
  });
  const lineData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

  // Tasa de ahorro mensual
  const monthlyIncome = transactions.filter(t => t.type === 'income' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear()).reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpense = transactions.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear()).reduce((s, t) => s + Number(t.amount), 0);
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

  if (loading) return <div className="flex items-center justify-center h-full min-h-screen"><p className="text-[#8888AA]">Cargando...</p></div>;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        <p className="text-[#8888AA] text-sm mt-1">Análisis de los últimos 6 meses</p>
      </div>

      {/* Tasa de ahorro */}
      <div className="bg-[#1A1A2E] rounded-2xl p-6 border border-[#2A2A45]">
        <h2 className="text-lg font-semibold text-white mb-4">Salud financiera del mes</h2>
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: 'Ingresos', value: fmt(monthlyIncome), color: 'text-[#00D4AA]' },
            { label: 'Gastos', value: fmt(monthlyExpense), color: 'text-[#FF6B6B]' },
            { label: 'Tasa de ahorro', value: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 20 ? 'text-[#00D4AA]' : savingsRate >= 10 ? 'text-[#FFB347]' : 'text-[#FF6B6B]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-[#8888AA] text-sm mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-[#252540] rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(savingsRate, 100)}%`, backgroundColor: savingsRate >= 20 ? '#00D4AA' : savingsRate >= 10 ? '#FFB347' : '#FF6B6B' }}
          />
        </div>
        <p className="text-[#8888AA] text-xs mt-2 text-center">
          {savingsRate >= 20 ? 'Excelente ritmo de ahorro' : savingsRate >= 10 ? 'Buen ritmo, podés mejorar' : 'Atención: gastos elevados'}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="bg-[#1A1A2E] rounded-2xl p-6 border border-[#2A2A45]">
          <h2 className="text-lg font-semibold text-white mb-6">Gastos por categoría</h2>
          {pieData.length === 0 ? (
            <p className="text-[#8888AA] text-sm text-center py-16">Sin gastos este mes</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ backgroundColor: '#252540', border: '1px solid #2A2A45', borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[#8888AA]">{d.name}</span>
                    </div>
                    <span className="text-white font-medium">{fmt(d.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Line chart */}
        <div className="bg-[#1A1A2E] rounded-2xl p-6 border border-[#2A2A45]">
          <h2 className="text-lg font-semibold text-white mb-6">Evolución mensual</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A45" />
              <XAxis dataKey="mes" stroke="#8888AA" tick={{ fill: '#8888AA', fontSize: 12 }} />
              <YAxis stroke="#8888AA" tick={{ fill: '#8888AA', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#252540', border: '1px solid #2A2A45', borderRadius: 12 }} labelStyle={{ color: '#fff' }} formatter={(v) => fmt(Number(v))} />
              <Legend wrapperStyle={{ color: '#8888AA', fontSize: 12 }} />
              <Line type="monotone" dataKey="Ingresos" stroke="#00D4AA" strokeWidth={2} dot={{ fill: '#00D4AA', r: 4 }} />
              <Line type="monotone" dataKey="Gastos" stroke="#FF6B6B" strokeWidth={2} dot={{ fill: '#FF6B6B', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
