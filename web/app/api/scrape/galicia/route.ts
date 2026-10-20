import { NextRequest, NextResponse } from 'next/server';
import { spawn }                     from 'child_process';
import { createServerClient }        from '@supabase/ssr';
import { cookies }                   from 'next/headers';
import { existsSync, readFileSync, statSync }  from 'fs';
import path                          from 'path';

// El scraper puede tardar 1-2 min
export const maxDuration = 300;

const GALICIA_DIR = path.resolve(process.cwd(), '../scripts/galicia');

const SKIP_DESCRIPTIONS = new Set([
  'transf. ctas propias',
  'transferencia de cuenta propia',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function categorizeAccountMovement(m: any): string {
  const desc = (m.description || '').toLowerCase();
  const detail = (m.detail || '').toLowerCase();

  if (m.type === 'income') {
    if (desc.includes('sueldos')) return 'Sueldo';
    if (desc.includes('proveedores')) return 'Freelance';
    if (desc.includes('interes capitalizado')) return 'Inversiones';
    if (desc.includes('cobro plazo')) return 'Inversiones';
    if (desc.includes('acreditacion plazo')) return 'Inversiones';
    if (desc.includes('reintegro')) return 'Otros ingresos';
    if (desc.includes('transferencia de terceros')) return 'Otros ingresos';
    return 'Otros ingresos';
  }

  // expense
  if (desc.includes('transporte') || desc.includes('sube')) return 'Transporte';
  if (desc.includes('pago de servicios') || desc.includes('deb. autom')) return 'Servicios';
  if (desc.includes('pago tarjeta')) return 'Otros gastos';
  if (desc.includes('plazo fijo')) return 'Inversiones';
  if (desc.includes('compra venta de dolares')) return 'Otros gastos';
  if (desc.includes('alquiler')) return 'Alquiler';
  if (desc.includes('transferencia a terceros')) {
    if (detail.includes('osde') || detail.includes('swiss') || detail.includes('medicus')) return 'Salud';
    return 'Otros gastos';
  }
  return 'Otros gastos';
}

// ─── Ejecutar el scraper ──────────────────────────────────────────────────────

function runScraper(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scraper.mjs'], {
      cwd: GALICIA_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });

    child.on('close', (code: number) => {
      if (code !== 0) reject(new Error(err || `Scraper terminó con código ${code}`));
      else resolve(out);
    });

    child.on('error', (e: Error) => reject(e));
  });
}

