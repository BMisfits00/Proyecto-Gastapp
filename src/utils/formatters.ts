// Formatea montos en pesos argentinos u otras monedas
export function formatCurrency(amount: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Formatea un porcentaje con signo
export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

// Formatea fecha ISO a string legible
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate + 'T00:00:00');
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Devuelve "Hoy", "Ayer" o la fecha formateada
export function formatRelativeDate(isoDate: string): string {
  const today = new Date();
  const date = new Date(isoDate + 'T00:00:00');
  const diff = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return formatDate(isoDate);
}

// Devuelve nombre del mes en español
export function formatMonth(isoDate: string): string {
  const date = new Date(isoDate + '-01');
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

// Devuelve abreviatura del mes (Ene, Feb, etc.)
export function shortMonth(isoDate: string): string {
  const date = new Date(isoDate + '-01');
  return date.toLocaleDateString('es-AR', { month: 'short' });
}

// Fecha actual en formato YYYY-MM-DD
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// Primer día del mes actual
export function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Último día del mes actual
export function lastDayOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().split('T')[0];
}
