'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter }        from 'next/navigation';
import { supabase }                    from '@/lib/supabase';
import { Account, Transaction, CreditCard, CardMovement, Investment } from '@/lib/types';
import {
  ArrowLeft, TrendingUp, TrendingDown, CreditCard as CreditCardIcon,
  Landmark, X, RefreshCw, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, Calendar,
} from 'lucide-react';

type Tab = 'income' | 'expense' | 'card' | 'investments';

const PAGE_SIZE = 10;

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'income',      label: 'Ingresos',   icon: <TrendingUp size={15} /> },
  { key: 'expense',     label: 'Gastos',      icon: <TrendingDown size={15} /> },
  { key: 'card',        label: 'Tarjeta',     icon: <CreditCardIcon size={15} /> },
  { key: 'investments', label: 'Inversiones', icon: <Landmark size={15} /> },
];

const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAYS_ES     = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

const fmt = (n: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

const toIso = (d: Date) => d.toISOString().split('T')[0];
const todayIso = toIso(new Date());

// ─── DateRangePicker ──────────────────────────────────────────────────────────

type DateRange = { from: string; to: string } | null;

function applyRangeFilter<T extends { date: string }>(items: T[], range: DateRange): T[] {
  if (!range) return items;
  return items.filter(t => t.date >= range.from && t.date <= range.to);
}

function applyYearMonth<T extends { date: string }>(items: T[], year: string, month: string): T[] {
  return items.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    if (year  && d.getFullYear().toString()      !== year)  return false;
    if (month && (d.getMonth() + 1).toString()   !== month) return false;
    return true;
  });
}

function uniqueYears(items: { date: string }[]) {
  return [...new Set(items.map(t => new Date(t.date + 'T00:00:00').getFullYear()))].sort((a, b) => b - a);
}

function uniqueMonths(items: { date: string }[], year: string) {
  return [...new Set(
    items
      .filter(t => !year || new Date(t.date + 'T00:00:00').getFullYear().toString() === year)
      .map(t => new Date(t.date + 'T00:00:00').getMonth() + 1),
  )].sort((a, b) => a - b);
}

