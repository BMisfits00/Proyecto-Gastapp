'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Account, Transaction, CreditCard, CardMovement, Investment } from '@/lib/types';
import {
  ArrowLeft, TrendingUp, TrendingDown, CreditCard as CreditCardIcon,
  Landmark, ChevronRight,
} from 'lucide-react';

type Tab = 'income' | 'expense' | 'card' | 'investments';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'income',      label: 'Ingresos',   icon: <TrendingUp size={15} /> },
  { key: 'expense',     label: 'Gastos',      icon: <TrendingDown size={15} /> },
  { key: 'card',        label: 'Tarjeta',     icon: <CreditCardIcon size={15} /> },
  { key: 'investments', label: 'Inversiones', icon: <Landmark size={15} /> },
];

const fmt = (n: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [account, setAccount]       = useState<Account | null>(null);
  const [income, setIncome]         = useState<Transaction[]>([]);
  const [expenses, setExpenses]     = useState<Transaction[]>([]);
  const [card, setCard]             = useState<CreditCard | null>(null);
  const [cardMvs, setCardMvs]       = useState<CardMovement[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [tab, setTab]               = useState<Tab>('income');
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        { data: acc },
        { data: txIncome },
        { data: txExpense },
        { data: cc },
        { data: invs },
      ] = await Promise.all([
        supabase.from('accounts').select('*').eq('id', id).single(),
        supabase.from('transactions').select('*, category:categories(id,name,color)').eq('account_id', id).eq('type', 'income').order('date', { ascending: false }),
        supabase.from('transactions').select('*, category:categories(id,name,color)').eq('account_id', id).eq('type', 'expense').order('date', { ascending: false }),
        supabase.from('credit_cards').select('*').eq('account_id', id).maybeSingle(),
        supabase.from('investments').select('*').eq('account_id', id).order('started_at', { ascending: false }),
      ]);

      setAccount(acc);
      setIncome(txIncome || []);
      setExpenses(txExpense || []);
      setCard(cc);
      setInvestments(invs || []);

      if (cc) {
        const { data: mvs } = await supabase.from('card_movements').select('*').eq('card_id', cc.id).order('date', { ascending: false });
        setCardMvs(mvs || []);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[#8888AA]">Cargando...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8">
        <p className="text-[#FF6B6B]">Cuenta no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[#252540] text-[#8888AA] hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{account.name}</h1>
          <p className="text-[#8888AA] text-sm mt-0.5">
            {account.provider && `${account.provider} · `}
            Saldo: <span className="text-white font-semibold">{fmt(Number(account.balance))}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2A2A45] pb-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-[#7B68EE] text-white'
                : 'border-transparent text-[#8888AA] hover:text-white'
            }`}
          >
            <span className={tab === t.key ? 'text-[#7B68EE]' : ''}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'income'      && <IncomeTab transactions={income} />}
      {tab === 'expense'     && <ExpenseTab transactions={expenses} />}
      {tab === 'card'        && <CardTab card={card} movements={cardMvs} />}
      {tab === 'investments' && <InvestmentsTab investments={investments} />}
    </div>
  );
}

// ─── Tab: Ingresos ────────────────────────────────────────────────────────────

function IncomeTab({ transactions }: { transactions: Transaction[] }) {
  const total = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const byCategory = groupByCategory(transactions);

  return (
    <div className="space-y-6">
      <SummaryCard amount={total} label="Total ingresos" color="text-[#00D4AA]" bg="bg-[#00D4AA]/10" icon={<TrendingUp size={20} />} />
      {byCategory.length > 0 && <CategoryBreakdown items={byCategory} total={total} />}
      <TransactionTable transactions={transactions} type="income" />
    </div>
  );
}

// ─── Tab: Gastos ──────────────────────────────────────────────────────────────

function ExpenseTab({ transactions }: { transactions: Transaction[] }) {
  const total = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const byCategory = groupByCategory(transactions);

  return (
    <div className="space-y-6">
      <SummaryCard amount={total} label="Total gastos" color="text-[#FF6B6B]" bg="bg-[#FF6B6B]/10" icon={<TrendingDown size={20} />} />
      {byCategory.length > 0 && <CategoryBreakdown items={byCategory} total={total} />}
      <TransactionTable transactions={transactions} type="expense" />
    </div>
  );
}

// ─── Tab: Tarjeta ─────────────────────────────────────────────────────────────

function CardTab({ card, movements }: { card: CreditCard | null; movements: CardMovement[] }) {
  if (!card) {
    return (
      <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-16 text-center">
        <CreditCardIcon size={40} className="text-[#2A2A45] mx-auto mb-4" />
        <p className="text-[#8888AA]">No hay tarjeta de crédito asociada a esta cuenta</p>
      </div>
    );
  }

  const totalARS = movements.filter(m => m.currency === 'ARS').reduce((s, m) => s + Number(m.amount), 0);
  const totalUSD = movements.filter(m => m.currency === 'USD').reduce((s, m) => s + Number(m.amount), 0);

  return (
    <div className="space-y-6">
      {/* Resumen tarjeta */}
      <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-white font-bold text-lg">{card.brand} {card.product}</p>
            <p className="text-[#8888AA] text-sm mt-0.5">•••• {card.last_digits}</p>
            {card.holder && <p className="text-[#8888AA] text-xs mt-1">{card.holder}</p>}
          </div>
          <CreditCardIcon size={32} className="text-[#7B68EE]" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Consumo ARS', value: fmt(Number(card.consumption_ars)) },
            { label: 'Consumo USD', value: `USD ${Number(card.consumption_usd).toFixed(2)}` },
            { label: 'Pago mínimo', value: fmt(Number(card.min_payment)) },
            { label: 'Disponible ARS', value: fmt(Number(card.available_ars)) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#252540] rounded-xl p-4">
              <p className="text-[#8888AA] text-xs mb-1">{label}</p>
              <p className="text-white font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-6 text-sm border-t border-[#2A2A45] pt-4">
          {card.closing_date && (
            <p className="text-[#8888AA]">Cierre: <span className="text-white">{card.closing_date}</span></p>
          )}
          {card.due_date && (
            <p className="text-[#8888AA]">Vencimiento: <span className="text-white">{fmtDate(card.due_date)}</span></p>
          )}
        </div>
      </div>

      {/* Totales del período */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-5 text-center">
          <p className="text-[#8888AA] text-xs mb-2">ARS este período</p>
          <p className="text-white text-xl font-bold">{fmt(totalARS)}</p>
        </div>
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-5 text-center">
          <p className="text-[#8888AA] text-xs mb-2">USD este período</p>
          <p className="text-white text-xl font-bold">USD {totalUSD.toFixed(2)}</p>
        </div>
      </div>

      {/* Lista de consumos */}
      <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2A2A45]">
          <h3 className="text-white font-semibold">Consumos ({movements.length})</h3>
        </div>
        {movements.length === 0 ? (
          <p className="text-[#8888AA] text-sm text-center py-12">Sin consumos registrados</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2A2A45]">
                {['Comercio', 'Fecha', 'Cuotas', 'Monto'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-[#8888AA] text-xs font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-b border-[#2A2A45] last:border-0 hover:bg-[#252540] transition-colors">
                  <td className="px-6 py-3 text-white text-sm font-medium">{m.merchant}</td>
                  <td className="px-6 py-3 text-[#8888AA] text-sm">{fmtDate(m.date)}</td>
                  <td className="px-6 py-3">
                    {m.installment ? (
                      <span className="text-xs bg-[#7B68EE]/20 text-[#9B8FFF] px-2 py-1 rounded-lg">Cuota {m.installment}</span>
                    ) : (
                      <span className="text-[#55556A] text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-[#FF6B6B] text-sm font-semibold">
                    {m.currency === 'USD' ? `USD ${Number(m.amount).toFixed(2)}` : fmt(Number(m.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Inversiones ─────────────────────────────────────────────────────────

function InvestmentsTab({ investments }: { investments: Investment[] }) {
  const totalCapital = investments.reduce((s, i) => s + Number(i.initial_amount), 0);
  const totalGain    = investments.reduce((s, i) => s + Number(i.gain_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-5 text-center">
          <p className="text-[#8888AA] text-xs mb-2">Capital invertido</p>
          <p className="text-white text-xl font-bold">{fmt(totalCapital)}</p>
        </div>
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-5 text-center">
          <p className="text-[#8888AA] text-xs mb-2">Ganancia estimada</p>
          <p className="text-[#00D4AA] text-xl font-bold">{fmt(totalGain)}</p>
        </div>
      </div>

      {investments.length === 0 ? (
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-16 text-center">
          <Landmark size={40} className="text-[#2A2A45] mx-auto mb-4" />
          <p className="text-[#8888AA]">Sin inversiones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {investments.map(inv => {
            const daysLeft = inv.maturity_date
              ? Math.ceil((new Date(inv.maturity_date).getTime() - Date.now()) / 86400000)
              : null;

            return (
              <div key={inv.id} className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-white font-semibold">{inv.name}</p>
                    {inv.tna != null && (
                      <p className="text-[#8888AA] text-sm mt-1">TNA {inv.tna}% · {inv.term_days} días</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">{fmt(Number(inv.initial_amount))}</p>
                    {inv.gain_amount != null && (
                      <p className="text-[#00D4AA] text-sm font-semibold mt-0.5">+{fmt(Number(inv.gain_amount))}</p>
                    )}
                  </div>
                </div>

                {inv.maturity_date && (
                  <div className="flex items-center justify-between pt-4 border-t border-[#2A2A45]">
                    <p className="text-[#8888AA] text-sm">Vence {fmtDate(inv.maturity_date)}</p>
                    {daysLeft != null && (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        daysLeft <= 7
                          ? 'bg-[#FFB347]/20 text-[#FFB347]'
                          : 'bg-[#7B68EE]/20 text-[#9B8FFF]'
                      }`}>
                        {daysLeft > 0 ? `${daysLeft} días` : 'Vencido'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Componentes compartidos ──────────────────────────────────────────────────

function SummaryCard({ amount, label, color, bg, icon }: {
  amount: number; label: string; color: string; bg: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-6 flex items-center gap-5">
      <div className={`${bg} ${color} p-3 rounded-xl`}>{icon}</div>
      <div>
        <p className="text-[#8888AA] text-sm">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{fmt(amount)}</p>
      </div>
    </div>
  );
}

function groupByCategory(transactions: Transaction[]) {
  const map: Record<string, { name: string; color: string; total: number }> = {};
  transactions.forEach(t => {
    const id = t.category?.id ?? 'sin-categoria';
    if (!map[id]) map[id] = { name: t.category?.name ?? 'Sin categoría', color: t.category?.color ?? '#55556A', total: 0 };
    map[id].total += Number(t.amount);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function CategoryBreakdown({ items, total }: { items: { name: string; color: string; total: number }[]; total: number }) {
  return (
    <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-6">
      <h3 className="text-white font-semibold mb-4">Por categoría</h3>
      <div className="space-y-3">
        {items.map(item => {
          const pct = total > 0 ? (item.total / total) * 100 : 0;
          return (
            <div key={item.name} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[#8888AA] text-sm w-36 truncate">{item.name}</span>
              <div className="flex-1 bg-[#252540] rounded-full h-2 overflow-hidden">
                <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color + '99' }} />
              </div>
              <span className="text-white text-sm font-semibold w-28 text-right">{fmt(item.total)}</span>
              <span className="text-[#8888AA] text-xs w-10 text-right">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransactionTable({ transactions, type }: { transactions: Transaction[]; type: 'income' | 'expense' }) {
  const color = type === 'income' ? 'text-[#00D4AA]' : 'text-[#FF6B6B]';
  const sign  = type === 'income' ? '+' : '-';

  return (
    <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#2A2A45]">
        <h3 className="text-white font-semibold">Movimientos ({transactions.length})</h3>
      </div>
      {transactions.length === 0 ? (
        <p className="text-[#8888AA] text-sm text-center py-12">Sin movimientos</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2A45]">
              {['Descripción', 'Categoría', 'Fecha', 'Monto'].map(h => (
                <th key={h} className="text-left px-6 py-3 text-[#8888AA] text-xs font-medium uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-b border-[#2A2A45] last:border-0 hover:bg-[#252540] transition-colors">
                <td className="px-6 py-3 text-white text-sm max-w-xs truncate">{t.description || '—'}</td>
                <td className="px-6 py-3">
                  <span className="text-xs bg-[#252540] text-[#8888AA] px-2 py-1 rounded-lg">
                    {t.category?.name || '—'}
                  </span>
                </td>
                <td className="px-6 py-3 text-[#8888AA] text-sm">{fmtDate(t.date)}</td>
                <td className={`px-6 py-3 text-sm font-semibold ${color}`}>
                  {sign}{fmt(Number(t.amount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
