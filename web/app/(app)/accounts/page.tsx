'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Account, AccountType } from '@/lib/types';
import Link from 'next/link';
import { Plus, Wallet, Building2, Banknote, ChevronRight, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const accountTypeLabels: Record<AccountType, string> = {
  bank: 'Banco',
  virtual_wallet: 'Billetera virtual',
  cash: 'Efectivo',
};

const accountTypeIcons: Record<AccountType, React.ReactNode> = {
  bank: <Building2 className="w-5 h-5" />,
  virtual_wallet: <Wallet className="w-5 h-5" />,
  cash: <Banknote className="w-5 h-5" />,
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    type: 'bank' as AccountType,
    provider: '',
    balance: '',
    has_daily_yield: false,
    daily_yield_rate: '',
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at');
      setAccounts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at');
    setAccounts(data || []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('accounts').insert({
      user_id: user.id,
      name: form.name.trim(),
      type: form.type,
      provider: form.provider.trim() || null,
      balance: parseFloat(form.balance) || 0,
      currency: 'ARS',
      has_daily_yield: form.has_daily_yield,
      daily_yield_rate: form.has_daily_yield ? parseFloat(form.daily_yield_rate) / 100 : 0,
    });

    setShowForm(false);
    setForm({
      name: '',
      type: 'bank',
      provider: '',
      balance: '',
      has_daily_yield: false,
      daily_yield_rate: '',
    });
    refresh();
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(n);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#2A2A4A]">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Cuentas</h1>
          <p className="text-gray-400 text-sm mt-1">
            Balance total consolidado:{' '}
            <span className="text-[#7B68EE] font-bold text-base">{fmt(totalBalance)}</span>
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva cuenta
        </Button>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7B68EE] mb-4" />
          <p className="text-gray-400 text-sm">Cargando cuentas...</p>
        </div>
      ) : accounts.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-300 font-medium text-lg">No tenés cuentas registradas todavía</p>
          <p className="text-gray-500 text-sm mt-1">Creá tu primera cuenta para empezar a registrar movimientos.</p>
          <Button onClick={() => setShowForm(true)} className="mt-6" variant="outline">
            <Plus className="w-4 h-4 mr-2" /> Crear primera cuenta
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => (
            <Link key={acc.id} href={`/accounts/${acc.id}`} className="group block">
              <Card className="p-6 transition-all duration-200 hover:border-[#7B68EE] hover:shadow-lg hover:shadow-[#7B68EE]/10 cursor-pointer h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-[#7B68EE]/15 text-[#7B68EE] p-3 rounded-xl border border-[#7B68EE]/20">
                      {accountTypeIcons[acc.type]}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{accountTypeLabels[acc.type]}</Badge>
                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-[#7B68EE] transition-colors" />
                    </div>
                  </div>
                  <h3 className="text-white font-bold text-lg group-hover:text-[#9B8FFF] transition-colors">
                    {acc.name}
                  </h3>
                  {acc.provider && (
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mt-0.5">
                      {acc.provider}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-[#2A2A4A]/60">
                  <p className="text-2xl font-black text-white tracking-tight">
                    {fmt(Number(acc.balance))}
                  </p>
                  {acc.has_daily_yield && (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs mt-2 font-medium">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Rendimiento diario: {(acc.daily_yield_rate * 100).toFixed(2)}%</span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Modal Nueva Cuenta con shadcn Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Nueva cuenta</DialogTitle>
            <DialogDescription>
              Completá los datos de la cuenta o billetera para incorporarla al balance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Cuenta Galicia"
                required
                className="w-full bg-[#252540] border border-[#2A2A4A] rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#7B68EE]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Tipo</label>
              <select
                title="Tipo de cuenta"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))}
                className="w-full bg-[#252540] border border-[#2A2A4A] rounded-lg px-3.5 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#7B68EE]"
              >
                <option value="bank">Banco</option>
                <option value="virtual_wallet">Billetera virtual</option>
                <option value="cash">Efectivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Proveedor (opcional)
              </label>
              <input
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                placeholder="Ej: Mercado Pago, Ualá, Santander"
                className="w-full bg-[#252540] border border-[#2A2A4A] rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#7B68EE]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Saldo inicial
              </label>
              <input
                type="number"
                value={form.balance}
                onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                placeholder="0"
                className="w-full bg-[#252540] border border-[#2A2A4A] rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#7B68EE]"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="yield"
                checked={form.has_daily_yield}
                onChange={(e) => setForm((f) => ({ ...f, has_daily_yield: e.target.checked }))}
                className="w-4 h-4 rounded border-[#2A2A4A] bg-[#252540] text-[#7B68EE] focus:ring-[#7B68EE]"
              />
              <label htmlFor="yield" className="text-gray-300 text-xs font-medium cursor-pointer">
                Genera rendimiento diario (billeteras remuneradas)
              </label>
            </div>

            {form.has_daily_yield && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Tasa diaria estimada (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.daily_yield_rate}
                  onChange={(e) => setForm((f) => ({ ...f, daily_yield_rate: e.target.value }))}
                  placeholder="0.09"
                  className="w-full bg-[#252540] border border-[#2A2A4A] rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-[#7B68EE]"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#2A2A4A]">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear cuenta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
