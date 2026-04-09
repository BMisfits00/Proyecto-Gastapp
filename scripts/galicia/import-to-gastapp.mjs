#!/usr/bin/env node
/**
 * import-to-gastapp.mjs
 * Convierte el output del scraper de Galicia en SQL listo para ejecutar en Supabase.
 *
 * Uso:
 *   node import-to-gastapp.mjs <output-file.json> <user_id> <account_id>
 *
 * Ejemplo:
 *   node import-to-gastapp.mjs output-2026-04-08.json "uuid-user" "uuid-account"
 *
 * El archivo SQL generado se guarda como import-YYYY-MM-DD.sql en la misma carpeta.
 */

import fs from 'fs';
import path from 'path';

// ─── Argumentos ───────────────────────────────────────────────────────────────

const [,, inputFile, USER_ID, ACCOUNT_ID] = process.argv;

if (!inputFile || !USER_ID || !ACCOUNT_ID) {
  console.error('Uso: node import-to-gastapp.mjs <output-file.json> <user_id> <account_id>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const today = new Date().toISOString().split('T')[0];
const outFile = path.join(path.dirname(inputFile), `import-${today}.sql`);

const lines = [];

const sql = (s) => lines.push(s);
const esc = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const catSubquery = (name) =>
  `(SELECT id FROM categories WHERE name = ${esc(name)} AND (user_id IS NULL OR user_id = ${esc(USER_ID)}) LIMIT 1)`;

// ─── Categorización de movimientos de cuenta ──────────────────────────────────

const SKIP_DESCRIPTIONS = new Set([
  'transf. ctas propias',
  'transferencia de cuenta propia',
]);

function categorize(movement) {
  const desc = movement.description.toLowerCase();
  const detail = (movement.detail ?? '').toLowerCase();

  if (movement.type === 'income') {
    if (desc.includes('sueldos'))                return 'Sueldo';
    if (desc.includes('proveedores'))            return 'Freelance';
    if (desc.includes('interes capitalizado'))   return 'Inversiones';
    if (desc.includes('cobro plazo'))            return 'Inversiones';
    if (desc.includes('acreditacion plazo'))     return 'Inversiones';
    if (desc.includes('reintegro'))              return 'Otros ingresos';
    if (desc.includes('transferencia de terceros')) return 'Otros ingresos';
    return 'Otros ingresos';
  }

  // expense
  if (desc.includes('transporte') || desc.includes('sube')) return 'Transporte';
  if (desc.includes('pago de servicios') || desc.includes('deb. autom')) return 'Servicios';
  if (desc.includes('pago tarjeta'))              return 'Otros gastos';
  if (desc.includes('plazo fijo'))                return 'Inversiones';
  if (desc.includes('compra venta de dolares'))   return 'Otros gastos';
  if (desc.includes('alquiler'))                  return 'Alquiler';

  // Transferencias a terceros: intentar categorizar por detalle
  if (desc.includes('transferencia a terceros')) {
    if (detail.includes('osde') || detail.includes('swiss') || detail.includes('medicus')) return 'Salud';
    return 'Otros gastos';
  }

  return 'Otros gastos';
}

// ─── Movimientos de cuenta ────────────────────────────────────────────────────

sql('-- =============================================');
sql('-- GASTAPP - Import desde Galicia scraper');
sql(`-- Generado: ${new Date().toISOString()}`);
sql(`-- Período: ${data.period?.from} → ${data.period?.to}`);
sql('-- =============================================');
sql('');
sql('BEGIN;');
sql('');

const movements = (data.movements ?? []).filter((m) => !m.pending);
const skipped = [];
const included = [];

sql(`-- ─── Transacciones de cuenta (${movements.length} movimientos) ───`);
sql('');

for (const m of movements) {
  const descLower = m.description.toLowerCase();

  if (SKIP_DESCRIPTIONS.has(descLower)) {
    skipped.push(m);
    sql(`-- [SKIP transfer] ${m.date} ${m.description} $${m.amount}`);
    continue;
  }

  included.push(m);
  const category = categorize(m);
  const description = m.detail
    ? m.detail.substring(0, 120).replace(/'/g, "''")
    : m.description;

  sql(`INSERT INTO transactions (user_id, account_id, category_id, type, amount, currency, description, date)`);
  sql(`SELECT`);
  sql(`  ${esc(USER_ID)},`);
  sql(`  ${esc(ACCOUNT_ID)},`);
  sql(`  ${catSubquery(category)},`);
  sql(`  ${esc(m.type)},`);
  sql(`  ${m.amount},`);
  sql(`  ${esc(m.currency)},`);
  sql(`  ${esc(description)},`);
  sql(`  ${esc(m.date)}`);
  sql(`ON CONFLICT DO NOTHING;`);
  sql('');
}

// ─── Tarjeta de crédito ───────────────────────────────────────────────────────

const card = data.cards?.summary;
const cardMovements = data.cards?.movements ?? [];

if (card) {
  sql(`-- ─── Tarjeta de crédito (${card.brand} ····${card.lastDigits}) ───`);
  sql('');

  // due_date: el banco devuelve "VENCE EL 08/05" → convertir a fecha ISO
  let dueDate = null;
  if (card.dueDate) {
    const match = card.dueDate.match(/(\d{2})\/(\d{2})/);
    if (match) {
      const year = new Date().getFullYear();
      dueDate = `${year}-${match[2]}-${match[1]}`;
    }
  }

  sql(`INSERT INTO credit_cards`);
  sql(`  (account_id, user_id, last_digits, brand, product, holder, due_date, closing_date,`);
  sql(`   consumption_ars, consumption_usd, min_payment, available_ars, available_usd, synced_at)`);
  sql(`VALUES (`);
  sql(`  ${esc(ACCOUNT_ID)}, ${esc(USER_ID)},`);
  sql(`  ${esc(card.lastDigits)}, ${esc(card.brand)}, ${esc(card.product)}, ${esc(card.holder)},`);
  sql(`  ${esc(dueDate)}, ${esc(card.closingDate)},`);
  sql(`  ${card.consumptionARS ?? 0}, ${card.consumptionUSD ?? 0},`);
  sql(`  ${card.minPayment ?? 0}, ${card.availableARS ?? 0}, ${card.availableUSD ?? 0},`);
  sql(`  NOW()`);
  sql(`);`);
  sql('');

  if (cardMovements.length > 0) {
    sql(`-- ─── Movimientos de tarjeta (${cardMovements.length}) ───`);
    sql('');
    sql(`DO $$`);
    sql(`DECLARE card_uuid UUID;`);
    sql(`BEGIN`);
    sql(`  SELECT id INTO card_uuid FROM credit_cards`);
    sql(`    WHERE account_id = ${esc(ACCOUNT_ID)} AND user_id = ${esc(USER_ID)}`);
    sql(`    ORDER BY created_at DESC LIMIT 1;`);
    sql('');
    sql(`  DELETE FROM card_movements WHERE card_id = card_uuid;`);
    sql('');

    for (const cm of cardMovements) {
      const mvType = cm.type === 'instalments' ? 'instalments' : 'credit';
      sql(`  INSERT INTO card_movements (card_id, user_id, date, merchant, amount, currency, installment, type)`);
      sql(`  VALUES (card_uuid, ${esc(USER_ID)}, ${esc(cm.date)}, ${esc(cm.merchant)},`);
      sql(`          ${cm.amount}, ${esc(cm.currency)}, ${esc(cm.installment)}, ${esc(mvType)});`);
    }

    sql(`END $$;`);
    sql('');
  }
}

// ─── Inversiones (plazos fijos) ───────────────────────────────────────────────

const investments = data.investments ?? [];

if (investments.length > 0) {
  sql(`-- ─── Plazos fijos (${investments.length}) ───`);
  sql('');

  for (const inv of investments) {
    const name = `Plazo fijo ${inv.type} ${inv.termDays}d`;
    sql(`INSERT INTO investments`);
    sql(`  (user_id, account_id, name, initial_amount, current_amount, currency,`);
    sql(`   started_at, tna, term_days, maturity_date, gain_amount)`);
    sql(`VALUES (`);
    sql(`  ${esc(USER_ID)}, ${esc(ACCOUNT_ID)}, ${esc(name)},`);
    sql(`  ${inv.capitalARS}, ${inv.totalARS}, ${esc(inv.currency)},`);
    sql(`  CURRENT_DATE,`);
    sql(`  ${inv.tna}, ${inv.termDays}, ${esc(inv.maturityDate)}, ${inv.gainARS}`);
    sql(`);`);
    sql('');
  }
}

sql('COMMIT;');
sql('');

// ─── Resumen ──────────────────────────────────────────────────────────────────

const output = lines.join('\n');
fs.writeFileSync(outFile, output, 'utf8');

console.log(`\n✅ SQL generado: ${outFile}`);
console.log(`\n📊 Resumen:`);
console.log(`   Movimientos importados : ${included.length}`);
console.log(`   Movimientos salteados  : ${skipped.length} (transferencias propias)`);
console.log(`   Movimientos de tarjeta : ${cardMovements.length}`);
console.log(`   Plazos fijos           : ${investments.length}`);
console.log(`\n🚀 Siguiente paso: pegá el contenido de ${path.basename(outFile)} en el editor SQL de Supabase.\n`);
