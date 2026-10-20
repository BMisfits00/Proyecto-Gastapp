import { NextRequest, NextResponse } from 'next/server';
import { spawn }                     from 'child_process';
import { createServerClient }        from '@supabase/ssr';
import { cookies }                   from 'next/headers';
import { existsSync, readFileSync, statSync }  from 'fs';
import path                          from 'path';
import {
  CategoryRef,
  buildKnowledgeBase,
  predictCategory,
} from '@/lib/categorizer';

// El scraper puede tardar 1-2 min
export const maxDuration = 300;

const GALICIA_DIR = path.resolve(process.cwd(), '../scripts/galicia');

const SKIP_DESCRIPTIONS = new Set([
  'transf. ctas propias',
  'transferencia de cuenta propia',
]);

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

  // Buscar todas las cuentas activas para identificar la cuenta principal (Caja de Ahorro en Pesos)
  const { data: dbAccounts } = await supabase
    .from('accounts')
    .select('id, name, currency, provider')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const galiciaAccounts = (dbAccounts || []).filter((a: any) =>
    a.provider?.toLowerCase().includes('galicia') ||
    a.name.toLowerCase().includes('galicia')
  );

  const primaryGaliciaAcc = galiciaAccounts.find((a: any) =>
    (a.currency === 'ARS' || !a.currency) &&
    !a.name.toLowerCase().includes('corriente') &&
    !a.name.toLowerCase().includes('cta cte') &&
    !a.name.toLowerCase().includes('dólar') &&
    !a.name.toLowerCase().includes('dolar')
  ) || galiciaAccounts[0];

  const primaryAccountId = primaryGaliciaAcc ? primaryGaliciaAcc.id : account_id;

  // Guardar o actualizar credit_card vinculada SIEMPRE a la cuenta principal en pesos
  const cardPayload = {
    account_id:      primaryAccountId,
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
    .eq('account_id', primaryAccountId)
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

  // ─── Cargar Base de Conocimiento para Auto-Categorización ──────────────────
  const { data: dbCategories } = await supabase
    .from('categories')
    .select('id, name, type')
    .or(`user_id.is.null,user_id.eq.${user.id}`);

  const categories: CategoryRef[] = (dbCategories ?? []).map((c: any) => ({
    id:   c.id,
    name: c.name,
    type: c.type === 'income' ? 'income' : 'expense',
  }));

  // Asegurar categoría 'Suscripciones'
  const hasSubs = categories.some(c => c.name.toLowerCase() === 'suscripciones' && c.type === 'expense');
  if (!hasSubs) {
    const { data: newCat } = await supabase
      .from('categories')
      .insert({
        user_id:   user.id,
        name:      'Suscripciones',
        type:      'expense',
        color:     '#8B5CF6',
        icon:      'repeat',
        is_active: true,
      })
      .select('id, name, type')
      .single();

    if (newCat) {
      categories.push({
        id:   newCat.id,
        name: newCat.name,
        type: 'expense',
      });
    }
  }

  const [{ data: histTx }, { data: histCards }] = await Promise.all([
    supabase
      .from('transactions')
      .select('description, category_id, type')
      .eq('user_id', user.id)
      .not('category_id', 'is', null),
    supabase
      .from('card_movements')
      .select('merchant, category_id')
      .eq('user_id', user.id)
      .not('category_id', 'is', null),
  ]);

  const knowledge = buildKnowledgeBase(categories, histTx ?? [], histCards ?? []);

  // ─── Reemplazar movimientos de tarjeta con auto-categorización ──────────────
  if (movements.length > 0) {
    await supabase.from('card_movements').delete().eq('card_id', savedCard.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = movements.map((m: any) => {
      const match = predictCategory(
        { merchant: m.merchant, type: 'expense' },
        knowledge,
        categories,
      );
      return {
        card_id:     savedCard.id,
        user_id:     user.id,
        date:        m.date,
        merchant:    m.merchant,
        amount:      m.amount,
        currency:    m.currency,
        installment: m.installment ?? null,
        type:        m.type === 'instalments' ? 'instalments' : 'credit',
        category_id: match?.categoryId ?? null,
      };
    });

    const { error: mvErr } = await supabase.from('card_movements').insert(rows);
    if (mvErr) {
      return NextResponse.json({ error: `Error al guardar movimientos de tarjeta: ${mvErr.message}` }, { status: 500 });
    }
  }

  // ─── Procesar e insertar transacciones bancarias (Gastos e Ingresos) ───────
  let newTxCount = 0;

  if (Array.isArray(scraped.accounts) && scraped.accounts.length > 0) {
    // Modo Multi-cuenta: procesar todas las cajas y cuentas encontradas en Galicia
    const { data: dbAccounts } = await supabase
      .from('accounts')
      .select('id, name, currency, provider')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const galiciaAccounts = (dbAccounts || []).filter((a: any) =>
      a.provider?.toLowerCase().includes('galicia') ||
      a.name.toLowerCase().includes('galicia')
    );

    for (const scrapedAcc of scraped.accounts) {
      let targetAccount: any = null;

      if (scrapedAcc.currency === 'USD') {
        targetAccount = galiciaAccounts.find((a: any) =>
          a.currency === 'USD' ||
          a.name.toLowerCase().includes('dólar') ||
          a.name.toLowerCase().includes('dolar')
        );
      } else if (
        scrapedAcc.name.toLowerCase().includes('corriente') ||
        scrapedAcc.name.toLowerCase().includes('cta cte')
      ) {
        targetAccount = galiciaAccounts.find((a: any) =>
          a.name.toLowerCase().includes('corriente') ||
          a.name.toLowerCase().includes('cta cte')
        );
      } else {
        targetAccount = galiciaAccounts.find((a: any) =>
          a.id === account_id ||
          (a.currency === 'ARS' && !a.name.toLowerCase().includes('corriente'))
        ) || galiciaAccounts[0];
      }

      if (!targetAccount) {
        const { data: createdAcc } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            name: scrapedAcc.name,
            type: 'bank',
            provider: 'Banco Galicia',
            balance: Number(scrapedAcc.balance) || 0,
            currency: scrapedAcc.currency || 'ARS',
            is_active: true,
          })
          .select('id, name, currency, provider')
          .single();

        if (createdAcc) {
          targetAccount = createdAcc;
          galiciaAccounts.push(createdAcc);
        }
      }

      if (!targetAccount) continue;

      const accMvs = (scrapedAcc.movements ?? []).filter((m: any) => !m.pending);

      if (accMvs.length > 0) {
        const { data: existingTransactions } = await supabase
          .from('transactions')
          .select('date, amount, type, description')
          .eq('account_id', targetAccount.id);

        const existingTxCounts = new Map<string, number>();
        (existingTransactions ?? []).forEach((tx: any) => {
          const descNorm = (tx.description || '').trim().toLowerCase();
          const key = `${tx.date}_${Number(tx.amount).toFixed(2)}_${tx.type}_${descNorm}`;
          existingTxCounts.set(key, (existingTxCounts.get(key) || 0) + 1);
        });

        const newTxs: any[] = [];
        for (const m of accMvs) {
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

          const match = predictCategory(
            {
              description: desc,
              detail:      m.detail,
              type:        m.type === 'income' ? 'income' : 'expense',
            },
            knowledge,
            categories,
          );

          newTxs.push({
            user_id:     user.id,
            account_id:  targetAccount.id,
            category_id: match?.categoryId ?? null,
            type:        m.type === 'income' ? 'income' : 'expense',
            amount:      amountNum,
            currency:    m.currency || targetAccount.currency || 'ARS',
            description: desc,
            date:        m.date,
          });
        }

        if (newTxs.length > 0) {
          newTxCount += newTxs.length;
          for (let i = 0; i < newTxs.length; i += 100) {
            const batch = newTxs.slice(i, i + 100);
            const { error: txErr } = await supabase.from('transactions').insert(batch);
            if (txErr) console.error('Error al insertar transacciones:', txErr);
          }
        }
      }

      // Actualizar balance de la caja con el saldo activo
      if (scrapedAcc.balance !== undefined && scrapedAcc.balance !== null) {
        const balNum = Number(scrapedAcc.balance);
        if (!isNaN(balNum)) {
          await supabase
            .from('accounts')
            .update({ balance: balNum })
            .eq('id', targetAccount.id);
        }
      }
    }
  } else {
    // Modo de retrocompatibilidad: cuenta individual (siempre asignada a la Caja de Ahorro en Pesos principal)
    const accountMovements = (scraped.movements ?? []).filter((m: any) => !m.pending);

    if (accountMovements.length > 0) {
      const { data: existingTransactions } = await supabase
        .from('transactions')
        .select('date, amount, type, description')
        .eq('account_id', primaryAccountId);

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

        const match = predictCategory(
          {
            description: desc,
            detail:      m.detail,
            type:        m.type === 'income' ? 'income' : 'expense',
          },
          knowledge,
          categories,
        );

        newTransactionsToInsert.push({
          user_id:     user.id,
          account_id:  primaryAccountId,
          category_id: match?.categoryId ?? null,
          type:        m.type === 'income' ? 'income' : 'expense',
          amount:      amountNum,
          currency:    m.currency || 'ARS',
          description: desc,
          date:        m.date,
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

      // Actualizar balance de cuenta principal con el saldo del extracto bancario más reciente
      if (accountMovements.length > 0 && accountMovements[0]?.balance !== undefined && accountMovements[0]?.balance !== null) {
        try {
          const latestBal = Number(accountMovements[0].balance);
          if (!isNaN(latestBal)) {
            const { error: balErr } = await supabase
              .from('accounts')
              .update({
                balance: latestBal,
              })
              .eq('id', primaryAccountId);
            if (balErr) {
              console.error('Error al actualizar saldo activo de la cuenta:', balErr);
            } else {
              try {
                await supabase.from('accounts').update({ last_scraped_at: syncTimestamp }).eq('id', primaryAccountId);
              } catch {}
            }
          }
        } catch (err) {
          console.error('Excepción al actualizar saldo de cuenta:', err);
        }
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
