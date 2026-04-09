'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Account, AccountType } from '@/lib/types';
import Link from 'next/link';
import { Plus, Wallet, Building2, Banknote, ChevronRight } from 'lucide-react';

const accountTypeLabels: Record<AccountType, string> = {
  bank: 'Banco',
  virtual_wallet: 'Billetera virtual',
  cash: 'Efectivo',
};

const accountTypeIcons: Record<AccountType, React.ReactNode> = {
  bank: <Building2 size={20} />,
  virtual_wallet: <Wallet size={20} />,
  cash: <Banknote size={20} />,
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', type: 'bank' as AccountType, provider: '', balance: '', has_daily_yield: false, daily_yield_rate: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('created_at');
    setAccounts(data || []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('accounts').insert({
      user_id: user.id,
      name: form.name,
      type: form.type,
      provider: form.provider || null,
      balance: parseFloat(form.balance) || 0,
      currency: 'ARS',
      has_daily_yield: form.has_daily_yield,
      daily_yield_rate: form.has_daily_yield ? parseFloat(form.daily_yield_rate) / 100 : 0,
    });

    setShowForm(false);
    setForm({ name: '', type: 'bank', provider: '', balance: '', has_daily_yield: false, daily_yield_rate: '' });
    load();
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cuentas</h1>
          <p className="text-[#8888AA] text-sm mt-1">Balance total: <span className="text-[#7B68EE] font-semibold">{fmt(totalBalance)}</span></p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#7B68EE] hover:bg-[#9B8FFF] text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-colors">
          <Plus size={16} /> Nueva cuenta
        </button>
      </div>

      {loading ? (
        <p className="text-[#8888AA] text-center py-12">Cargando...</p>
      ) : accounts.length === 0 ? (
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-16 text-center">
          <Wallet size={40} className="text-[#2A2A45] mx-auto mb-4" />
          <p className="text-[#8888AA]">No tenés cuentas todavía</p>
          <button onClick={() => setShowForm(true)} className="mt-4 text-[#7B68EE] hover:text-[#9B8FFF] text-sm font-medium">
            Crear primera cuenta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <Link key={acc.id} href={`/accounts/${acc.id}`}
              className="group bg-[#1A1A2E] rounded-2xl p-6 border border-[#2A2A45] hover:border-[#7B68EE]/60 transition-all hover:shadow-lg hover:shadow-[#7B68EE]/5 block">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-[#7B68EE]/10 text-[#7B68EE] p-2.5 rounded-xl">
                  {accountTypeIcons[acc.type]}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#252540] text-[#8888AA] px-2 py-1 rounded-lg">
                    {accountTypeLabels[acc.type]}
                  </span>
                  <ChevronRight size={16} className="text-[#2A2A45] group-hover:text-[#7B68EE] transition-colors" />
                </div>
              </div>
              <h3 className="text-white font-semibold text-lg">{acc.name}</h3>
              {acc.provider && <p className="text-[#8888AA] text-sm mt-0.5">{acc.provider}</p>}
              <p className="text-2xl font-bold text-white mt-4">{fmt(Number(acc.balance))}</p>
              {acc.has_daily_yield && (
                <p className="text-[#00D4AA] text-xs mt-2">
                  Rendimiento diario: {(acc.daily_yield_rate * 100).toFixed(2)}%
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1A1A2E] rounded-2xl p-8 border border-[#2A2A45] w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-6">Nueva cuenta</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8888AA] mb-1">Nombre</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Cuenta Galicia" required
                  className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE]" />
              </div>
              <div>
                <label className="block text-sm text-[#8888AA] mb-1">Tipo</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
                  className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#7B68EE]">
                  <option value="bank">Banco</option>
                  <option value="virtual_wallet">Billetera virtual</option>
                  <option value="cash">Efectivo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#8888AA] mb-1">Proveedor (opcional)</label>
                <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="Ej: Mercado Pago, Ualá..."
                  className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE]" />
              </div>
              <div>
                <label className="block text-sm text-[#8888AA] mb-1">Saldo inicial</label>
                <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0"
                  className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE]" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="yield" checked={form.has_daily_yield} onChange={e => setForm(f => ({ ...f, has_daily_yield: e.target.checked }))}
                  className="w-4 h-4 accent-[#7B68EE]" />
                <label htmlFor="yield" className="text-[#8888AA] text-sm">Genera rendimiento diario</label>
              </div>
              {form.has_daily_yield && (
                <div>
                  <label className="block text-sm text-[#8888AA] mb-1">Tasa diaria (%)</label>
                  <input type="number" step="0.01" value={form.daily_yield_rate} onChange={e => setForm(f => ({ ...f, daily_yield_rate: e.target.value }))} placeholder="0.09"
                    className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE]" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-3 rounded-xl border border-[#2A2A45] text-[#8888AA] hover:text-white hover:border-[#7B68EE] transition-colors text-sm font-medium">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#7B68EE] hover:bg-[#9B8FFF] text-white font-medium text-sm transition-colors">
                  Crear cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
