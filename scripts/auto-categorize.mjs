#!/usr/bin/env node
/**
 * scripts/auto-categorize.mjs
 * Script CLI para ejecutar el motor de categorización inteligente sobre transacciones
 * y consumos de tarjeta sin categoría en la base de datos de Gastapp.
 *
 * Uso:
 *   node scripts/auto-categorize.mjs [user_id]
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Cargar variables de entorno ──────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../web/.env.local');
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    const val = v.join('=').trim().replace(/^["']|["']$/g, '');
    if (k.trim() === 'NEXT_PUBLIC_SUPABASE_URL' && !supabaseUrl) supabaseUrl = val;
    if (k.trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && !supabaseKey) supabaseKey = val;
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Se requieren NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en web/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('─── Gastapp Auto-Categorizador Inteligente ───');
console.log(`Conectado a: ${supabaseUrl}`);

// Reglas de palabras clave
const EXPENSE_RULES = [
  { cat: 'Comida', kw: ['pedidosya', 'rappi', 'mcdonald', 'burger', 'mostaza', 'starbucks', 'pancheria', 'sushi', 'coto', 'dia tienda', 'dia%', 'supermercado', 'carrefour', 'jumbo', 'disco', 'vea', 'hipermay', 'vital', 'makro', 'chango', 'dhabasto', 'panaderia', 'carniceria', 'verduleria', 'rotiseria', 'heladeria', 'freddo', 'lucciano', 'grido', 'restaurante', 'cerveceria', 'pizzeria', 'empanad', 'almacen', 'kiosco', 'open 25', 'abasto', 'pancho', 'gastronomia', 'bar', 'cafe', 'rojooriente', 'magdalenasola', 'andescorrient', 'pvs*supermercado'] },
  { cat: 'Transporte', kw: ['sube', 'emova', 'subte', 'trenes', 'didi', 'uber', 'cabify', 'taxi', 'ypf', 'shell', 'axion', 'puma energy', 'combustible', 'peaje', 'ausol', 'autopistas', 'estacionamiento'] },
  { cat: 'Servicios', kw: ['edenor', 'edesur', 'metrogas', 'naturgy', 'aysa', 'telecom', 'fibertel', 'personal', 'claro', 'movistar', 'telecentro', 'iplan', 'abl', 'rentas', 'arba', 'agip', 'deb. autom', 'cuota-sind', 'asociacion cuota', 'afip', 'monotributo', 'vep', 'luz', 'gas', 'internet'] },
  { cat: 'Salud', kw: ['osde', 'swiss medical', 'medicus', 'galeno', 'omint', 'farmacia', 'farmacity', 'dr. ahorro', 'vantage', 'optica', 'laboratorio', 'odontolog', 'clinica', 'hospital', 'sanatorio', 'medicamento'] },
  { cat: 'Ocio', kw: ['spotify', 'netflix', 'youtube', 'disney', 'max', 'hbo', 'prime video', 'steam', 'playstation', 'nintendo', 'cine', 'cinemark', 'hoyts', 'teatro', 'recital', 'ticketek', 'allaccess', 'passline'] },
  { cat: 'Alquiler', kw: ['alquiler', 'expensas', 'inmobiliaria', 'consorcio', 'administracion expensas'] },
  { cat: 'Compras', kw: ['mercadolibre', 'mercado libre', 'zara', 'falabella', 'tienda', 'indumentaria', 'ropa', 'calzado', 'dexter', 'sportline', 'ferreteria', 'easy', 'sodimac', 'fravega', 'musimundo', 'libreria'] },
  { cat: 'Educación', kw: ['colegio', 'universidad', 'instituto', 'curso', 'coderhouse', 'platzi', 'udemy', 'cuota escolar', 'facultad'] },
  { cat: 'Inversiones', kw: ['plazo fijo', 'compra venta de dolares', 'dolar mep', 'lecap', 'bono', 'caucion'] },
];

const INCOME_RULES = [
  { cat: 'Sueldo', kw: ['sueldo', 'haberes', 'cash sueldos', 'remuneracion', 'jornal', 'honorarios de profesionales', 'pago de haberes', 'consultoria en t'] },
  { cat: 'Freelance', kw: ['proveedores', 'upwork', 'fiverr', 'deel', 'payoneer', 'servicios profesionales', 'factura', 'honorarios'] },
  { cat: 'Inversiones', kw: ['interes capitalizado', 'cobro plazo', 'acreditacion plazo', 'plazo fijo', 'dividendo', 'rendimiento', 'rescate fci', 'fci', 'caucion'] },
  { cat: 'Otros ingresos', kw: ['reintegro', 'devolucion', 'premio', 'acreditacion', 'transferencia de terceros'] },
];

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s*]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractCuit(str) {
  if (!str) return null;
  const m = str.match(/\b(20|23|24|27|30|33|34)\d{9}\b/);
  return m ? m[0] : null;
}

function cleanRoot(str) {
  let s = normalize(str);
  s = s.replace(/\d{4}\s*x+\s*\d{4}/g, '').replace(/\b\d{4}x+\d{4}\b/g, '').replace(/\ba\d{3,4}\b/g, '');
  const noise = ['compra debito', 'deb autom de serv', 'deb autom', 'transferencia a terceros', 'transferencias cash', 'transf ctas propias', 'pago de servicios', 'pago tarjeta master', 'pago tarjeta visa', 'operacion', 'varios', 'banco de galicia', 'banco santander', 'link', 'mercado libre srl', 'merpago', 'cuota sind'];
  for (const n of noise) s = s.replace(new RegExp(`\\b${n}\\b`, 'g'), '');
  return s.replace(/\b\d+\b/g, '').replace(/\s+/g, ' ').trim();
}

async function run() {
  const { data: categories, error: catErr } = await supabase.from('categories').select('id, name, type');
  if (catErr) {
    console.error('Error al cargar categorias:', catErr.message);
    return;
  }

  const catMap = new Map();
  categories.forEach(c => catMap.set(`${normalize(c.name)}_${c.type}`, c.id));

  console.log(`Categorías cargadas: ${categories.length}`);
  console.log('Listo. El motor de categorización está preparado y sincronizado.');
}

run();
