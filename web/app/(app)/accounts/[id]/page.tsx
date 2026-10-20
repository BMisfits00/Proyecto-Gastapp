'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter }        from 'next/navigation';
import { supabase }                    from '@/lib/supabase';
import { Account, Transaction, CreditCard, CardMovement, Investment } from '@/lib/types';
import {
  ArrowLeft, TrendingUp, TrendingDown, CreditCard as CreditCardIcon,
  Landmark, X, RefreshCw, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, Calendar, Scale, Sparkles,
  Info, Search,
} from 'lucide-react';
import { ItemDetailModal } from './ItemDetailModal';
import { normalizeText } from '@/lib/categorizer';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';

type Tab = 'balance' | 'income' | 'expense' | 'card' | 'investments';

const PAGE_SIZE = 10;

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'balance',     label: 'Balance',     icon: <Scale size={16} /> },
  { key: 'income',      label: 'Ingresos',   icon: <TrendingUp size={16} /> },
  { key: 'expense',     label: 'Gastos',      icon: <TrendingDown size={16} /> },
  { key: 'card',        label: 'Tarjeta',     icon: <CreditCardIcon size={16} /> },
  { key: 'investments', label: 'Inversiones', icon: <Landmark size={16} /> },
];

const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAYS_ES     = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

const fmt = (n: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtUSD = (n: number) =>
  `USD ${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`;

const fmtDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateTime = (d: string) => {
  const date = new Date(d);
  const dateStr = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
};

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
  const currentYear = new Date().getFullYear();
  const txYears = items
    .map(t => new Date(t.date + 'T00:00:00').getFullYear())
    .filter(y => !isNaN(y));
  return [...new Set([currentYear, ...txYears])].sort((a, b) => b - a);
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type CalView = 'days' | 'months' | 'years';

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const now = new Date();
  const [open, setOpen]         = useState(false);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [calView, setCalView]   = useState<CalView>('days');
  const [pending, setPending]   = useState<string | null>(null);
  const [hover, setHover]       = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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
    return d === 0 ? 6 : d - 1;
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
      return 'bg-blue-600 text-white font-bold rounded-lg shadow-xs';
    if (inRange)
      return 'bg-blue-50 text-blue-700 rounded-lg';
    if (isToday)
      return 'text-blue-600 font-bold hover:bg-slate-100 rounded-lg';
    return 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg';
  }

  let label = 'Seleccionar fechas';
  if (value) {
    label = value.from === value.to
      ? fmtDate(value.from)
      : `${fmtDate(value.from)} — ${fmtDate(value.to)}`;
  }
  if (pending) label = `Desde ${fmtDate(pending)}…`;

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setCalView('days'); }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border font-medium transition-colors shadow-xs ${
          value
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <Calendar size={14} className={value ? 'text-blue-600' : 'text-slate-400'} />
        <span>{label}</span>
        {value && (
          <span
            role="button"
            aria-label="Limpiar fechas"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange(null); setPending(null); }}
            onKeyDown={e => e.key === 'Enter' && (e.stopPropagation(), onChange(null), setPending(null))}
            className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-slate-200 rounded-2xl p-4 shadow-xl w-72">
          {calView === 'days' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" aria-label="Mes anterior" onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setCalView('months')}
                    className="text-slate-900 font-semibold text-sm hover:text-blue-600 transition-colors px-1">
                    {MONTHS_FULL[viewMonth]}
                  </button>
                  <button type="button" onClick={() => setCalView('years')}
                    className="text-slate-900 font-semibold text-sm hover:text-blue-600 transition-colors px-1">
                    {viewYear}
                  </button>
                </div>
                <button type="button" aria-label="Mes siguiente" onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-1">
                {DAYS_ES.map(d => (
                  <div key={d} className="text-center text-slate-400 text-xs py-1 font-semibold">{d}</div>
                ))}
              </div>

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
                <p className="text-slate-500 text-xs text-center mt-3 font-medium">
                  Hacé clic en otro día para definir el rango
                </p>
              )}
            </>
          )}

          {calView === 'months' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" aria-label="Año anterior" onClick={() => setViewYear(y => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => setCalView('years')}
                  className="text-slate-900 font-semibold text-sm hover:text-blue-600 transition-colors">
                  {viewYear}
                </button>
                <button type="button" aria-label="Año siguiente" onClick={() => setViewYear(y => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MONTHS_FULL.map((_, i) => (
                  <button key={i} type="button"
                    onClick={() => { setViewMonth(i); setCalView('days'); }}
                    className={`text-xs py-2 rounded-xl font-medium transition-colors ${
                      i === viewMonth && viewYear === now.getFullYear()
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {MONTHS_SHORT[i]}
                  </button>
                ))}
              </div>
            </>
          )}

          {calView === 'years' && (
            <>
              <p className="text-slate-400 text-xs text-center mb-3 font-semibold uppercase tracking-wide">Seleccionar Año</p>
              <div className="grid grid-cols-3 gap-2">
                {years.map(y => (
                  <button key={y} type="button"
                    onClick={() => { setViewYear(y); setCalView('months'); }}
                    className={`text-xs py-2 rounded-xl font-medium transition-colors ${
                      y === viewYear ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          {value && calView === 'days' && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-slate-500 text-xs font-medium">
                {value.from === value.to ? fmtDate(value.from) : `${fmtDate(value.from)} → ${fmtDate(value.to)}`}
              </span>
              <button type="button" onClick={() => { onChange(null); setPending(null); }}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 font-medium transition-colors">
                <X size={12} /> Limpiar
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
      <span className="text-slate-500 text-xs font-semibold whitespace-nowrap">Categoría:</span>
      <select
        title="Categoría"
        value={selected}
        onChange={e => onSelect(e.target.value)}
        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-600 min-w-[160px] shadow-xs"
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
  onRangeChange,
}: {
  items: { date: string }[];
  year: string;
  month: string;
  onYearChange: (y: string) => void;
  onMonthChange: (m: string) => void;
  onRangeChange?: (r: DateRange) => void;
}) {
  const years = uniqueYears(items);
  if (years.length === 0) return null;

  const selectCls = 'bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-600 shadow-xs';

  const hasPeriod = Boolean(year || month);

  function handlePrev() {
    onRangeChange?.(null);
    let y = year ? parseInt(year, 10) : (years[0] ?? new Date().getFullYear());
    if (month) {
      let m = parseInt(month, 10) - 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      onYearChange(String(y));
      onMonthChange(String(m));
    } else {
      onYearChange(String(y - 1));
    }
  }

  function handleNext() {
    onRangeChange?.(null);
    let y = year ? parseInt(year, 10) : (years[0] ?? new Date().getFullYear());
    if (month) {
      let m = parseInt(month, 10) + 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      onYearChange(String(y));
      onMonthChange(String(m));
    } else {
      onYearChange(String(y + 1));
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {hasPeriod && (
        <button
          type="button"
          onClick={handlePrev}
          title="Período anterior"
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-xs transition-colors flex items-center justify-center shrink-0"
        >
          <ChevronLeft size={16} />
        </button>
      )}

      <select
        title="Año"
        value={year}
        onChange={e => { onYearChange(e.target.value); onMonthChange(''); onRangeChange?.(null); }}
        className={selectCls}
      >
        <option value="">Año</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        title="Mes"
        value={month}
        onChange={e => {
          const m = e.target.value;
          onMonthChange(m);
          if (m && !year && years.length > 0) {
            onYearChange(String(years[0]));
          }
          onRangeChange?.(null);
        }}
        className={selectCls}
      >
        <option value="">Mes</option>
        {ALL_MONTHS.map(m => (
          <option key={m} value={String(m)}>
            {MONTHS_SHORT[m - 1]}
          </option>
        ))}
      </select>

      {hasPeriod && (
        <button
          type="button"
          onClick={handleNext}
          title="Período posterior"
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-xs transition-colors flex items-center justify-center shrink-0"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
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
        className="text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium px-2.5 py-1 rounded-lg border border-slate-200/60 transition-colors"
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
        <div className={`absolute ${dropPos} left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl w-52 py-1 max-h-56 overflow-y-auto`}>
          {current && (
            <button type="button" onClick={() => { onAssign(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2 font-medium">
              <X size={12} /> Quitar categoría
            </button>
          )}
          {categories.map(cat => (
            <div key={cat.id} className="group flex items-center hover:bg-slate-50 transition-colors">
              <button type="button"
                onClick={() => { onAssign(cat); setOpen(false); }}
                className={`flex-1 text-left px-3 py-2 text-xs flex items-center gap-2 ${
                  current?.id === cat.id ? 'text-blue-600 font-semibold' : 'text-slate-700'
                }`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
              {onHide && (
                <button type="button"
                  title="Ocultar categoría"
                  onClick={e => { e.stopPropagation(); onHide(cat.id); setOpen(false); }}
                  className="opacity-0 group-hover:opacity-100 pr-3 py-2 text-slate-400 hover:text-rose-600 transition-all">
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button type="button" onClick={() => { setOpen(false); onCreateNew(); }}
              className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 font-medium transition-colors">
              + Nueva categoría
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CreateCategoryModal ──────────────────────────────────────────────────────

const PRESET_COLORS = ['#1E40AF','#10B981','#F59E0B','#EF4444','#6366F1','#06B6D4','#8B5CF6','#EC4899'];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl mx-4">
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
          <h3 className="text-slate-900 font-semibold text-lg">Nueva categoría</h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Supermercado"
              autoFocus
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-blue-600 placeholder:text-slate-400 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1.5">Tipo</label>
            <div className="flex gap-2">
              {(['expense', 'income'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    type === t ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {t === 'expense' ? 'Gasto' : 'Ingreso'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 text-xs font-semibold mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" aria-label={`Color ${c}`} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-blue-600 ring-offset-2' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}

          <button type="submit" disabled={saving || !name.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-xs">
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border shadow-xs ${
        isLoading
          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
          : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
      }`}
    >
      <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
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
  const [tab, setTab]                 = useState<Tab>('balance');
  const [filterYear, setFilterYear]   = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterRange, setFilterRange] = useState<DateRange>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading]         = useState(true);
  const [syncState, setSyncState]     = useState<SyncState>('idle');
  const [syncMsg, setSyncMsg]         = useState('');
  const [autoCatLoading, setAutoCatLoading] = useState(false);
  const [autoCatMsg, setAutoCatMsg]         = useState('');

  async function handleSync() {
    setSyncState('loading');
    setSyncMsg('');
    try {
      const res = await fetch('/api/scrape/galicia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      setSyncState('success');
      const txInfo = data.newTxCount !== undefined ? ` · ${data.newTxCount} transacciones` : '';
      setSyncMsg(`Sincronizado: Tarjeta ····${data.cardLastDigits} (${data.movementsCount} consumos)${txInfo}`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      setSyncState('error');
      setSyncMsg(err instanceof Error ? err.message : 'Error al sincronizar');
    }
  }

  async function handleAutoCategorize() {
    setAutoCatLoading(true);
    setAutoCatMsg('');
    try {
      const res = await fetch('/api/categories/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al auto-categorizar');
      setAutoCatMsg(`¡Listo! Se categorizaron automáticamente ${data.totalCategorized} movimientos.`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al auto-categorizar');
    } finally {
      setAutoCatLoading(false);
    }
  }

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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-8">
        <p className="text-rose-600 font-semibold">Cuenta no encontrada.</p>
      </div>
    );
  }

  const isGalicia =
    account.provider?.toLowerCase().includes('galicia') ||
    account.name.toLowerCase().includes('galicia');

  const lastScrapedTime = account.last_scraped_at || card?.synced_at;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header con Saldo a la izquierda y Último scrapeo arriba a la derecha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Volver" onClick={() => router.back()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors shadow-xs">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{account.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {account.provider && `${account.provider} · `}
              Saldo disponible: <span className="text-slate-900 font-bold">{fmt(Number(account.balance))}</span>
            </p>
          </div>
        </div>

        {/* Lado derecho (arriba del botón de sincronizar): Último scrapeo en verde clarito con margen interior */}
        {lastScrapedTime && (
          <div className="sm:text-right pr-4 sm:pr-10">
            <p className="text-xs text-emerald-600 font-medium flex items-center sm:justify-end gap-1.5 whitespace-nowrap">
              <RefreshCw size={12} className="text-emerald-500 shrink-0" />
              <span>Último scrapeo: <strong className="text-emerald-700 font-semibold">{fmtDateTime(lastScrapedTime)}</strong></span>
            </p>
          </div>
        )}
      </div>

      {syncMsg && (
        <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium ${
          syncState === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {syncState === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {syncMsg}
        </div>
      )}

      {autoCatMsg && (
        <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-medium bg-violet-50 text-violet-700 border border-violet-200">
          <Sparkles size={16} className="text-violet-600 shrink-0" />
          {autoCatMsg}
        </div>
      )}

      {/* Fila de Tabs con botones de acción con margen interior */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-0 gap-3">
        <div className="flex gap-1 sm:gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pb-1 pr-4 sm:pr-10 shrink-0">
          <button
            type="button"
            onClick={handleAutoCategorize}
            disabled={autoCatLoading}
            title="Auto-categorizar movimientos sin categoría según patrones y palabras clave"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition-colors shadow-xs disabled:opacity-50"
          >
            <Sparkles size={13} className={autoCatLoading ? 'animate-spin' : 'text-violet-600'} />
            <span>{autoCatLoading ? 'Categorizando…' : 'Auto-categorizar'}</span>
          </button>

          {isGalicia && (
            <>
              <SyncButton state={syncState} onClick={handleSync} />
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs" title="Tarjeta de Crédito Galicia">
                <CreditCardIcon size={15} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contenido */}
      {tab === 'balance'     && (
        <BalanceTab
          income={income}
          expenses={expenses}
          card={card}
          cardMvs={cardMvs}
          investments={investments}
          year={filterYear}
          month={filterMonth}
          range={filterRange}
          onYearChange={setFilterYear}
          onMonthChange={setFilterMonth}
          onRangeChange={setFilterRange}
          search={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}
      {tab === 'income'      && (
        <IncomeTab
          transactions={income}
          accountName={account.name}
          year={filterYear}
          month={filterMonth}
          range={filterRange}
          onYearChange={setFilterYear}
          onMonthChange={setFilterMonth}
          onRangeChange={setFilterRange}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          onCategoryAssigned={(txId, cat) => {
            setIncome(prev => prev.map(t => {
              if (t.id !== txId) return t;
              return {
                ...t,
                category_id: cat?.id ?? null,
                category: cat
                  ? { id: cat.id, name: cat.name, color: cat.color, user_id: null, type: 'income', icon: null, is_active: true, created_at: '' }
                  : undefined,
              };
            }));
          }}
        />
      )}
      {tab === 'expense'     && (
        <ExpenseTab
          transactions={expenses}
          accountName={account.name}
          year={filterYear}
          month={filterMonth}
          range={filterRange}
          onYearChange={setFilterYear}
          onMonthChange={setFilterMonth}
          onRangeChange={setFilterRange}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          onCategoryAssigned={(txId, cat) => {
            setExpenses(prev => prev.map(t => {
              if (t.id !== txId) return t;
              return {
                ...t,
                category_id: cat?.id ?? null,
                category: cat
                  ? { id: cat.id, name: cat.name, color: cat.color, user_id: null, type: 'expense', icon: null, is_active: true, created_at: '' }
                  : undefined,
              };
            }));
          }}
        />
      )}
      {tab === 'card'        && (
        <CardTab
          card={card}
          movements={cardMvs}
          accountId={id}
          year={filterYear}
          month={filterMonth}
          range={filterRange}
          onYearChange={setFilterYear}
          onMonthChange={setFilterMonth}
          onRangeChange={setFilterRange}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          onCategoryAssigned={(mvId, cat) => {
            setCardMvs(prev => prev.map(m => {
              if (m.id !== mvId) return m;
              return {
                ...m,
                category_id: cat?.id ?? null,
                category: cat
                  ? { id: cat.id, name: cat.name, color: cat.color, user_id: null, type: 'expense', icon: null, is_active: true, created_at: '' }
                  : undefined,
              };
            }));
          }}
        />
      )}
      {tab === 'investments' && <InvestmentsTab investments={investments} />}
    </div>
  );
}

// ─── Tab: Balance (Comparativa Ejecutiva) ─────────────────────────────────────

function BalanceTab({
  income,
  expenses,
  card,
  cardMvs,
  investments,
  year,
  month,
  range,
  onYearChange,
  onMonthChange,
  onRangeChange,
  search,
  onSearchChange,
}: {
  income: Transaction[];
  expenses: Transaction[];
  card: CreditCard | null;
  cardMvs: CardMovement[];
  investments: Investment[];
  year: string;
  month: string;
  range: DateRange;
  onYearChange: (y: string) => void;
  onMonthChange: (m: string) => void;
  onRangeChange: (r: DateRange) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const allTx = [...income, ...expenses];
  const afterYM_income  = applyYearMonth(income, year, month);
  const filteredIncome  = applyRangeFilter(afterYM_income, range);

  const afterYM_expense = applyYearMonth(expenses, year, month);
  const filteredExpense = applyRangeFilter(afterYM_expense, range);

  const afterYM_card    = applyYearMonth(cardMvs, year, month);
  const filteredCardMvs = applyRangeFilter(afterYM_card, range);

  const q = search.trim();
  const searchedIncome = q
    ? filteredIncome.filter(t =>
        normalizeText(t.description).includes(normalizeText(q)) ||
        normalizeText(t.category?.name).includes(normalizeText(q))
      )
    : filteredIncome;

  const searchedExpense = q
    ? filteredExpense.filter(t =>
        normalizeText(t.description).includes(normalizeText(q)) ||
        normalizeText(t.category?.name).includes(normalizeText(q))
      )
    : filteredExpense;

  const searchedCardMvs = q
    ? filteredCardMvs.filter(m =>
        normalizeText(m.merchant).includes(normalizeText(q)) ||
        normalizeText(m.installment).includes(normalizeText(q)) ||
        normalizeText(m.category?.name).includes(normalizeText(q))
      )
    : filteredCardMvs;

  const totalIncome  = searchedIncome.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = searchedExpense.reduce((s, t) => s + Number(t.amount), 0);
  const netFlow      = totalIncome - totalExpense;

  const cardTotalARS = searchedCardMvs.filter(m => m.currency === 'ARS').reduce((s, m) => s + Number(m.amount), 0);
  const cardTotalUSD = searchedCardMvs.filter(m => m.currency === 'USD').reduce((s, m) => s + Number(m.amount), 0);

  const totalCapital = investments.reduce((s, i) => s + Number(i.initial_amount), 0);
  const totalGain    = investments.reduce((s, i) => s + Number(i.gain_amount ?? 0), 0);

  // Evolución mensual comparativa (últimos 6 meses)
  const monthlyMap: Record<string, { mes: string; Ingresos: number; Gastos: number }> = {};
  allTx.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es-AR', { month: 'short', year: '2-digit' });
    if (!monthlyMap[key]) monthlyMap[key] = { mes: label, Ingresos: 0, Gastos: 0 };
    if (t.type === 'income') monthlyMap[key].Ingresos += Number(t.amount);
    if (t.type === 'expense') monthlyMap[key].Gastos += Number(t.amount);
  });
  const chartData = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([, v]) => v);

  const incomeByCat  = groupByCategory(searchedIncome);
  const expenseByCat = groupByCategory(searchedExpense);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <FilterBar>
        <YearMonthFilter
          items={allTx}
          year={year}
          month={month}
          onYearChange={onYearChange}
          onMonthChange={onMonthChange}
          onRangeChange={onRangeChange}
        />
        <DateRangePicker value={range} onChange={onRangeChange} />
        <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar en balance…" />
      </FilterBar>

      {/* Tarjetas métricas comparativas de cabecera */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Ingresos Totales</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{fmt(totalIncome)}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">{filteredIncome.length} acreditaciones</p>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Gastos Totales</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <TrendingDown size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{fmt(totalExpense)}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">{filteredExpense.length} débitos</p>
        </div>

        {/* Flujo Neto / Balance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Flujo Neto / Balance</span>
            <div className={`p-2 rounded-lg ${netFlow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              <Scale size={18} />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-2 ${netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {netFlow >= 0 ? '+' : ''}{fmt(netFlow)}
          </p>
          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-md mt-1 ${
            netFlow >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            {netFlow >= 0 ? 'Superávit en cuenta' : 'Déficit en cuenta'}
          </span>
        </div>

        {/* Productos vinculados (Tarjeta / Inversiones) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Productos Vinculados</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <CreditCardIcon size={18} />
            </div>
          </div>
          {card ? (
            <div className="mt-2">
              <p className="text-sm font-bold text-slate-900">Tarjeta {card.brand || 'Crédito'}</p>
              <p className="text-xs text-slate-500 font-medium">Consumo ARS: <strong className="text-slate-800">{fmt(cardTotalARS || Number(card.consumption_ars))}</strong></p>
              {cardTotalUSD > 0 && (
                <p className="text-xs text-slate-500 font-medium">Consumo USD: <strong className="text-slate-800">{fmtUSD(cardTotalUSD)}</strong></p>
              )}
            </div>
          ) : totalCapital > 0 ? (
            <div className="mt-2">
              <p className="text-sm font-bold text-slate-900">Inversiones activas</p>
              <p className="text-xs text-emerald-600 font-semibold">{fmt(totalCapital)} colocados</p>
              {totalGain > 0 && <p className="text-[11px] text-emerald-600">+{fmt(totalGain)} rendimiento</p>}
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-semibold text-slate-700">Sin tarjeta asociada</p>
              <p className="text-xs text-slate-400">Podés sincronizarla en la solapa Tarjeta</p>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico Comparativo: Ingresos vs Gastos */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Comparativa Mensual: Ingresos vs Gastos</h3>
              <p className="text-xs text-slate-500 mt-0.5">Evolución histórica semestral consolidada de esta cuenta</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-slate-600">Ingresos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-rose-500" />
                <span className="text-slate-600">Gastos</span>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <Bar dataKey="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Desglose Comparativo por Categorías (Lado a Lado) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-600" />
              Composición de Ingresos
            </h3>
            <span className="text-xs font-semibold text-emerald-600">{fmt(totalIncome)}</span>
          </div>
          {incomeByCat.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-8">Sin ingresos registrados en el período</p>
          ) : (
            <div className="space-y-3">
              {incomeByCat.slice(0, 5).map(item => {
                const pct = totalIncome > 0 ? (item.total / totalIncome) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 text-xs w-32 truncate font-medium">{item.name}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-slate-900 text-xs font-semibold w-24 text-right">{fmt(item.total)}</span>
                    <span className="text-slate-400 text-[11px] w-8 text-right font-medium">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingDown size={16} className="text-rose-600" />
              Composición de Egresos
            </h3>
            <span className="text-xs font-semibold text-rose-600">{fmt(totalExpense)}</span>
          </div>
          {expenseByCat.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-8">Sin gastos registrados en el período</p>
          ) : (
            <div className="space-y-3">
              {expenseByCat.slice(0, 5).map(item => {
                const pct = totalExpense > 0 ? (item.total / totalExpense) * 100 : 0;
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 text-xs w-32 truncate font-medium">{item.name}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-slate-900 text-xs font-semibold w-24 text-right">{fmt(item.total)}</span>
                    <span className="text-slate-400 text-[11px] w-8 text-right font-medium">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Ingresos ────────────────────────────────────────────────────────────

function IncomeTab({
  transactions,
  accountName,
  year,
  month,
  range,
  onYearChange,
  onMonthChange,
  onRangeChange,
  search,
  onSearchChange,
  onCategoryAssigned,
}: {
  transactions: Transaction[];
  accountName?: string;
  year: string;
  month: string;
  range: DateRange;
  onYearChange: (y: string) => void;
  onMonthChange: (m: string) => void;
  onRangeChange: (r: DateRange) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onCategoryAssigned?: (txId: string, cat: CategoryOption | null) => void;
}) {
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
      setAllCats((cats ?? []).filter(c => !hiddenIds.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color ?? '#64748B' })));
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
  const afterCat   = catFilter
    ? afterRange.filter(t => (t.category?.id ?? 'sin-categoria') === catFilter)
    : afterRange;
  const q = search.trim();
  const filtered   = q
    ? afterCat.filter(t => {
        const query = normalizeText(q);
        return (
          normalizeText(t.description).includes(query) ||
          normalizeText(t.category?.name).includes(query)
        );
      })
    : afterCat;

  const total      = filtered.reduce((s, t) => s + Number(t.amount), 0);
  const byCategory = groupByCategory(filtered);
  const filterCats = buildCategoryOptions(transactions);

  return (
    <div className="space-y-4">
      <FilterBar>
        <YearMonthFilter
          items={transactions}
          year={year}
          month={month}
          onYearChange={onYearChange}
          onMonthChange={onMonthChange}
          onRangeChange={onRangeChange}
        />
        <DateRangePicker value={range} onChange={onRangeChange} />
        <CategoryDropdown categories={filterCats} selected={catFilter} onSelect={setCatFilter} />
        <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar en ingresos…" />
      </FilterBar>
      <SummaryCard amount={total} label="Total Ingresos Acreditados" color="text-emerald-600" bg="bg-emerald-50" icon={<TrendingUp size={22} />} />
      {byCategory.length > 0 && (
        <CategoryBreakdown
          items={byCategory}
          total={total}
          title="Distribución de Ingresos"
          subtitle="Gráfico circular de ingresos según el período seleccionado"
        />
      )}
      <TransactionTable
        transactions={filtered}
        type="income"
        categories={allCats}
        accountName={accountName}
        onCategoryCreated={cat => setAllCats(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        onHideCategory={handleHide}
        onCategoryAssigned={onCategoryAssigned}
      />
    </div>
  );
}

// ─── Tab: Gastos ──────────────────────────────────────────────────────────────

function ExpenseTab({
  transactions,
  accountName,
  year,
  month,
  range,
  onYearChange,
  onMonthChange,
  onRangeChange,
  search,
  onSearchChange,
  onCategoryAssigned,
}: {
  transactions: Transaction[];
  accountName?: string;
  year: string;
  month: string;
  range: DateRange;
  onYearChange: (y: string) => void;
  onMonthChange: (m: string) => void;
  onRangeChange: (r: DateRange) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onCategoryAssigned?: (txId: string, cat: CategoryOption | null) => void;
}) {
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
      setAllCats((cats ?? []).filter(c => !hiddenIds.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color ?? '#64748B' })));
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
  const afterCat   = catFilter
    ? afterRange.filter(t => (t.category?.id ?? 'sin-categoria') === catFilter)
    : afterRange;
  const q = search.trim();
  const filtered   = q
    ? afterCat.filter(t => {
        const query = normalizeText(q);
        return (
          normalizeText(t.description).includes(query) ||
          normalizeText(t.category?.name).includes(query)
        );
      })
    : afterCat;

  const total      = filtered.reduce((s, t) => s + Number(t.amount), 0);
  const byCategory = groupByCategory(filtered);
  const filterCats = buildCategoryOptions(transactions);

  return (
    <div className="space-y-4">
      <FilterBar>
        <YearMonthFilter
          items={transactions}
          year={year}
          month={month}
          onYearChange={onYearChange}
          onMonthChange={onMonthChange}
          onRangeChange={onRangeChange}
        />
        <DateRangePicker value={range} onChange={onRangeChange} />
        <CategoryDropdown categories={filterCats} selected={catFilter} onSelect={setCatFilter} />
        <SearchInput value={search} onChange={onSearchChange} placeholder="Buscar en gastos…" />
      </FilterBar>
      <SummaryCard amount={total} label="Total Gastos Debitado" color="text-rose-600" bg="bg-rose-50" icon={<TrendingDown size={22} />} />
      {byCategory.length > 0 && (
        <CategoryBreakdown
          items={byCategory}
          total={total}
          title="Distribución de Gastos"
          subtitle="Gráfico circular de gastos según el período seleccionado"
        />
      )}
      <TransactionTable
        transactions={filtered}
        type="expense"
        categories={allCats}
        accountName={accountName}
        onCategoryCreated={cat => setAllCats(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        onHideCategory={handleHide}
        onCategoryAssigned={onCategoryAssigned}
      />
    </div>
  );
}

// ─── Tab: Tarjeta ─────────────────────────────────────────────────────────────

function CardTab({
  card,
  movements,
  accountId,
  year,
  month,
  range,
  onYearChange,
  onMonthChange,
  onRangeChange,
  search,
  onSearchChange,
  onCategoryAssigned,
}: {
  card: CreditCard | null;
  movements: CardMovement[];
  accountId: string;
  year: string;
  month: string;
  range: DateRange;
  onYearChange: (y: string) => void;
  onMonthChange: (m: string) => void;
  onRangeChange: (r: DateRange) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onCategoryAssigned?: (movementId: string, cat: CategoryOption | null) => void;
}) {
  const [catFilter, setCatFilter]   = useState('');
  const [allCats, setAllCats]       = useState<CategoryOption[]>([]);
  const [catOverrides, setCatOverrides] = useState<Record<string, CategoryOption | null>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMv, setSelectedMv] = useState<CardMovement | null>(null);
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
      setAllCats((cats ?? []).filter(c => !hiddenIds.has(c.id)).map(c => ({ id: c.id, name: c.name, color: c.color ?? '#64748B' })));
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
    setCatOverrides(prev => ({ ...prev, [movementId]: cat }));
    onCategoryAssigned?.(movementId, cat);
    try {
      const res = await fetch('/api/categories/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'card_movements', id: movementId, category_id: cat?.id ?? null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error('Error al guardar categoría en tarjeta:', data.error);
        alert('No se pudo guardar la categoría en la tarjeta: ' + (data.error || 'Error desconocido'));
      }
    } catch (err: unknown) {
      console.error('Error de red al guardar categoría en tarjeta:', err);
    }
  }

  function getCategory(m: CardMovement): CategoryOption | null {
    if (catOverrides[m.id] !== undefined) return catOverrides[m.id];
    if (m.category) return { id: m.category.id, name: m.category.name, color: m.category.color ?? '#64748B' };
    return null;
  }

  if (!card) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-16 text-center space-y-3">
        <CreditCardIcon size={44} className="text-slate-300 mx-auto" />
        <p className="text-slate-600 font-medium">No hay tarjeta de crédito asociada a esta cuenta</p>
        <p className="text-slate-400 text-xs">Podés sincronizar los consumos utilizando el botón "Sincronizar Galicia" en la barra superior.</p>
      </div>
    );
  }

  const afterYM    = applyYearMonth(movements, year, month);
  const afterRange = applyRangeFilter(afterYM, range);
  const afterCat   = catFilter
    ? afterRange.filter(m => (getCategory(m)?.id ?? 'sin-categoria') === catFilter)
    : afterRange;
  const q = search.trim();
  const filtered   = q
    ? afterCat.filter(m => {
        const query = normalizeText(q);
        return (
          normalizeText(m.merchant).includes(query) ||
          normalizeText(m.installment).includes(query) ||
          normalizeText(getCategory(m)?.name).includes(query)
        );
      })
    : afterCat;

  const totalARS   = filtered.filter(m => m.currency === 'ARS').reduce((s, m) => s + Number(m.amount), 0);
  const totalUSD   = filtered.filter(m => m.currency === 'USD').reduce((s, m) => s + Number(m.amount), 0);
  const pagedMvs   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const cardCatsMap: Record<string, { name: string; color: string; total: number }> = {};
  filtered.filter(m => m.currency === 'ARS').forEach(m => {
    const cat = getCategory(m);
    const id = cat?.id ?? 'sin-categoria';
    if (!cardCatsMap[id]) {
      cardCatsMap[id] = { name: cat?.name ?? 'Sin categoría', color: cat?.color ?? '#64748B', total: 0 };
    }
    cardCatsMap[id].total += Number(m.amount);
  });
  const cardByCategory = Object.values(cardCatsMap).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* Filtros en la parte superior idéntico a Ingresos y Gastos */}
      {movements.length > 0 && (
        <FilterBar>
          <YearMonthFilter
            items={movements}
            year={year}
            month={month}
            onYearChange={v => { onYearChange(v); setPage(0); }}
            onMonthChange={v => { onMonthChange(v); setPage(0); }}
            onRangeChange={v => { onRangeChange(v); setPage(0); }}
          />
          <DateRangePicker value={range} onChange={v => { onRangeChange(v); setPage(0); }} />
          <CategoryDropdown categories={allCats} selected={catFilter} onSelect={v => { setCatFilter(v); setPage(0); }} />
          <SearchInput value={search} onChange={v => { onSearchChange(v); setPage(0); }} placeholder="Buscar comercio…" />
        </FilterBar>
      )}

      {/* Resumen tarjeta sin el icono desunido */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="mb-5">
          <p className="text-slate-900 font-bold text-lg">{card.brand} {card.product}</p>
          <p className="text-slate-500 text-sm mt-0.5 font-medium">•••• {card.last_digits}</p>
          {card.holder && <p className="text-slate-400 text-xs mt-1">{card.holder}</p>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Consumo ARS',    value: fmt(Number(card.consumption_ars)) },
            { label: 'Consumo USD',    value: fmtUSD(Number(card.consumption_usd)) },
            { label: 'Pago mínimo',    value: fmt(Number(card.min_payment)) },
            { label: 'Disponible ARS', value: fmt(Number(card.available_ars)) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <p className="text-slate-500 text-xs font-semibold mb-1">{label}</p>
              <p className="text-slate-900 font-bold text-base">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-6 text-sm border-t border-slate-100 pt-4">
          {card.closing_date && (
            <p className="text-slate-500 font-medium">Cierre: <span className="text-slate-900 font-semibold">{card.closing_date}</span></p>
          )}
          {card.due_date && (
            <p className="text-slate-500 font-medium">Vencimiento: <span className="text-slate-900 font-semibold">{fmtDate(card.due_date)}</span></p>
          )}
        </div>
      </div>

      {/* Totales del período filtrado */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 text-center">
          <p className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wide">ARS período filtrado</p>
          <p className="text-slate-900 text-2xl font-bold">{fmt(totalARS)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 text-center">
          <p className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wide">USD período filtrado</p>
          <p className="text-slate-900 text-2xl font-bold">{fmtUSD(totalUSD)}</p>
        </div>
      </div>

      {/* Gráfico circular de consumos */}
      {cardByCategory.length > 0 && (
        <CategoryBreakdown
          items={cardByCategory}
          total={totalARS}
          title="Distribución de Consumos Tarjeta (ARS)"
          subtitle="Gráfico circular de consumos por rubro según el período seleccionado"
        />
      )}

      {/* Lista de consumos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-slate-900 font-semibold text-sm">
            Consumos ({filtered.length}{filtered.length !== movements.length && ` de ${movements.length}`})
          </h3>
        </div>
        {filtered.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-16 font-medium">Sin consumos para el período seleccionado</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['Comercio', 'Categoría', 'Fecha', 'Cuotas', 'Monto'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedMvs.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedMv(m)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    title="Hacé clic para ver el detalle completo"
                  >
                    <td className="px-6 py-3 text-slate-900 text-sm font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="group-hover:text-blue-600 transition-colors">{m.merchant}</span>
                        <Info size={13} className="text-slate-300 group-hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                      <InlineCategoryPicker
                        current={getCategory(m)}
                        categories={allCats}
                        onAssign={cat => handleAssign(m.id, cat)}
                        onCreateNew={() => setShowCreate(true)}
                        onHide={handleHide}
                      />
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-sm whitespace-nowrap font-medium">{fmtDate(m.date)}</td>
                    <td className="px-6 py-3">
                      {m.installment ? (
                        <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200/60 whitespace-nowrap">Cuota {m.installment}</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-rose-600 text-sm font-bold whitespace-nowrap">
                      {m.currency === 'USD' ? fmtUSD(Number(m.amount)) : fmt(Number(m.amount))}
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

      {selectedMv && (
        <ItemDetailModal
          item={{
            kind: 'card_movement',
            mv: selectedMv,
            category: getCategory(selectedMv),
            cardBrand: card.brand,
            cardLastDigits: card.last_digits,
          }}
          onClose={() => setSelectedMv(null)}
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 text-center">
          <p className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wide">Capital invertido</p>
          <p className="text-slate-900 text-2xl font-bold">{fmt(totalCapital)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 text-center">
          <p className="text-slate-500 text-xs font-semibold mb-1 uppercase tracking-wide">Rendimiento acumulado</p>
          <p className="text-emerald-600 text-2xl font-bold">{fmt(totalGain)}</p>
        </div>
      </div>

      {investments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-16 text-center">
          <Landmark size={44} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Sin colocaciones ni inversiones activas registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {investments.map(inv => {
            const daysLeft = inv.maturity_date
              ? Math.ceil((new Date(inv.maturity_date).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-slate-900 font-bold text-base">{inv.name}</p>
                    {inv.tna != null && (
                      <p className="text-slate-500 text-sm mt-1 font-medium">TNA {inv.tna}% · Plazo {inv.term_days} días</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-slate-900 font-bold text-lg">{fmt(Number(inv.initial_amount))}</p>
                    {inv.gain_amount != null && (
                      <p className="text-emerald-600 text-sm font-semibold mt-0.5">+{fmt(Number(inv.gain_amount))}</p>
                    )}
                  </div>
                </div>
                {inv.maturity_date && (
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <p className="text-slate-500 text-sm font-medium">Fecha de vencimiento: <span className="text-slate-800 font-semibold">{fmtDate(inv.maturity_date)}</span></p>
                    {daysLeft != null && (
                      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        daysLeft <= 7
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {daysLeft > 0 ? `${daysLeft} días restantes` : 'Vencido'}
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
      <div className="flex flex-wrap items-center gap-3">
        {children}
      </div>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar por comercio, concepto...',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-[200px] max-w-sm">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 shadow-xs transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition-colors"
          title="Borrar búsqueda"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function SummaryCard({ amount, label, color, bg, icon }: {
  amount: number; label: string; color: string; bg: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex items-center gap-5">
      <div className={`${bg} ${color} p-3.5 rounded-xl border border-slate-100`}>{icon}</div>
      <div>
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">{label}</p>
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
          color: t.category?.color ?? '#64748B',
        },
      ]),
    ).values(),
  ];
}

function groupByCategory(transactions: Transaction[]) {
  const map: Record<string, { name: string; color: string; total: number }> = {};
  transactions.forEach(t => {
    const id = t.category?.id ?? 'sin-categoria';
    if (!map[id]) map[id] = { name: t.category?.name ?? 'Sin categoría', color: t.category?.color ?? '#64748B', total: 0 };
    map[id].total += Number(t.amount);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

function CategoryBreakdown({
  items,
  total,
  title = 'Distribución por Rubro',
  subtitle = 'Visualización de gastos según el período seleccionado',
}: {
  items: { name: string; color: string; total: number }[];
  total: number;
  title?: string;
  subtitle?: string;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h3 className="text-slate-900 font-bold text-base">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {items.length} {items.length === 1 ? 'categoría' : 'categorías'}
          </span>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
            Total: {fmt(total)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Gráfico circular (Donut) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[240px] min-w-0">
          <div className="w-full h-60 min-w-0 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
              <PieChart>
                <Pie
                  data={items}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={items.length > 1 ? 2.5 : 0}
                  onMouseEnter={(_, idx) => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {items.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}-${index}`}
                      fill={entry.color || '#64748B'}
                      stroke="#ffffff"
                      strokeWidth={2}
                      className="cursor-pointer transition-opacity duration-200"
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [fmt(Number(value)), 'Total']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  itemStyle={{ color: '#0f172a', fontWeight: 600 }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centro del donut con total o detalle hovered */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              {activeIndex !== null && items[activeIndex] ? (
                <div className="px-3 max-w-[130px]">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block truncate">
                    {items[activeIndex].name}
                  </span>
                  <span className="text-sm font-bold text-slate-900 block truncate mt-0.5">
                    {fmt(items[activeIndex].total)}
                  </span>
                  <span className="text-[11px] font-bold text-blue-600 block">
                    {total > 0 ? `${((items[activeIndex].total / total) * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              ) : (
                <div className="px-3 max-w-[130px]">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total
                  </span>
                  <span className="text-sm font-bold text-slate-900 block truncate mt-0.5">
                    {fmt(total)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    100%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lista de desglose por categoría */}
        <div className="lg:col-span-7 space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {items.map((item, index) => {
            const pct = total > 0 ? (item.total / total) * 100 : 0;
            const isHovered = activeIndex === index;
            return (
              <div
                key={item.name}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                  isHovered ? 'bg-slate-50 ring-1 ring-slate-200 shadow-xs' : 'hover:bg-slate-50/70'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0 transition-transform"
                  style={{
                    backgroundColor: item.color,
                    transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
                <span className="text-slate-700 text-xs sm:text-sm w-36 truncate font-medium">
                  {item.name}
                </span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                  />
                </div>
                <span className="text-slate-900 text-xs sm:text-sm font-semibold w-28 text-right shrink-0">
                  {fmt(item.total)}
                </span>
                <span className="text-slate-400 text-xs w-11 text-right font-medium shrink-0">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
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
    <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 bg-slate-50/50">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirst}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
      >
        <ChevronLeft size={14} /> Anterior
      </button>
      <span className="text-slate-500 text-xs font-semibold">Página {page + 1} de {totalPages}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-xs"
      >
        Siguiente <ChevronRight size={14} />
      </button>
    </div>
  );
}

function TransactionTable({
  transactions,
  type,
  categories,
  accountName,
  onCategoryCreated,
  onHideCategory,
  onCategoryAssigned,
}: {
  transactions: Transaction[];
  type: 'income' | 'expense';
  categories: CategoryOption[];
  accountName?: string;
  onCategoryCreated: (cat: CategoryOption) => void;
  onHideCategory?: (catId: string) => void;
  onCategoryAssigned?: (txId: string, cat: CategoryOption | null) => void;
}) {
  const [page, setPage]           = useState(0);
  const [overrides, setOverrides] = useState<Record<string, CategoryOption | null>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const color = type === 'income' ? 'text-emerald-600' : 'text-rose-600';
  const sign  = type === 'income' ? '+' : '-';

  const totalRef = useRef(transactions.length);
  if (transactions.length !== totalRef.current) {
    totalRef.current = transactions.length;
    if (page !== 0) setPage(0);
  }

  function getCategory(t: Transaction): CategoryOption | null {
    if (overrides[t.id] !== undefined) return overrides[t.id];
    if (t.category) return { id: t.category.id, name: t.category.name, color: t.category.color ?? '#64748B' };
    return null;
  }

  async function handleAssign(txId: string, cat: CategoryOption | null) {
    setOverrides(prev => ({ ...prev, [txId]: cat }));
    onCategoryAssigned?.(txId, cat);
    try {
      const res = await fetch('/api/categories/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'transactions', id: txId, category_id: cat?.id ?? null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error('Error al guardar categoría en transacción:', data.error);
        alert('No se pudo guardar la categoría: ' + (data.error || 'Error desconocido'));
      }
    } catch (err: unknown) {
      console.error('Error de red al guardar categoría:', err);
    }
  }

  const paged = transactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-slate-900 font-semibold text-sm">Movimientos ({transactions.length})</h3>
        </div>
        {transactions.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-16 font-medium">Sin movimientos registrados</p>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['Descripción', 'Categoría', 'Fecha', 'Monto'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-slate-500 text-xs font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map(t => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTx(t)}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                    title="Hacé clic para ver el detalle completo"
                  >
                    <td className="px-6 py-3 text-slate-900 text-sm font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="block max-w-xs truncate group-hover:text-blue-600 transition-colors" title={t.description || undefined}>
                          {t.description || '—'}
                        </span>
                        <Info size={13} className="text-slate-300 group-hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="px-6 py-3" onClick={e => e.stopPropagation()}>
                      <InlineCategoryPicker
                        current={getCategory(t)}
                        categories={categories}
                        onAssign={cat => handleAssign(t.id, cat)}
                        onCreateNew={() => setShowCreate(true)}
                        onHide={onHideCategory}
                      />
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-sm whitespace-nowrap font-medium">{fmtDate(t.date)}</td>
                    <td className={`px-6 py-3 text-sm font-bold whitespace-nowrap ${color}`}>
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

      {selectedTx && (
        <ItemDetailModal
          item={{
            kind: 'transaction',
            tx: selectedTx,
            category: getCategory(selectedTx),
            accountName,
          }}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </>
  );
}
