'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Account, Category } from '@/lib/types';
import { Plus, Search } from 'lucide-react';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    category_id: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: txs }, { data: accs }, { data: cats }] = await Promise.all([
      supabase.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('user_id', user.id).order('date', { ascending: false }).limit(100),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('categories').select('*').or(`user_id.eq.${user.id},user_id.is.null`),
    ]);

    setTransactions(txs || []);
    setAccounts(accs || []);
    setCategories(cats || []);
    if (accs && accs.length > 0) setForm(f => ({ ...f, account_id: accs[0].id }));
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description,
      date: form.date,
      account_id: form.account_id,
      category_id: form.category_id || null,
      currency: 'ARS',
    });

    setShowForm(false);
    setForm(f => ({ ...f, amount: '', description: '', category_id: '' }));
    load();
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

  const filtered = transactions.filter(t => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (search && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredCats = categories.filter(c => c.type === form.type);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transacciones</h1>
          <p className="text-[#8888AA] text-sm mt-1">{filtered.length} movimientos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#7B68EE] hover:bg-[#9B8FFF] text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors"
        >
          <Plus size={16} /> Nueva transacción
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888AA]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-[#1A1A2E] border border-[#2A2A45] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE]"
          />
        </div>
        <div className="flex bg-[#1A1A2E] border border-[#2A2A45] rounded-xl overflow-hidden">
          {(['all', 'income', 'expense'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${filter === f ? 'bg-[#7B68EE] text-white' : 'text-[#8888AA] hover:text-white'}`}
            >
              {f === 'all' ? 'Todos' : f === 'income' ? 'Ingresos' : 'Gastos'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] overflow-hidden">
        {loading ? (
          <p className="text-[#8888AA] text-sm text-center py-12">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-[#8888AA] text-sm text-center py-12">No hay transacciones</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2A45]">
                {['Descripción', 'Categoría', 'Cuenta', 'Fecha', 'Monto'].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-[#8888AA] text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-[#2A2A45] last:border-0 hover:bg-[#252540] transition-colors">
                  <td className="px-6 py-4 text-white text-sm">{t.description || '—'}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-[#252540] text-[#8888AA] px-2 py-1 rounded-lg">
                      {(t.category as any)?.name || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[#8888AA] text-sm">{(t.account as any)?.name || '—'}</td>
                  <td className="px-6 py-4 text-[#8888AA] text-sm">{t.date}</td>
                  <td className={`px-6 py-4 text-sm font-semibold ${t.type === 'income' ? 'text-[#00D4AA]' : 'text-[#FF6B6B]'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva transacción */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1A1A2E] rounded-2xl p-8 border border-[#2A2A45] w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-6">Nueva transacción</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="flex bg-[#252540] rounded-xl overflow-hidden">
                {(['expense', 'income'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t, category_id: '' }))}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${form.type === t ? (t === 'income' ? 'bg-[#00D4AA] text-white' : 'bg-[#FF6B6B] text-white') : 'text-[#8888AA]'}`}>
                    {t === 'income' ? 'Ingreso' : 'Gasto'}
                  </button>
                ))}
              </div>

              {[
                { label: 'Monto', type: 'number', value: form.amount, key: 'amount', placeholder: '0' },
                { label: 'Descripción', type: 'text', value: form.description, key: 'description', placeholder: 'Ej: Almuerzo' },
                { label: 'Fecha', type: 'date', value: form.date, key: 'date', placeholder: '' },
              ].map(({ label, type, value, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm text-[#8888AA] mb-1">{label}</label>
                  <input type={type} value={value} placeholder={placeholder} required={key === 'amount'}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE]" />
                </div>
              ))}

              <div>
                <label className="block text-sm text-[#8888AA] mb-1">Cuenta</label>
                <select value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))} required
                  className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#7B68EE]">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[#8888AA] mb-1">Categoría</label>
                <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#7B68EE]">
                  <option value="">Sin categoría</option>
                  {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl border border-[#2A2A45] text-[#8888AA] hover:text-white hover:border-[#7B68EE] transition-colors text-sm font-medium">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#7B68EE] hover:bg-[#9B8FFF] text-white font-medium text-sm transition-colors">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
