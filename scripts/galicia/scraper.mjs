/**
 * Galicia Online Banking Scraper
 * ================================
 * Extrae: movimientos de cuenta, tarjeta de crédito, plazos fijos y compras de dólares.
 *
 * Uso:
 *   node scraper.mjs               → headless (silencioso)
 *   node scraper.mjs --headed      → abre el navegador visible
 *   node scraper.mjs --headed --slow → navegador visible + lento (debug)
 *
 * Credenciales: crear credentials.json copiando credentials.example.json
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const HEADED    = args.includes('--headed');
const SLOW      = args.includes('--slow');
const TIMEOUT   = 30_000;

// Fecha de hace 6 meses para los movimientos
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
const DATE_FROM = `${String(sixMonthsAgo.getDate()).padStart(2,'0')}/${String(sixMonthsAgo.getMonth()+1).padStart(2,'0')}/${sixMonthsAgo.getFullYear()}`;
const DATE_TO   = (() => { const n = new Date(); return `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`; })();

// ─── Credenciales ────────────────────────────────────────────────────────────

function loadCredentials() {
  const path = join(__dir, 'credentials.json');
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.error('❌ No se encontró credentials.json');
    console.error('   Copiá credentials.example.json → credentials.json y completá tus datos.');
    process.exit(1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

async function screenshot(page, name) {
  mkdirSync(join(__dir, 'debug'), { recursive: true });
  await page.screenshot({ path: join(__dir, 'debug', `${name}.png`), fullPage: true });
}

/** Convierte "1.234,56" → 1234.56 */
function parseARS(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
}

/** Convierte "DD/MM/YYYY" → "YYYY-MM-DD" */
function toISO(dmy) {
  if (!dmy) return null;
  const [d, m, y] = dmy.trim().split('/');
  return `${y}-${m}-${d}`;
}

// ─── Interceptor de respuestas JSON ──────────────────────────────────────────

function createInterceptor(page) {
  const store = {};
  page.on('response', async res => {
    const url = res.url();
    const ct  = res.headers()['content-type'] || '';
    if (!ct.includes('json')) return;
    if (url.includes('analytics') || url.includes('stats') || url.includes('KeepAlive')) return;

    // Guardar solo las URLs de APIs de negocio
    const keys = [
      'GetMovimientosCuenta',
      'GetConsumosTarjetas',
      'obtener-plazos-fijos',
      'bff/overview/cards',
      'bff/cards/movements-tc',
      'GetSeccionMisCuentas',
    ];
    const matched = keys.find(k => url.includes(k));
    if (matched) {
      try { store[matched] = await res.json(); } catch {}
    }
  });
  return store;
}

// ─── Login ───────────────────────────────────────────────────────────────────

