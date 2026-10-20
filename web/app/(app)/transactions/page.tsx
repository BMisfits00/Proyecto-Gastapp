'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Account, Category } from '@/lib/types';
import { Plus, Search, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: txs }, { data: accs }, { data: cats }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, category:categories(*), account:accounts(*)')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(100),
        supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
        supabase.from('categories').select('*').or(`user_id.eq.${user.id},user_id.is.null`),
      ]);

      setTransactions(txs || []);
      setAccounts(accs || []);
      setCategories(cats || []);
      if (accs && accs.length > 0) setForm((f) => ({ ...f, account_id: accs[0].id }));
      setLoading(false);
    }
    load();
  }, []);

  async function refreshTransactions() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: txs } = await supabase
      .from('transactions')
      .select('*, category:categories(*), account:accounts(*)')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(100);
    setTransactions(txs || []);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('transactions').insert({
      user_id: user.id,
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description.trim() || null,
      date: form.date,
      account_id: form.account_id,
      category_id: form.category_id || null,
      currency: 'ARS',
    });

    setShowForm(false);
    setForm((f) => ({ ...f, amount: '', description: '', category_id: '' }));
    refreshTransactions();
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const filtered = transactions.filter((t) => {
    if (filter !== 'all' && t.type !== filter) return false;
    if (search && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredCats = categories.filter((c) => c.type === form.type);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Encabezado Bancario */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Extracto de Movimientos</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} operaciones registradas</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nueva transacción
        </Button>
      </div>

      {/* Controles de Filtros con shadcn Button e Input */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todos los movimientos
          </Button>
          <Button
            variant={filter === 'income' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('income')}
          >
            Acreditaciones
          </Button>
          <Button
            variant={filter === 'expense' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('expense')}
          >
            Débitos
          </Button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por concepto o comercio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>
      </div>

      {/* Tabla con shadcn Table */}
      <Card className="border-slate-200 shadow-xs bg-white overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1E40AF] mb-3" />
              <p className="text-slate-500 text-sm">Cargando movimientos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm font-medium">
              No se encontraron movimientos con los filtros seleccionados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Fecha</TableHead>
                  <TableHead>Concepto / Detalle</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Cuenta de Cargo</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/70">
                    <TableCell className="text-slate-500 text-xs font-mono font-medium">{t.date}</TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                            t.type === 'income'
                              ? 'bg-emerald-50 text-emerald-700'
                              : t.type === 'transfer'
                              ? 'bg-blue-50 text-[#1E40AF]'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {t.type === 'income' ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : t.type === 'transfer' ? (
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <span>
                          {t.description || (t.type === 'transfer' ? 'Transferencia' : 'Sin descripción')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {t.category ? (
                        <Badge variant="secondary" className="gap-1.5 font-medium text-slate-700">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: t.category.color ?? '#1E40AF' }}
                          />
                          {t.category.name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-700 text-sm font-medium">
                        {t.account?.name ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold tracking-tight text-base ${
                        t.type === 'income'
                          ? 'text-emerald-700'
                          : t.type === 'transfer'
                          ? 'text-[#1E40AF]'
                          : 'text-red-700'
                      }`}
                    >
                      {t.type === 'income' ? '+' : t.type === 'transfer' ? '⇄ ' : '-'}{fmt(Number(t.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Nueva Transacción con shadcn Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nueva operación</DialogTitle>
            <DialogDescription>Registrá un nuevo movimiento de ingreso o gasto.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            {/* Selector de Tipo */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.type === 'expense' ? 'destructive' : 'outline'}
                onClick={() => setForm((f) => ({ ...f, type: 'expense', category_id: '' }))}
                className="w-full"
              >
                Débito / Gasto
              </Button>
              <Button
                type="button"
                variant={form.type === 'income' ? 'default' : 'outline'}
                onClick={() => setForm((f) => ({ ...f, type: 'income', category_id: '' }))}
                className={`w-full ${form.type === 'income' ? 'bg-emerald-700 hover:bg-emerald-800' : ''}`}
              >
                Acreditación / Ingreso
              </Button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Monto ($ ARS)</label>
              <Input
                type="number"
                step="any"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Concepto o Descripción</label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Pago de servicios, Sueldo, Supermercado"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Fecha de Operación</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Cuenta de Cargo</label>
                <select
                  title="Seleccionar cuenta"
                  value={form.account_id}
                  onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-xs"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Categoría Contable</label>
              <select
                title="Seleccionar categoría"
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent shadow-xs"
              >
                <option value="">Sin categoría asignada</option>
                {filteredCats.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">Confirmar operación</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