// ─── POST /api/scrape/galicia ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { account_id, import_only } = body as { account_id?: string; import_only?: boolean };

  if (!account_id) {
    return NextResponse.json({ error: 'account_id requerido' }, { status: 400 });
  }

  // Auth: obtener usuario desde la sesión
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Ejecutar el scraper (salvo que sea import_only)
  if (!import_only) {
    const credsPath = path.join(GALICIA_DIR, 'credentials.json');
    if (!existsSync(credsPath)) {
      return NextResponse.json(
        { error: 'No se encontró credentials.json en scripts/galicia/. Copiá credentials.example.json y completá tus datos.' },
        { status: 400 },
      );
    }

    try {
      await runScraper();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Error en scraper: ${msg}` }, { status: 500 });
    }
  }

  // Leer el output generado hoy
  const today      = new Date().toISOString().split('T')[0];
  const outputFile = path.join(GALICIA_DIR, `output-${today}.json`);

  if (!existsSync(outputFile)) {
    return NextResponse.json({ error: `No se encontró output-${today}.json. Ejecutá el scraper primero.` }, { status: 500 });
  }

  const fileStat = statSync(outputFile);
  const syncTimestamp = fileStat.mtime.toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scraped: any = JSON.parse(readFileSync(outputFile, 'utf8'));
  const summary      = scraped.cards?.summary;
  const movements    = scraped.cards?.movements ?? [];

  if (!summary?.lastDigits) {
    return NextResponse.json({ error: 'El scraper no devolvió datos de tarjeta' }, { status: 404 });
  }

  // Parsear fecha de vencimiento: "VENCE EL 08/05" → "2026-05-08"
  let dueDate: string | null = null;
  if (summary.dueDate) {
    const m = String(summary.dueDate).match(/(\d{2})\/(\d{2})/);
    if (m) dueDate = `${new Date().getFullYear()}-${m[2]}-${m[1]}`;
  }

  // Guardar o actualizar credit_card (robusto frente a restricciones o sin UNIQUE constraint)
  const cardPayload = {
    account_id,
    user_id:         user.id,
    last_digits:     summary.lastDigits,
    brand:           summary.brand    ?? null,
    product:         summary.product  ?? null,
    holder:          summary.holder   ?? null,
    due_date:        dueDate,
    closing_date:    summary.closingDate  ?? null,
    consumption_ars: summary.consumptionARS ?? 0,
    consumption_usd: summary.consumptionUSD ?? 0,
    min_payment:     summary.minPayment ?? 0,
    available_ars:   summary.availableARS ?? 0,
    available_usd:   summary.availableUSD ?? 0,
    synced_at:       syncTimestamp,
  };

  const { data: existingCard } = await supabase
    .from('credit_cards')
    .select('id')
    .eq('account_id', account_id)
    .maybeSingle();

  let savedCardId = existingCard?.id;

  if (savedCardId) {
    const { error: updateErr } = await supabase
      .from('credit_cards')
      .update(cardPayload)
      .eq('id', savedCardId);

    if (updateErr) {
      return NextResponse.json(
        { error: `Error al actualizar tarjeta: ${updateErr.message}` },
        { status: 500 },
      );
    }
  } else {
    const { data: newCard, error: insertErr } = await supabase
      .from('credit_cards')
      .insert(cardPayload)
      .select('id')
      .single();

    if (insertErr || !newCard?.id) {
      return NextResponse.json(
        { error: `Error al guardar tarjeta: ${insertErr?.message ?? 'sin id'}` },
        { status: 500 },
      );
    }
    savedCardId = newCard.id;
  }

  const savedCard = { id: savedCardId };

  // Actualizar last_scraped_at en la cuenta si existe la columna
  try {
    await supabase
      .from('accounts')
      .update({ last_scraped_at: syncTimestamp })
      .eq('id', account_id);
  } catch {
    // Si la columna aún no fue creada en accounts, se ignora silenciosamente
  }

  // Reemplazar movimientos con auto-categorización por merchant
  if (movements.length > 0) {
    // Construir mapa merchant_lower → category_id desde asignaciones previas del usuario
    const { data: prevMvs } = await supabase
      .from('card_movements')
      .select('merchant, category_id')
      .eq('user_id', user.id)
      .not('category_id', 'is', null);

    const merchantCatMap: Record<string, string> = {};
    (prevMvs ?? []).forEach((m: { merchant: string; category_id: string }) => {
      merchantCatMap[m.merchant.trim().toLowerCase()] = m.category_id;
    });

    await supabase.from('card_movements').delete().eq('card_id', savedCard.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = movements.map((m: any) => {
      const key = (m.merchant ?? '').trim().toLowerCase();
      return {
        card_id:     savedCard.id,
        user_id:     user.id,
        date:        m.date,
        merchant:    m.merchant,
        amount:      m.amount,
        currency:    m.currency,
        installment: m.installment ?? null,
        type:        m.type === 'instalments' ? 'instalments' : 'credit',
        category_id: merchantCatMap[key] ?? null,
      };
    });

    const { error: mvErr } = await supabase.from('card_movements').insert(rows);
    if (mvErr) {
      return NextResponse.json({ error: `Error al guardar movimientos de tarjeta: ${mvErr.message}` }, { status: 500 });
    }
  }

  // ─── Procesar e insertar transacciones bancarias (Gastos e Ingresos) ───────
  const accountMovements = (scraped.movements ?? []).filter((m: any) => !m.pending);
  let newTxCount = 0;

  if (accountMovements.length > 0) {
    const { data: dbCategories } = await supabase
      .from('categories')
      .select('id, name, type')
      .or(`user_id.is.null,user_id.eq.${user.id}`);

    const catByName: Record<string, string> = {};
    (dbCategories ?? []).forEach((c: { id: string; name: string }) => {
      catByName[c.name.trim().toLowerCase()] = c.id;
    });

    const { data: prevTx } = await supabase
      .from('transactions')
      .select('description, category_id')
      .eq('user_id', user.id)
      .not('category_id', 'is', null);

    const descCatMap: Record<string, string> = {};
    (prevTx ?? []).forEach((t: { description: string | null; category_id: string }) => {
      if (t.description) descCatMap[t.description.trim().toLowerCase()] = t.category_id;
    });

    const { data: existingTransactions } = await supabase
      .from('transactions')
      .select('date, amount, type, description')
      .eq('account_id', account_id);

    const existingTxCounts = new Map<string, number>();
    (existingTransactions ?? []).forEach(tx => {
      const descNorm = (tx.description || '').trim().toLowerCase();
      const key = `${tx.date}_${Number(tx.amount).toFixed(2)}_${tx.type}_${descNorm}`;
      existingTxCounts.set(key, (existingTxCounts.get(key) || 0) + 1);
    });

    const newTransactionsToInsert: Array<{
      user_id: string;
      account_id: string;
      category_id: string | null;
      type: 'income' | 'expense';
      amount: number;
      currency: string;
      description: string;
      date: string;
    }> = [];

    for (const m of accountMovements) {
      const descLower = (m.description || '').toLowerCase();
      if (SKIP_DESCRIPTIONS.has(descLower)) continue;

      const desc = (m.detail ? m.detail.substring(0, 120) : m.description) || '';
      const descNorm = desc.trim().toLowerCase();
      const amountNum = Number(m.amount);
      if (!amountNum || isNaN(amountNum) || amountNum <= 0) continue;

      const key = `${m.date}_${amountNum.toFixed(2)}_${m.type}_${descNorm}`;
      const count = existingTxCounts.get(key) || 0;
      if (count > 0) {
        existingTxCounts.set(key, count - 1);
        continue;
      }

      let catId = descCatMap[descNorm] ?? null;
      if (!catId) {
        const catName = categorizeAccountMovement(m);
        catId = catByName[catName.toLowerCase()] ?? null;
      }

      newTransactionsToInsert.push({
        user_id: user.id,
        account_id,
        category_id: catId,
        type: m.type === 'income' ? 'income' : 'expense',
        amount: amountNum,
        currency: m.currency || 'ARS',
        description: desc,
        date: m.date,
      });
    }

    if (newTransactionsToInsert.length > 0) {
      newTxCount = newTransactionsToInsert.length;
      for (let i = 0; i < newTransactionsToInsert.length; i += 100) {
        const batch = newTransactionsToInsert.slice(i, i + 100);
        const { error: txErr } = await supabase.from('transactions').insert(batch);
        if (txErr) {
          console.error('Error al insertar transacciones:', txErr);
        }
      }
    }

    // Actualizar balance de cuenta con el saldo del extracto bancario más reciente
    if (accountMovements[0].balance !== undefined && accountMovements[0].balance !== null) {
      try {
        await supabase
          .from('accounts')
          .update({
            balance: Number(accountMovements[0].balance),
            last_scraped_at: syncTimestamp,
          })
          .eq('id', account_id);
      } catch {
        // Silencioso
      }
    }
  }

  return NextResponse.json({
    ok:             true,
    cardLastDigits: summary.lastDigits,
    movementsCount: movements.length,
    newTxCount,
    syncedAt:       syncTimestamp,
  });
}
