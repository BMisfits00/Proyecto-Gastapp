'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, PiggyBank, PieChart as PieIcon, LineChart as LineIcon, Calendar } from 'lucide-react';

const COLORS = ['#1E40AF', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#06B6D4', '#8B5CF6', '#EC4899'];

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  
  // Mes seleccionado (por defecto el mes actual en formato YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

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

  const fmt = (n: number) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
    }
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  };

  // Filtrar transacciones por la moneda seleccionada
  const currencyTxs = transactions.filter(t => {
    if (currency === 'USD') return t.currency === 'USD';
    return t.currency === 'ARS' || !t.currency;
  });

  // Lista de meses disponibles para seleccionar
  const availableMonths = Array.from(new Set(
    currencyTxs.map(t => t.date ? t.date.slice(0, 7) : '').filter(Boolean)
  )).sort().reverse();

  // Asegurar que si el mes seleccionado no existe en availableMonths, usar el primero disponible o el actual
  const effectiveMonth = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : (availableMonths[0] || selectedMonth);

  // Transacciones del mes seleccionado (usando slice para evitar desfases de zona horaria)
  const monthTxs = currencyTxs.filter(t => t.date && t.date.startsWith(effectiveMonth));

  // Ingresos y egresos del mes
  const currentMonthExpenses = monthTxs.filter(t => t.type === 'expense');
  const monthlyIncome = monthTxs
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpense = currentMonthExpenses
    .reduce((s, t) => s + Number(t.amount), 0);
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;

  // Gastos por categoría del mes seleccionado
  const byCat: Record<string, { name: string; total: number }> = {};
  currentMonthExpenses.forEach(t => {
    const cat = t.category?.name || 'Sin categoría';
    if (!byCat[cat]) byCat[cat] = { name: cat, total: 0 };
    byCat[cat].total += Number(t.amount);
  });
  const pieData = Object.values(byCat).sort((a, b) => b.total - a.total);

  // Evolución mensual histórica (últimos 6 meses)
  const monthlyMap: Record<string, { mes: string; Ingresos: number; Gastos: number }> = {};
  currencyTxs.forEach(t => {
    if (!t.date) return;
    const key = t.date.slice(0, 7); // 'YYYY-MM'
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1, 15); // Día 15 del mes para evitar cualquier cambio por timezone
    const label = d.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
    if (!monthlyMap[key]) monthlyMap[key] = { mes: label, Ingresos: 0, Gastos: 0 };
    if (t.type === 'income') monthlyMap[key].Ingresos += Number(t.amount);
    if (t.type === 'expense') monthlyMap[key].Gastos += Number(t.amount);
  });
  const lineData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, v]) => v);

  // Etiqueta legible del mes seleccionado
  const [selYear, selMonthNum] = effectiveMonth.split('-').map(Number);
  const selDate = new Date(selYear, (selMonthNum || 1) - 1, 15);
  const monthLabel = selDate.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  const capitalizedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controles de Moneda y Mes */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Informes & Rendimiento</h1>
          <p className="text-sm text-slate-500 mt-1">Análisis evolutivo y balance financiero de los últimos 6 meses</p>
        </div>

        {/* Selector de Moneda y Mes */}
        <div className="flex items-center gap-2.5">
          {/* Selector de moneda */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setCurrency('ARS')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                currency === 'ARS'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ARS ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                currency === 'USD'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              USD (U$D)
            </button>
          </div>

          {/* Selector de mes */}
          {availableMonths.length > 0 && (
            <div className="relative flex items-center">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                value={effectiveMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableMonths.map(ym => {
                  const [y, m] = ym.split('-').map(Number);
                  const d = new Date(y, m - 1, 15);
                  const label = d.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
                  return (
                    <option key={ym} value={ym}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Salud financiera del mes seleccionado */}
      <Card className="border-slate-200 shadow-xs bg-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base font-semibold text-slate-900">
              Salud Financiera de {capitalizedMonthLabel}
            </CardTitle>
          </div>
          <CardDescription>Resumen de ingresos, egresos y tasa de ahorro del período ({currency})</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Ingresos Percibidos
              </div>
              <p className="text-2xl font-bold text-emerald-600">{fmt(monthlyIncome)}</p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {monthTxs.filter(t => t.type === 'income').length} acreditaciones
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                Gastos Realizados
              </div>
              <p className="text-2xl font-bold text-rose-600">{fmt(monthlyExpense)}</p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {currentMonthExpenses.length} débitos
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200/60 p-4 text-center">
              <p className="text-xs font-medium text-slate-500 mb-1">Capacidad de Ahorro</p>
              <p className={`text-2xl font-bold ${savingsRate >= 20 ? 'text-emerald-600' : savingsRate >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                {savingsRate.toFixed(1)}%
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                Superávit: {fmt(monthlyIncome - monthlyExpense)}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-xs text-slate-500 mb-2 font-medium">
              <span>Proporción de Ahorro Neto</span>
              <span>{Math.max(0, savingsRate).toFixed(1)}% / 100%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/60">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(Math.max(savingsRate, 0), 100)}%`,
                  backgroundColor: savingsRate >= 20 ? '#10B981' : savingsRate >= 10 ? '#F59E0B' : '#EF4444'
                }}
              />
            </div>
            <p className="text-slate-500 text-xs mt-2.5 text-center font-medium">
              {savingsRate >= 20
                ? '✓ Excelente disciplina y ritmo de ahorro.'
                : savingsRate >= 10
                ? 'ℹ Buen ritmo de ahorro. Existe margen de optimización.'
                : '⚠ Atención: los egresos consumieron casi la totalidad de los ingresos en este mes.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Distribución de gastos */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold text-slate-900">Distribución de Gastos por Rubro</CardTitle>
            </div>
            <CardDescription>Composición porcentual de los egresos de {capitalizedMonthLabel}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {pieData.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-20 font-medium">Sin egresos registrados en este mes</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={85}
                      innerRadius={45}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmt(Number(v))}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: 8,
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2.5 mt-6 border-t border-slate-100 pt-4 max-h-56 overflow-y-auto pr-1">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-sm py-1 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-slate-600 font-medium">{d.name}</span>
                      </div>
                      <span className="text-slate-900 font-semibold">{fmt(d.total)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Evolución mensual */}
        <Card className="border-slate-200 shadow-xs bg-white">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <LineIcon className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base font-semibold text-slate-900">Evolución Histórica Semestral</CardTitle>
            </div>
            <CardDescription>Comparativa temporal consolidada ({currency})</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={lineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="mes" stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis stroke="#94A3B8" tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ color: '#0F172A', fontWeight: 600 }}
                  formatter={(v) => fmt(Number(v))}
                />
                <Legend wrapperStyle={{ color: '#64748B', fontSize: 12, paddingTop: 10 }} />
                <Line type="monotone" dataKey="Ingresos" stroke="#10B981" strokeWidth={2.5} dot={{ fill: '#10B981', r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Gastos" stroke="#EF4444" strokeWidth={2.5} dot={{ fill: '#EF4444', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
