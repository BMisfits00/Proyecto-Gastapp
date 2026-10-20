'use client';

import { useState, useEffect } from 'react';
import { Transaction, CardMovement } from '@/lib/types';
import {
  X, TrendingUp, TrendingDown, CreditCard as CreditCardIcon,
  Copy, Check,
} from 'lucide-react';

export type CategoryOption = { id: string; name: string; color: string };

export type DetailModalItem =
  | {
      kind: 'transaction';
      tx: Transaction;
      category?: CategoryOption | null;
      accountName?: string;
    }
  | {
      kind: 'card_movement';
      mv: CardMovement;
      category?: CategoryOption | null;
      cardBrand?: string;
      cardLastDigits?: string;
    };

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

export function ItemDetailModal({
  item,
  onClose,
}: {
  item: DetailModalItem;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isTx = item.kind === 'transaction';
  const isIncome = isTx ? item.tx.type === 'income' : false;
  const amount = isTx ? Number(item.tx.amount) : Number(item.mv.amount);
  const currency = isTx ? item.tx.currency : item.mv.currency;
  const description = isTx ? (item.tx.description || 'Sin descripción') : item.mv.merchant;
  const dateStr = isTx ? item.tx.date : item.mv.date;
  const category = item.category ?? (isTx ? item.tx.category : item.mv.category);

  const fullDateFormatted = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const amountColor = isTx
    ? (isIncome ? 'text-emerald-600' : 'text-rose-600')
    : 'text-rose-600';
  const amountSign = isTx ? (isIncome ? '+' : '-') : '-';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${
              isTx
                ? (isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600')
                : 'bg-blue-50 text-blue-600'
            }`}>
              {isTx ? (
                isIncome ? <TrendingUp size={18} /> : <TrendingDown size={18} />
              ) : (
                <CreditCardIcon size={18} />
              )}
            </div>
            <div>
              <h3 className="text-slate-900 font-bold text-base">
                {isTx ? 'Detalle del Movimiento' : 'Detalle del Consumo con Tarjeta'}
              </h3>
              <p className="text-slate-400 text-xs font-medium capitalize">
                {fullDateFormatted}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Monto destacado */}
        <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Importe total
          </span>
          <p className={`text-3xl font-extrabold ${amountColor}`}>
            {currency === 'USD' ? `${amountSign}${fmtUSD(amount)}` : `${amountSign}${fmt(amount, currency)}`}
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isTx
                ? (isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')
                : 'bg-blue-100 text-blue-800'
            }`}>
              {isTx ? (isIncome ? 'Ingreso bancario' : 'Gasto bancario') : 'Consumo con Tarjeta'}
            </span>
            {!isTx && item.mv.installment && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">
                Cuota {item.mv.installment}
              </span>
            )}
          </div>
        </div>

        {/* Campos de Información Detallada */}
        <div className="space-y-3.5 text-sm">
          {/* Descripción / Concepto completo */}
          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {isTx ? 'Concepto / Detalle bancario completo' : 'Comercio / Establecimiento'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(description)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors"
                title="Copiar texto completo"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                <span>{copied ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <p className="text-slate-900 font-semibold break-words leading-relaxed select-text">
              {description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Categoría */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Categoría
              </span>
              {category ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: category.color ?? '#64748B' }}
                  />
                  {category.name}
                </span>
              ) : (
                <span className="text-slate-400 font-medium text-xs">Sin categoría</span>
              )}
            </div>

            {/* Fecha */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Fecha
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {fmtDate(dateStr)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Origen / Cuenta o Tarjeta */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                {isTx ? 'Cuenta' : 'Tarjeta'}
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {isTx ? (item.accountName ?? 'Cuenta bancaria') : `${item.cardBrand ?? 'Tarjeta'} ····${item.cardLastDigits ?? ''}`}
              </span>
            </div>

            {/* Moneda / Operación */}
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                {isTx ? 'Moneda' : 'Plan'}
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {isTx ? currency : (item.mv.installment ? `Cuotas (${item.mv.installment})` : '1 pago')}
              </span>
            </div>
          </div>

          {/* ID de referencia */}
          <div className="pt-2 text-center">
            <span className="text-[11px] text-slate-400 select-all font-mono">
              ID: {isTx ? item.tx.id : item.mv.id}
            </span>
          </div>
        </div>

        {/* Botón de cierre */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors shadow-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