async function login(page, creds) {
  console.log('🔐 Iniciando sesión...');
  await page.goto('https://onlinebanking.bancogalicia.com.ar/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('#DocumentNumber', { timeout: TIMEOUT });

  await page.locator('#DocumentNumber').pressSequentially(creds.dni,      { delay: 80 });
  await page.locator('#UserName').click();
  await page.locator('#UserName').pressSequentially(creds.username,        { delay: 80 });
  await page.locator('#Password').click();
  await page.locator('#Password').pressSequentially(creds.password,        { delay: 80 });

  await page.waitForSelector('#submitButton:not([disabled])', { timeout: TIMEOUT });
  await page.click('#submitButton');

  try {
    // Esperar navegación post-login: el banco redirige a /inicio
    await page.waitForURL('**/inicio', { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle');
    console.log('✓ Sesión iniciada —', page.url());
  } catch {
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    // Si ya navegó aunque waitForURL falló, continuar igual
    if (!currentUrl.includes('/login')) {
      console.log('✓ Sesión iniciada (redirect alternativo) —', currentUrl);
      return;
    }
    await screenshot(page, 'login-error');
    const err = await page.locator('.validation-summary-errors, .error-message, [class*="error"]').first().textContent().catch(() => '');
    throw new Error(`Login falló. URL: ${currentUrl}. ${err.trim() || 'Ver debug/login-error.png'}`);
  }
}

// ─── Helpers de navegación ──────────────────────────────────────────────────

/** Navega a una sección usando el menulink ID (funciona en ambos subdominios) */
async function goToSection(page, menulinkId) {
  // Detectar en qué subdominio estamos para usar la URL correcta
  const base = page.url().includes('cuentas.bancogalicia') ? 'https://cuentas.bancogalicia.com.ar' : 'https://onlinebanking.bancogalicia.com.ar';
  await page.goto(`${base}/navigation/menulink/${menulinkId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
}

// ─── Movimientos de cuenta ───────────────────────────────────────────────────

async function scrapeMovements(page, store) {
  console.log('\n🏦 Movimientos de cuenta...');
  try {
    // Cuentas = menulink 2
    await goToSection(page, 2);

    // Disparar la carga de movimientos clickeando la primera card de cuenta
    await page.locator('div.box_ctas.clickeable').first().click({ force: true });
    await page.waitForTimeout(5000);

    const raw = store['GetMovimientosCuenta'];
    if (!raw?.Model?.Movimientos?.length) {
      console.warn('  ⚠ Sin movimientos en la respuesta');
      return [];
    }

    const movs = raw.Model.Movimientos.map(m => ({
      id:          m.ID,
      date:        toISO(m.Fecha),
      description: m.DescripcionAMostrar,
      detail:      m.DescripcionSide?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      type:        m.IconoLabel === 'Ingreso' ? 'income' : 'expense',
      amount:      Math.abs(m.IconoLabel === 'Ingreso' ? parseARS(m.ImporteCredito) : parseARS(m.ImporteDebito)),
      balance:     m.SaldoParcial,
      currency:    m.Moneda === 2 ? 'USD' : 'ARS',
      pending:     m.EsMovimientoPendiente,
    }));

    console.log(`  ✓ ${movs.length} movimientos (${DATE_FROM} → ${DATE_TO})`);
    return movs;

  } catch (err) {
    await screenshot(page, 'movements-error');
    console.warn('  ⚠ Error:', err.message);
    return [];
  }
}

// ─── Tarjeta de crédito ──────────────────────────────────────────────────────

async function scrapeCards(page, store) {
  console.log('\n💳 Tarjeta de crédito...');
  try {
    await goToSection(page, 390); // Tarjetas
    await page.waitForTimeout(5000); // SPA tarda más en cargar

    // Overview de la tarjeta
    const overview = store['bff/overview/cards'];
    const cardInfo = overview?.data?.[0]?.credit_cards?.[0] ?? {};

    const summary = {
      lastDigits:      cardInfo.last_digits,
      brand:           cardInfo.brand,
      product:         cardInfo.product,
      holder:          cardInfo.card_printed_name,
      status:          cardInfo.status,
      expirationDate:  cardInfo.card_expiration_date,
      consumptionARS:  cardInfo.consumption?.find(c => c.currency === 'ARS')?.total_amount ?? 0,
      consumptionUSD:  cardInfo.consumption?.find(c => c.currency === 'USD')?.total_amount ?? 0,
      paymentMethod:   cardInfo.payment_method?.description,
      fundsSource:     cardInfo.payment_method?.funds_source_description,
    };

    // También usar el endpoint legacy para cierre y vencimiento
    const legacyCard = store['GetConsumosTarjetas']?.Model?.Tarjetas?.[0];
    if (legacyCard) {
      summary.dueDate      = legacyCard.FechaVencimiento;
      summary.closingDate  = legacyCard.FechaProximoCierre;
      summary.minPayment   = legacyCard.PagoMinimo;
      summary.availableARS = parseARS(legacyCard.Saldo);
      summary.availableUSD = parseARS(legacyCard.SaldoDolares);
    }

    // Movimientos individuales de tarjeta
    const rawMov = store['bff/cards/movements-tc'];
    const cardMovements = (rawMov?.data?.[0]?.consumptions ?? []).map(m => ({
      date:        m.transaction_date,
      merchant:    m.merchant_name?.trim(),
      currency:    m.final_currency,
      amount:      m.final_amount,
      installment: m.installment_plan > 0 ? `${m.installment_number}/${m.installment_plan}` : null,
      type:        m.movement_type,
    }));

    console.log(`  ✓ Tarjeta ...${summary.lastDigits} | ARS $${summary.consumptionARS?.toLocaleString('es-AR')} | USD ${summary.consumptionUSD}`);
    console.log(`  ✓ ${cardMovements.length} movimientos de tarjeta`);

    return { summary, movements: cardMovements };

  } catch (err) {
    await screenshot(page, 'cards-error');
    console.warn('  ⚠ Error:', err.message);
    return { summary: {}, movements: [] };
  }
}

// ─── Plazos fijos ─────────────────────────────────────────────────────────────

async function scrapeInvestments(page, store) {
  console.log('\n📈 Inversiones / Plazos fijos...');
  try {
    await goToSection(page, 6); // Inversiones
    await page.waitForTimeout(5000);

    // Los plazos fijos vienen en el HTMLVista que se renderiza en el DOM
    // Extraemos directamente del DOM ya renderizado
    const pfRows = await page.evaluate(() => {
      const results = [];
      // Cada fila de plazo fijo tiene clase o está en una tabla
      const rows = [...document.querySelectorAll('table.tabla-pf tr:not(:first-child), [class*="plazo-fijo"] tr:not(:first-child), .tabla-pf tr:not(:first-child)')];

      if (rows.length === 0) {
        // Alternativa: buscar por contenido de la página
        const allText = document.body.innerText;
        const matches = allText.match(/Tradicional.+?(?=Tradicional|Fondos|$)/gs) ?? [];
        return matches.map(m => ({ raw: m.trim().replace(/\s+/g, ' ').substring(0, 200) }));
      }

      rows.forEach(row => {
        const cells = [...row.querySelectorAll('td')].map(td => td.innerText.trim());
        if (cells.length >= 3) results.push(cells);
      });
      return results;
    });

    // Si no hay tabla, intentar con la API interceptada
    const apiData = store['obtener-plazos-fijos'];
    let investments = [];

    if (apiData?.Model?.PlazosFijos?.length) {
      investments = apiData.Model.PlazosFijos.map(pf => ({
        type:        pf.Tipo ?? 'Tradicional',
        term:        pf.Plazo,
        maturityDate: toISO(pf.FechaVencimiento),
        tna:         pf.TNA,
        capitalARS:  pf.MontoImpuesto ?? pf.Capital,
        totalARS:    pf.Monto ?? pf.MontoFinal,
        currency:    'ARS',
      }));
    } else if (pfRows.length) {
      // Parsear desde el texto del DOM
      // Formato típico: "Tradicional Sin alias 33 días 04/05/2026 22,00% $800.000,00 $803.375,34 $3.375,34 0,42%"
      investments = pfRows.map(r => {
        const text = r.raw ?? (Array.isArray(r) ? r.join(' ') : '');
        const dateMatch   = text.match(/(\d{2}\/\d{2}\/\d{4})/);
        const tnaMatch    = text.match(/([\d,]+)\s*%/);
        const amounts     = [...text.matchAll(/\$([\d.]+,\d{2})/g)].map(m => parseARS(m[1]));
        const daysMatch   = text.match(/(\d+)\s*días/);
        return {
          type:         text.startsWith('Tradicional') ? 'Tradicional' : text.split(' ')[0],
          termDays:     daysMatch ? parseInt(daysMatch[1]) : null,
          maturityDate: dateMatch ? toISO(dateMatch[1]) : null,
          tna:          tnaMatch  ? parseFloat(tnaMatch[1].replace(',', '.')) : null,
          capitalARS:   amounts[0] ?? null,
          totalARS:     amounts[1] ?? null,
          gainARS:      amounts[2] ?? null,
          currency:     'ARS',
        };
      });
    }

    console.log(`  ✓ ${investments.length} plazos fijos`);
    return investments;

  } catch (err) {
    await screenshot(page, 'investments-error');
    console.warn('  ⚠ Error:', err.message);
    return [];
  }
}

// ─── Compras de dólares ──────────────────────────────────────────────────────

async function scrapeFxPurchases(page) {
  console.log('\n💵 Compras de dólares...');
  try {
    await goToSection(page, 76); // Compra/Venta de Dólares
    await page.waitForTimeout(3000);

    // La tabla de historial es server-rendered — lectura directa
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('table tr:not(:first-child)')]
        .map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim()))
        .filter(cells => cells.length >= 4)
    );

    const purchases = rows.map(cells => {
      // [fecha, operación, cotización, monto acreditado (USD), monto debitado (ARS)]
      const amountUSD = parseFloat(cells[3]?.replace('USD ', '').replace(',', '.')) || 0;
      const amountARS = parseFloat(cells[4]?.replace('$ ', '').replace(/\./g, '').replace(',', '.')) || 0;
      const rate      = cells[2] ? parseARS(cells[2]) : (amountUSD > 0 ? +(amountARS / amountUSD).toFixed(2) : null);

      return {
        date:       toISO(cells[0]),
        operation:  cells[1],
        rateARS:    rate,
        amountUSD,
        amountARS,
        type:       cells[1]?.toLowerCase().includes('compra') ? 'buy' : 'sell',
      };
    });

    console.log(`  ✓ ${purchases.length} operaciones de cambio`);
    return purchases;

  } catch (err) {
    await screenshot(page, 'fx-error');
    console.warn('  ⚠ Error:', err.message);
    return [];
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const creds = loadCredentials();

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo:   SLOW ? 400 : 0,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:  { width: 1280, height: 900 },
    locale:    'es-AR',
  });

  const page  = await context.newPage();
  const store = createInterceptor(page);

  page.on('console', () => {});
  page.on('pageerror', () => {});

  try {
    await login(page, creds);

    // Ejecutar en secuencia para mantener la sesión activa
    const movements   = await scrapeMovements(page, store);
    const cards       = await scrapeCards(page, store);
    const investments = await scrapeInvestments(page, store);
    const fxPurchases = await scrapeFxPurchases(page);

    const output = {
      scrapedAt:    new Date().toISOString(),
      period:       { from: DATE_FROM, to: DATE_TO },
      movements,
      cards,
      investments,
      fxPurchases,
    };

    // Guardar JSON
    const outPath = join(__dir, `output-${today()}.json`);
    writeFileSync(outPath, JSON.stringify(output, null, 2));

    // Resumen
    const incomes  = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0);
    const expenses = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0);

    console.log('\n── Resumen ─────────────────────────────────────────');
    console.log(`   Movimientos cuenta:    ${movements.length} (↑ $${incomes.toLocaleString('es-AR')} / ↓ $${expenses.toLocaleString('es-AR')})`);
    console.log(`   Tarjeta ...${cards.summary?.lastDigits}:      ${cards.movements.length} movimientos | ARS $${cards.summary?.consumptionARS?.toLocaleString('es-AR')} | USD ${cards.summary?.consumptionUSD}`);
    console.log(`   Plazos fijos:          ${investments.length}`);
    console.log(`   Compras/ventas USD:    ${fxPurchases.length}`);
    console.log(`   Output:                ${outPath}`);
    console.log('────────────────────────────────────────────────────\n');

    return output;

  } catch (err) {
    console.error('\n❌ Error fatal:', err.message);
    await screenshot(page, 'fatal-error');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