type CalView = 'days' | 'months' | 'years';

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const now = new Date();
  const [open, setOpen]         = useState(false);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [calView, setCalView]   = useState<CalView>('days');
  const [pending, setPending]   = useState<string | null>(null); // first click waiting for second
  const [hover, setHover]       = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPending(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function handleDayClick(iso: string) {
    if (!pending) {
      setPending(iso);
      onChange({ from: iso, to: iso });
    } else {
      const [from, to] = iso < pending ? [iso, pending] : [pending, iso];
      onChange({ from, to });
      setPending(null);
      setOpen(false);
    }
  }

  function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
  function getFirstWeekday(y: number, m: number) {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1; // Monday-first
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstWd     = getFirstWeekday(viewYear, viewMonth);
  const cells: string[] = [];
  for (let i = 0; i < firstWd; i++) cells.push('');
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(toIso(new Date(viewYear, viewMonth, d)));

  function dayStyle(iso: string) {
    if (!iso) return '';
    const effectiveFrom = pending
      ? (hover && hover < pending ? hover : pending)
      : value?.from;
    const effectiveTo = pending
      ? (hover && hover >= pending ? hover : pending)
      : value?.to;

    const isStart = iso === effectiveFrom;
    const isEnd   = iso === effectiveTo && effectiveTo !== effectiveFrom;
    const inRange = effectiveFrom && effectiveTo && iso > effectiveFrom && iso < effectiveTo;
    const isToday = iso === todayIso;

    if (isStart || isEnd)
      return 'bg-[#7B68EE] text-white font-bold rounded-lg';
    if (inRange)
      return 'bg-[#7B68EE]/20 text-white rounded-lg';
    if (isToday)
      return 'text-[#9B8FFF] font-semibold hover:bg-[#252540] rounded-lg';
    return 'text-[#8888AA] hover:bg-[#252540] hover:text-white rounded-lg';
  }

  // Trigger label
  let label = 'Seleccionar fechas';
  if (value) {
    label = value.from === value.to
      ? fmtDate(value.from)
      : `${fmtDate(value.from)} — ${fmtDate(value.to)}`;
  }
  if (pending) label = `Desde ${fmtDate(pending)}…`;

  // Years range: 10 years centered around current
  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setCalView('days'); }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
          value
            ? 'bg-[#7B68EE]/10 border-[#7B68EE] text-white'
            : 'bg-[#252540] border-[#2A2A45] text-[#8888AA] hover:text-white'
        }`}
      >
        <Calendar size={14} />
        <span>{label}</span>
        {value && (
          <span
            role="button"
            aria-label="Limpiar fechas"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange(null); setPending(null); }}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(null), setPending(null))}
            className="ml-1 text-[#8888AA] hover:text-white cursor-pointer"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-[#1A1A2E] border border-[#2A2A45] rounded-2xl p-4 shadow-2xl w-72">

          {/* ── Days view ── */}
          {calView === 'days' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" aria-label="Mes anterior" onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-[#252540] text-[#8888AA] hover:text-white transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setCalView('months')}
                    className="text-white font-semibold text-sm hover:text-[#9B8FFF] transition-colors px-1">
                    {MONTHS_FULL[viewMonth]}
                  </button>
                  <button type="button" onClick={() => setCalView('years')}
                    className="text-white font-semibold text-sm hover:text-[#9B8FFF] transition-colors px-1">
                    {viewYear}
                  </button>
                </div>
                <button type="button" aria-label="Mes siguiente" onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-[#252540] text-[#8888AA] hover:text-white transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_ES.map(d => (
                  <div key={d} className="text-center text-[#55556A] text-xs py-1 font-medium">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((iso, i) =>
                  iso === '' ? (
                    <div key={i} />
                  ) : (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => handleDayClick(iso)}
                      onMouseEnter={() => pending && setHover(iso)}
                      onMouseLeave={() => setHover(null)}
                      className={`text-xs py-1.5 text-center transition-colors ${dayStyle(iso)}`}
                    >
                      {new Date(iso + 'T00:00:00').getDate()}
                    </button>
                  ),
                )}
              </div>

              {pending && (
                <p className="text-[#8888AA] text-xs text-center mt-3">
                  Hacé clic en otro día para definir el rango
                </p>
              )}
            </>
          )}

          {/* ── Months view ── */}
          {calView === 'months' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" aria-label="Año anterior" onClick={() => setViewYear(y => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-[#252540] text-[#8888AA] hover:text-white transition-colors">
                  <ChevronLeft size={15} />
                </button>
                <button type="button" onClick={() => setCalView('years')}
                  className="text-white font-semibold text-sm hover:text-[#9B8FFF] transition-colors">
                  {viewYear}
                </button>
                <button type="button" aria-label="Año siguiente" onClick={() => setViewYear(y => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-[#252540] text-[#8888AA] hover:text-white transition-colors">
                  <ChevronRight size={15} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_FULL.map((_, i) => (
                  <button key={i} type="button"
                    onClick={() => { setViewMonth(i); setCalView('days'); }}
                    className={`text-xs py-2 rounded-xl transition-colors ${
                      i === viewMonth && viewYear === now.getFullYear()
                        ? 'bg-[#7B68EE] text-white font-bold'
                        : 'bg-[#252540] text-[#8888AA] hover:text-white'
                    }`}
                  >
                    {MONTHS_SHORT[i]}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Years view ── */}
          {calView === 'years' && (
            <>
              <p className="text-[#8888AA] text-xs text-center mb-3 font-medium uppercase tracking-wide">Año</p>
              <div className="grid grid-cols-3 gap-2">
                {years.map(y => (
                  <button key={y} type="button"
                    onClick={() => { setViewYear(y); setCalView('months'); }}
                    className={`text-xs py-2 rounded-xl transition-colors ${
                      y === viewYear ? 'bg-[#7B68EE] text-white font-bold' : 'bg-[#252540] text-[#8888AA] hover:text-white'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Footer with selected range */}
          {value && calView === 'days' && (
            <div className="mt-3 pt-3 border-t border-[#2A2A45] flex items-center justify-between">
              <span className="text-[#8888AA] text-xs">
                {value.from === value.to ? fmtDate(value.from) : `${fmtDate(value.from)} → ${fmtDate(value.to)}`}
              </span>
              <button type="button" onClick={() => { onChange(null); setPending(null); }}
                className="flex items-center gap-1 text-xs text-[#8888AA] hover:text-white transition-colors">
                <X size={11} /> Limpiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CategoryDropdown ─────────────────────────────────────────────────────────

type CategoryOption = { id: string; name: string; color: string };

function CategoryDropdown({
  categories,
  selected,
  onSelect,
}: {
  categories: CategoryOption[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#8888AA] text-xs font-medium whitespace-nowrap">Categoría</span>
      <select
        title="Categoría"
        value={selected}
        onChange={e => onSelect(e.target.value)}
        className="bg-[#252540] border border-[#2A2A45] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7B68EE] min-w-[160px]"
      >
        <option value="">Todas las categorías</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── YearMonthFilter ─────────────────────────────────────────────────────────

function YearMonthFilter({
  items,
  year,
  month,
  onYearChange,
  onMonthChange,
}: {
  items: { date: string }[];
  year: string;
  month: string;
  onYearChange: (y: string) => void;
  onMonthChange: (m: string) => void;
}) {
  const years  = uniqueYears(items);
  const months = uniqueMonths(items, year);
  if (years.length === 0) return null;

  const selectCls = 'bg-[#252540] border border-[#2A2A45] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#7B68EE]';

  return (
    <>
      <select
        title="Año"
        value={year}
        onChange={e => { onYearChange(e.target.value); onMonthChange(''); }}
        className={selectCls}
      >
        <option value="">Año</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        title="Mes"
        value={month}
        onChange={e => onMonthChange(e.target.value)}
        className={selectCls}
      >
        <option value="">Mes</option>
        {months.map(m => <option key={m} value={m}>{MONTHS_SHORT[m - 1]}</option>)}
      </select>
    </>
  );
}

// ─── InlineCategoryPicker ────────────────────────────────────────────────────

function InlineCategoryPicker({
  current,
  categories,
  onAssign,
  onCreateNew,
  onHide,
}: {
  current: CategoryOption | null;
  categories: CategoryOption[];
  onAssign: (cat: CategoryOption | null) => void;
  onCreateNew: () => void;
  onHide?: (catId: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref     = useRef<HTMLDivElement>(null);
  const btnRef  = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 260);
    }
    setOpen(o => !o);
  }

  const dropPos = dropUp
    ? 'bottom-full mb-1'
    : 'top-full mt-1';

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="text-xs bg-[#252540] hover:bg-[#2A2A45] text-[#8888AA] hover:text-white px-2 py-1 rounded-lg transition-colors"
      >
        {current ? (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: current.color }} />
            {current.name}
          </span>
        ) : (
          '+ Asignar'
        )}
      </button>

      {open && (
        <div className={`absolute ${dropPos} left-0 z-50 bg-[#1A1A2E] border border-[#2A2A45] rounded-xl shadow-xl w-52 py-1 max-h-56 overflow-y-auto`}>
          {current && (
            <button type="button" onClick={() => { onAssign(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-[#FF6B6B] hover:bg-[#252540] transition-colors flex items-center gap-2">
              <X size={11} /> Quitar categoría
            </button>
          )}
          {categories.map(cat => (
            <div key={cat.id} className="group flex items-center hover:bg-[#252540] transition-colors">
              <button type="button"
                onClick={() => { onAssign(cat); setOpen(false); }}
                className={`flex-1 text-left px-3 py-2 text-xs flex items-center gap-2 ${
                  current?.id === cat.id ? 'text-white font-medium' : 'text-[#8888AA]'
                }`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
              {onHide && (
                <button type="button"
                  title="Ocultar categoría"
                  onClick={e => { e.stopPropagation(); onHide(cat.id); setOpen(false); }}
                  className="opacity-0 group-hover:opacity-100 pr-3 py-2 text-[#55556A] hover:text-[#FF6B6B] transition-all">
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          <div className="border-t border-[#2A2A45] mt-1 pt-1">
            <button type="button" onClick={() => { setOpen(false); onCreateNew(); }}
              className="w-full text-left px-3 py-2 text-xs text-[#7B68EE] hover:bg-[#252540] transition-colors">
              + Nueva categoría
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CreateCategoryModal ──────────────────────────────────────────────────────

const PRESET_COLORS = ['#7B68EE','#00D4AA','#FF6B6B','#FFB347','#4ECDC4','#A8E6CF','#FF8B94','#9B8FFF'];

function CreateCategoryModal({ onCreated, onClose }: {
  onCreated: (cat: CategoryOption) => void;
  onClose: () => void;
}) {
  const [name, setName]     = useState('');
  const [type, setType]     = useState<'expense' | 'income'>('expense');
  const [color, setColor]   = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error: err } = await supabase
      .from('categories')
      .insert({ user_id: user.id, name: name.trim(), type, color })
      .select('id,name,color')
      .single();
    setSaving(false);
    if (err || !data) { setError(err?.message ?? 'Error al crear'); return; }
    onCreated({ id: data.id, name: data.name, color: data.color ?? color });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A2E] border border-[#2A2A45] rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Nueva categoría</h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-[#8888AA] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#8888AA] text-xs mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Supermercado"
              autoFocus
              className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#7B68EE] placeholder:text-[#55556A]"
            />
          </div>

          <div>
            <label className="block text-[#8888AA] text-xs mb-1.5">Tipo</label>
            <div className="flex gap-2">
              {(['expense', 'income'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    type === t ? 'bg-[#7B68EE] text-white' : 'bg-[#252540] text-[#8888AA] hover:text-white'
                  }`}>
                  {t === 'expense' ? 'Gasto' : 'Ingreso'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[#8888AA] text-xs mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {error && <p className="text-[#FF6B6B] text-xs">{error}</p>}

          <button type="submit" disabled={saving || !name.trim()}
            className="w-full bg-[#7B68EE] hover:bg-[#9B8FFF] disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
            {saving ? 'Guardando...' : 'Crear categoría'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── SyncButton ───────────────────────────────────────────────────────────────

type SyncState = 'idle' | 'loading' | 'success' | 'error';

function SyncButton({ state, onClick }: { state: SyncState; onClick: () => void }) {
  const isLoading = state === 'loading';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
        isLoading
          ? 'bg-[#252540] text-[#55556A] cursor-not-allowed'
          : 'bg-[#7B68EE]/20 text-[#9B8FFF] hover:bg-[#7B68EE]/30'
      }`}
    >
      <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
      {isLoading ? 'Sincronizando...' : 'Sincronizar Galicia'}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [account, setAccount]         = useState<Account | null>(null);
  const [income, setIncome]           = useState<Transaction[]>([]);
  const [expenses, setExpenses]       = useState<Transaction[]>([]);
  const [card, setCard]               = useState<CreditCard | null>(null);
  const [cardMvs, setCardMvs]         = useState<CardMovement[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [tab, setTab]                 = useState<Tab>('income');
  const [loading, setLoading]         = useState(true);

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
        const { data: mvs } = await supabase.from('card_movements').select('*, category:categories(id,name,color)').eq('card_id', cc.id).order('date', { ascending: false });
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
        <button type="button" aria-label="Volver" onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-[#252540] text-[#8888AA] hover:text-white transition-colors">
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
            type="button"
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
      {tab === 'card'        && <CardTab card={card} movements={cardMvs} accountId={id} />}
      {tab === 'investments' && <InvestmentsTab investments={investments} />}
    </div>
  );
}

// ─── Tab: Ingresos ────────────────────────────────────────────────────────────

function IncomeTab({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange]         = useState<DateRange>(null);
  const [year, setYear]           = useState('');
  const [month, setMonth]         = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [allCats, setAllCats]     = useState<CategoryOption[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: cats }, { data: hidden }] = await Promise.all([
        supabase.from('categories').select('id,name,color').or(`user_id.eq.${user.id},user_id.is.null`).eq('type', 'income').eq('is_active', true).order('name'),
        supabase.from('user_hidden_categories').select('category_id').eq('user_id', user.id),
      ]);
      const hiddenIds = new Set((hidden ?? []).map((h: { category_id: string }) => h.category_id));
      setAllCats((cats ?? []).filter(c => !hiddenIds.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color ?? '#55556A' })));
    });
  }, []);

  async function handleHide(catId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_hidden_categories').upsert({ user_id: user.id, category_id: catId });
    setAllCats(prev => prev.filter(c => c.id !== catId));
  }

  const afterYM    = applyYearMonth(transactions, year, month);
  const afterRange = applyRangeFilter(afterYM, range);
  const filtered   = catFilter
    ? afterRange.filter(t => (t.category?.id ?? 'sin-categoria') === catFilter)
    : afterRange;

  const total      = filtered.reduce((s, t) => s + Number(t.amount), 0);
  const byCategory = groupByCategory(filtered);
  const filterCats = buildCategoryOptions(transactions);

  return (
    <div className="space-y-4">
      <FilterBar>
        <YearMonthFilter items={transactions} year={year} month={month} onYearChange={setYear} onMonthChange={setMonth} />
        <DateRangePicker value={range} onChange={setRange} />
        <CategoryDropdown categories={filterCats} selected={catFilter} onSelect={setCatFilter} />
      </FilterBar>
      <SummaryCard amount={total} label="Total ingresos" color="text-[#00D4AA]" bg="bg-[#00D4AA]/10" icon={<TrendingUp size={20} />} />
      {byCategory.length > 0 && <CategoryBreakdown items={byCategory} total={total} />}
      <TransactionTable
        transactions={filtered}
        type="income"
        categories={allCats}
        onCategoryCreated={cat => setAllCats(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        onHideCategory={handleHide}
      />
    </div>
  );
}

// ─── Tab: Gastos ──────────────────────────────────────────────────────────────

function ExpenseTab({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange]         = useState<DateRange>(null);
  const [year, setYear]           = useState('');
  const [month, setMonth]         = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [allCats, setAllCats]     = useState<CategoryOption[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const [{ data: cats }, { data: hidden }] = await Promise.all([
        supabase.from('categories').select('id,name,color').or(`user_id.eq.${user.id},user_id.is.null`).eq('type', 'expense').eq('is_active', true).order('name'),
        supabase.from('user_hidden_categories').select('category_id').eq('user_id', user.id),
      ]);
      const hiddenIds = new Set((hidden ?? []).map((h: { category_id: string }) => h.category_id));
      setAllCats((cats ?? []).filter(c => !hiddenIds.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color ?? '#55556A' })));
    });
  }, []);

  async function handleHide(catId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_hidden_categories').upsert({ user_id: user.id, category_id: catId });
    setAllCats(prev => prev.filter(c => c.id !== catId));
  }

  const afterYM    = applyYearMonth(transactions, year, month);
  const afterRange = applyRangeFilter(afterYM, range);
  const filtered   = catFilter
    ? afterRange.filter(t => (t.category?.id ?? 'sin-categoria') === catFilter)
    : afterRange;

  const total      = filtered.reduce((s, t) => s + Number(t.amount), 0);
  const byCategory = groupByCategory(filtered);
  const filterCats = buildCategoryOptions(transactions);

  return (
    <div className="space-y-4">
      <FilterBar>
        <YearMonthFilter items={transactions} year={year} month={month} onYearChange={setYear} onMonthChange={setMonth} />
        <DateRangePicker value={range} onChange={setRange} />
        <CategoryDropdown categories={filterCats} selected={catFilter} onSelect={setCatFilter} />
      </FilterBar>
      <SummaryCard amount={total} label="Total gastos" color="text-[#FF6B6B]" bg="bg-[#FF6B6B]/10" icon={<TrendingDown size={20} />} />
      {byCategory.length > 0 && <CategoryBreakdown items={byCategory} total={total} />}
      <TransactionTable
        transactions={filtered}
        type="expense"
        categories={allCats}
        onCategoryCreated={cat => setAllCats(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        onHideCategory={handleHide}
      />
    </div>
  );
}

// ─── Tab: Tarjeta ─────────────────────────────────────────────────────────────

function CardTab({ card, movements, accountId }: { card: CreditCard | null; movements: CardMovement[]; accountId: string }) {
  const [range, setRange]           = useState<DateRange>(null);
  const [year, setYear]             = useState('');
  const [month, setMonth]           = useState('');
  const [catFilter, setCatFilter]   = useState('');
  const [syncState, setSyncState]   = useState<SyncState>('idle');
  const [syncMsg, setSyncMsg]       = useState('');
  const [allCats, setAllCats]       = useState<CategoryOption[]>([]);
  const [catOverrides, setCatOverrides] = useState<Record<string, CategoryOption | null>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage]             = useState(0);

  useEffect(() => {
    async function loadCats() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: cats }, { data: hidden }] = await Promise.all([
        supabase.from('categories').select('id,name,color').or(`user_id.eq.${user.id},user_id.is.null`).eq('is_active', true).order('name'),
        supabase.from('user_hidden_categories').select('category_id').eq('user_id', user.id),
      ]);
      const hiddenIds = new Set((hidden ?? []).map((h: { category_id: string }) => h.category_id));
      setAllCats((cats ?? []).filter(c => !hiddenIds.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color ?? '#55556A' })));
    }
    loadCats();
  }, []);

  async function handleHide(catId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('user_hidden_categories').upsert({ user_id: user.id, category_id: catId });
    setAllCats(prev => prev.filter(c => c.id !== catId));
  }

  async function handleAssign(movementId: string, cat: CategoryOption | null) {
    await supabase.from('card_movements').update({ category_id: cat?.id ?? null }).eq('id', movementId);
    setCatOverrides(prev => ({ ...prev, [movementId]: cat }));
  }

  function getCategory(m: CardMovement): CategoryOption | null {
    if (catOverrides[m.id] !== undefined) return catOverrides[m.id];
    if (m.category) return { id: m.category.id, name: m.category.name, color: m.category.color ?? '#55556A' };
    return null;
  }

  async function handleSync() {
    setSyncState('loading');
    setSyncMsg('');
    try {
      const res  = await fetch('/api/scrape/galicia', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ account_id: accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      setSyncState('success');
      setSyncMsg(`Tarjeta ····${data.cardLastDigits} · ${data.movementsCount} movimientos sincronizados`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      setSyncState('error');
      setSyncMsg(err instanceof Error ? err.message : 'Error al sincronizar');
    }
  }

  if (!card) {
    return (
      <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-16 text-center space-y-4">
        <CreditCardIcon size={40} className="text-[#2A2A45] mx-auto" />
        <p className="text-[#8888AA]">No hay tarjeta de crédito asociada a esta cuenta</p>
        {syncMsg && (
          <p className={`text-sm ${syncState === 'error' ? 'text-[#FF6B6B]' : 'text-[#00D4AA]'}`}>{syncMsg}</p>
        )}
        <div className="flex justify-center">
          <SyncButton state={syncState} onClick={handleSync} />
        </div>
      </div>
    );
  }

  const afterYM    = applyYearMonth(movements, year, month);
  const afterRange = applyRangeFilter(afterYM, range);
  const filtered   = catFilter
    ? afterRange.filter(m => (getCategory(m)?.id ?? 'sin-categoria') === catFilter)
    : afterRange;
  const totalARS   = filtered.filter(m => m.currency === 'ARS').reduce((s, m) => s + Number(m.amount), 0);
  const totalUSD   = filtered.filter(m => m.currency === 'USD').reduce((s, m) => s + Number(m.amount), 0);
  const pagedMvs   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
          <div className="flex items-center gap-3">
            <SyncButton state={syncState} onClick={handleSync} />
            <CreditCardIcon size={32} className="text-[#7B68EE]" />
          </div>
        </div>

        {syncMsg && (
          <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl mb-4 ${
            syncState === 'success' ? 'bg-[#00D4AA]/10 text-[#00D4AA]' : 'bg-[#FF6B6B]/10 text-[#FF6B6B]'
          }`}>
            {syncState === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {syncMsg}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Consumo ARS',    value: fmt(Number(card.consumption_ars)) },
            { label: 'Consumo USD',    value: `USD ${Number(card.consumption_usd).toFixed(2)}` },
            { label: 'Pago mínimo',    value: fmt(Number(card.min_payment)) },
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

      {/* Filtros */}
      {movements.length > 0 && (
        <FilterBar>
          <YearMonthFilter
            items={movements}
            year={year}
            month={month}
            onYearChange={v => { setYear(v); setPage(0); }}
            onMonthChange={v => { setMonth(v); setPage(0); }}
          />
          <DateRangePicker value={range} onChange={v => { setRange(v); setPage(0); }} />
          <CategoryDropdown categories={allCats} selected={catFilter} onSelect={v => { setCatFilter(v); setPage(0); }} />
        </FilterBar>
      )}

      {/* Totales del período filtrado */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-5 text-center">
          <p className="text-[#8888AA] text-xs mb-2">ARS período filtrado</p>
          <p className="text-white text-xl font-bold">{fmt(totalARS)}</p>
        </div>
        <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-5 text-center">
          <p className="text-[#8888AA] text-xs mb-2">USD período filtrado</p>
          <p className="text-white text-xl font-bold">USD {totalUSD.toFixed(2)}</p>
        </div>
      </div>

      {/* Lista de consumos */}
      <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2A2A45]">
          <h3 className="text-white font-semibold">
            Consumos ({filtered.length}{filtered.length !== movements.length && ` de ${movements.length}`})
          </h3>
        </div>
        {filtered.length === 0 ? (
          <p className="text-[#8888AA] text-sm text-center py-12">Sin consumos para el período seleccionado</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A45]">
                  {['Comercio', 'Categoría', 'Fecha', 'Cuotas', 'Monto'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-[#8888AA] text-xs font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedMvs.map(m => (
                  <tr key={m.id} className="border-b border-[#2A2A45] last:border-0 hover:bg-[#252540] transition-colors">
                    <td className="px-6 py-3 text-white text-sm font-medium">{m.merchant}</td>
                    <td className="px-6 py-3">
                      <InlineCategoryPicker
                        current={getCategory(m)}
                        categories={allCats}
                        onAssign={cat => handleAssign(m.id, cat)}
                        onCreateNew={() => setShowCreate(true)}
                        onHide={handleHide}
                      />
                    </td>
                    <td className="px-6 py-3 text-[#8888AA] text-sm whitespace-nowrap">{fmtDate(m.date)}</td>
                    <td className="px-6 py-3">
                      {m.installment ? (
                        <span className="text-xs bg-[#7B68EE]/20 text-[#9B8FFF] px-2 py-1 rounded-lg whitespace-nowrap">Cuota {m.installment}</span>
                      ) : (
                        <span className="text-[#55556A] text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-[#FF6B6B] text-sm font-semibold whitespace-nowrap">
                      {m.currency === 'USD' ? `USD ${Number(m.amount).toFixed(2)}` : fmt(Number(m.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator page={page} total={filtered.length} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
          </>
        )}
      </div>

      {showCreate && (
        <CreateCategoryModal
          onCreated={cat => setAllCats(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))}
          onClose={() => setShowCreate(false)}
        />
      )}
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
                        daysLeft <= 7 ? 'bg-[#FFB347]/20 text-[#FFB347]' : 'bg-[#7B68EE]/20 text-[#9B8FFF]'
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

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] p-4">
      <div className="flex flex-wrap items-center gap-3">
        {children}
      </div>
    </div>
  );
}

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

function buildCategoryOptions(transactions: Transaction[]): CategoryOption[] {
  return [
    ...new Map(
      transactions.map(t => [
        t.category?.id ?? 'sin-categoria',
        {
          id:    t.category?.id    ?? 'sin-categoria',
          name:  t.category?.name  ?? 'Sin categoría',
          color: t.category?.color ?? '#55556A',
        },
      ]),
    ).values(),
  ];
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

// ─── Paginator ────────────────────────────────────────────────────────────────

function Paginator({ page, total, onPrev, onNext }: {
  page: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  const isFirst = page === 0;
  const isLast  = page >= totalPages - 1;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-[#2A2A45]">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#252540] text-[#8888AA] hover:text-white hover:bg-[#2A2A55] disabled:hover:bg-[#252540] disabled:hover:text-[#8888AA]"
      >
        <ChevronLeft size={15} /> Anterior
      </button>
      <span className="text-[#8888AA] text-sm font-medium">{page + 1} / {totalPages}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#252540] text-[#8888AA] hover:text-white hover:bg-[#2A2A55] disabled:hover:bg-[#252540] disabled:hover:text-[#8888AA]"
      >
        Siguiente <ChevronRight size={15} />
      </button>
    </div>
  );
}

function TransactionTable({ transactions, type, categories, onCategoryCreated, onHideCategory }: {
  transactions: Transaction[];
  type: 'income' | 'expense';
  categories: CategoryOption[];
  onCategoryCreated: (cat: CategoryOption) => void;
  onHideCategory?: (catId: string) => void;
}) {
  const [page, setPage]           = useState(0);
  const [overrides, setOverrides] = useState<Record<string, CategoryOption | null>>({});
  const [showCreate, setShowCreate] = useState(false);
  const color = type === 'income' ? 'text-[#00D4AA]' : 'text-[#FF6B6B]';
  const sign  = type === 'income' ? '+' : '-';

  const totalRef = useRef(transactions.length);
  if (transactions.length !== totalRef.current) {
    totalRef.current = transactions.length;
    if (page !== 0) setPage(0);
  }

  function getCategory(t: Transaction): CategoryOption | null {
    if (overrides[t.id] !== undefined) return overrides[t.id];
    if (t.category) return { id: t.category.id, name: t.category.name, color: t.category.color ?? '#55556A' };
    return null;
  }

  async function handleAssign(txId: string, cat: CategoryOption | null) {
    await supabase.from('transactions').update({ category_id: cat?.id ?? null }).eq('id', txId);
    setOverrides(prev => ({ ...prev, [txId]: cat }));
  }

  const paged = transactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="bg-[#1A1A2E] rounded-2xl border border-[#2A2A45] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2A2A45]">
          <h3 className="text-white font-semibold">Movimientos ({transactions.length})</h3>
        </div>
        {transactions.length === 0 ? (
          <p className="text-[#8888AA] text-sm text-center py-12">Sin movimientos</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2A2A45]">
                  {['Descripción', 'Categoría', 'Fecha', 'Monto'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-[#8888AA] text-xs font-medium uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(t => (
                  <tr key={t.id} className="border-b border-[#2A2A45] last:border-0 hover:bg-[#252540] transition-colors">
                    <td className="px-6 py-3 text-white text-sm">
                      <span className="block max-w-xs" title={t.description || undefined}>{t.description || '—'}</span>
                    </td>
                    <td className="px-6 py-3">
                      <InlineCategoryPicker
                        current={getCategory(t)}
                        categories={categories}
                        onAssign={cat => handleAssign(t.id, cat)}
                        onCreateNew={() => setShowCreate(true)}
                        onHide={onHideCategory}
                      />
                    </td>
                    <td className="px-6 py-3 text-[#8888AA] text-sm whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className={`px-6 py-3 text-sm font-semibold whitespace-nowrap ${color}`}>
                      {sign}{fmt(Number(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Paginator page={page} total={transactions.length} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
          </>
        )}
      </div>

      {showCreate && (
        <CreateCategoryModal
          onCreated={cat => { onCategoryCreated(cat); setShowCreate(false); }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
