'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Account, AccountType } from '@/lib/types';
import Link from 'next/link';
import { Plus, Wallet, Building2, Banknote, ChevronRight, TrendingUp, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const accountTypeLabels: Record<AccountType, string> = {
  bank: 'Cuenta Bancaria',
  virtual_wallet: 'Billetera Virtual',
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
        .select('*, credit_cards(synced_at)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at');
      setAccounts((data || []) as unknown as Account[]);
      setLoading(false);
    }
    load();
  }, []);

  async function refresh() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('accounts')
      .select('*, credit_cards(synced_at)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at');
    setAccounts((data || []) as unknown as Account[]);
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

  const getSyncTime = (acc: Account) => {
    if (acc.last_scraped_at) return acc.last_scraped_at;
    if (acc.credit_cards && acc.credit_cards.length > 0) {
      return acc.credit_cards[0].synced_at;
    }
    return null;
  };

  const fmtDateTime = (iso: string) => {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Corporativo Bancario */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cuentas y Productos</h1>
          <p className="text-slate-500 text-sm mt-1">
            Saldo total consolidado:{' '}
            <span className="text-[#1E40AF] font-bold text-base">{fmt(totalBalance)}</span>
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva cuenta
        </Button>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1E40AF] mb-4" />
          <p className="text-slate-500 text-sm">Cargando cuentas...</p>
        </div>
      ) : accounts.length === 0 ? (
        <Card className="p-16 text-center border-dashed border-slate-300 bg-white">
          <Wallet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-900 font-bold text-lg">No tenés cuentas registradas todavía</p>
          <p className="text-slate-500 text-sm mt-1">Creá tu primera cuenta o billetera para comenzar a operar.</p>
          <Button onClick={() => setShowForm(true)} className="mt-6" variant="outline">
            <Plus className="w-4 h-4 mr-2" /> Crear primera cuenta
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {accounts.map((acc) => (
            <Link key={acc.id} href={`/accounts/${acc.id}`} className="group block">
              <Card className="p-6 transition-all duration-200 hover:border-blue-500 hover:shadow-md cursor-pointer h-full flex flex-col justify-between border-slate-200 bg-white">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-blue-50 text-[#1E40AF] p-3 rounded-xl border border-blue-100">
                      {accountTypeIcons[acc.type]}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-semibold text-slate-700">
                        {accountTypeLabels[acc.type]}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#1E40AF] transition-colors" />
                    </div>
                  </div>
                  <h3 className="text-slate-900 font-bold text-lg group-hover:text-[#1E40AF] transition-colors">
                    {acc.name}
                  </h3>
                  {acc.provider && (
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-0.5">
                      {acc.provider}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <p className="text-2xl font-black text-slate-900 tracking-tight">
                    {fmt(Number(acc.balance))}
                  </p>
                  {acc.has_daily_yield && (
                    <div className="flex items-center gap-1.5 text-emerald-700 text-xs mt-2 font-semibold bg-emerald-50 px-2 py-1 rounded-md w-fit">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Rendimiento diario: {(acc.daily_yield_rate * 100).toFixed(2)}%</span>
                    </div>
                  )}
                  {getSyncTime(acc) && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs mt-2 font-medium">
                      <RefreshCw className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>Último scrapeo: <strong className="text-emerald-700 font-semibold">{fmtDateTime(getSyncTime(acc)!)}</strong></span>
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
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Nueva cuenta bancaria o billetera</DialogTitle>
            <DialogDescription>
              Completá los datos de la cuenta para incorporarla a tu balance consolidado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Nombre de la cuenta</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Caja de Ahorro Galicia, Cuenta Sueldo"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Tipo de cuenta</label>
              <select
                title="Tipo de cuenta"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-xs"
              >
                <option value="bank">Banco</option>
                <option value="virtual_wallet">Billetera virtual</option>
                <option value="cash">Efectivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Entidad proveedora (opcional)
              </label>
              <Input
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                placeholder="Ej: Banco Galicia, Santander, Mercado Pago"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Saldo inicial
              </label>
              <Input
                type="number"
                step="any"
                value={form.balance}
                onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="yield"
                checked={form.has_daily_yield}
                onChange={(e) => setForm((f) => ({ ...f, has_daily_yield: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-blue-600"
              />
              <label htmlFor="yield" className="text-slate-700 text-xs font-semibold cursor-pointer">
                Genera rendimiento diario (billeteras remuneradas)
              </label>
            </div>

            {form.has_daily_yield && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tasa diaria estimada (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.daily_yield_rate}
                  onChange={(e) => setForm((f) => ({ ...f, daily_yield_rate: e.target.value }))}
                  placeholder="0.09"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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
