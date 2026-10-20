import { NextRequest, NextResponse } from 'next/server';
import { createServerClient }        from '@supabase/ssr';
import { cookies }                   from 'next/headers';
import {
  CategoryRef,
  buildKnowledgeBase,
  predictCategory,
} from '@/lib/categorizer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { account_id } = body as { account_id?: string };

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
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // 1. Cargar todas las categorías disponibles
    const { data: dbCategories } = await supabase
      .from('categories')
      .select('id, name, type')
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq('is_active', true);

    const categories: CategoryRef[] = (dbCategories ?? []).map((c: any) => ({
      id:   c.id,
      name: c.name,
      type: c.type === 'income' ? 'income' : 'expense',
    }));

    // 2. Cargar historial ya categorizado por el usuario para aprender patrones
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

    const knowledge = buildKnowledgeBase(
      categories,
      histTx ?? [],
      histCards ?? [],
    );

    // 3. Obtener transacciones bancarias sin categoría
    let txQuery = supabase
      .from('transactions')
      .select('id, description, type')
      .eq('user_id', user.id)
      .is('category_id', null);

    if (account_id) {
      txQuery = txQuery.eq('account_id', account_id);
    }

    const { data: uncategorizedTx } = await txQuery;

    let updatedTxCount = 0;
    const txMatches: Array<{ id: string; categoryName: string; reason: string }> = [];

    for (const tx of uncategorizedTx ?? []) {
      const match = predictCategory(
        {
          description: tx.description,
          type:        tx.type === 'income' ? 'income' : 'expense',
        },
        knowledge,
        categories,
      );

      if (match) {
        const { error } = await supabase
          .from('transactions')
          .update({ category_id: match.categoryId })
          .eq('id', tx.id);

        if (!error) {
          updatedTxCount++;
          txMatches.push({
            id: tx.id,
            categoryName: match.categoryName,
            reason: match.reason,
          });
        }
      }
    }

    // 4. Obtener consumos de tarjeta sin categoría
    const { data: uncategorizedMvs } = await supabase
      .from('card_movements')
      .select('id, merchant')
      .eq('user_id', user.id)
      .is('category_id', null);

    let updatedCardCount = 0;
    for (const mv of uncategorizedMvs ?? []) {
      const match = predictCategory(
        {
          merchant: mv.merchant,
          type:     'expense',
        },
        knowledge,
        categories,
      );

      if (match) {
        const { error } = await supabase
          .from('card_movements')
          .update({ category_id: match.categoryId })
          .eq('id', mv.id);

        if (!error) updatedCardCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      categorizedTransactions: updatedTxCount,
      categorizedCardMovements: updatedCardCount,
      totalCategorized: updatedTxCount + updatedCardCount,
      samples: txMatches.slice(0, 5),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
