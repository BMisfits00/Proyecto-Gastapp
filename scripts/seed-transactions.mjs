/**
 * Gastapp - Seed de transacciones de prueba
 * Uso: node scripts/seed-transactions.mjs <email> <password>
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xtxsbkiwvkvlqluxpwbk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9h2epmMc9kxY2FJ8i-Px3A_I53m5Q-y';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Uso: node scripts/seed-transactions.mjs <email> <password>');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  // 1. Login
  console.log('Autenticando...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) { console.error('Error de autenticación:', authError.message); process.exit(1); }
  const userId = authData.user.id;
  console.log('✓ Usuario:', email);

  // 2. Obtener o crear cuentas del usuario
  let { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id, name, currency')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (accErr) { console.error('Error al leer cuentas:', accErr.message); process.exit(1); }

  if (!accounts?.length) {
    console.log('No hay cuentas — creando cuentas de ejemplo...');
    const seedAccounts = [
      { name: 'Cuenta bancaria', type: 'bank',           provider: 'Galicia',   balance: 0, currency: 'ARS', color: '#4ADE80', icon: 'card',   has_daily_yield: false, daily_yield_rate: 0 },
      { name: 'Mercado Pago',    type: 'virtual_wallet',  provider: 'Mercado Pago', balance: 0, currency: 'ARS', color: '#60A5FA', icon: 'wallet', has_daily_yield: true,  daily_yield_rate: 0.0001 },
    ];
    for (const acc of seedAccounts) {
      const { error: e } = await supabase.from('accounts').insert({ ...acc, user_id: userId });
      if (e) console.warn('  ⚠ No se pudo crear cuenta:', e.message);
    }
    const { data: fresh } = await supabase.from('accounts').select('id, name, currency').eq('user_id', userId).eq('is_active', true);
    accounts = fresh;
  }

  if (!accounts?.length) { console.error('No se pudieron obtener cuentas'); process.exit(1); }
  console.log('✓ Cuentas:', accounts.map(a => a.name).join(', '));

  // 3. Obtener categorías del sistema
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, name, type')
    .is('user_id', null);
  if (catErr || !categories?.length) { console.error('No se encontraron categorías:', catErr?.message); process.exit(1); }

  const catByName = Object.fromEntries(categories.map(c => [c.name, c.id]));
  const mainAccount = accounts[0];
  const altAccount  = accounts[1] ?? accounts[0];
  const currency = mainAccount.currency || 'ARS';

  // Helper para elegir cuenta: sueldo y alquiler van a la principal, el resto puede variar
  const pickAccount = (cat) => {
    const mainCats = ['Sueldo', 'Alquiler', 'Servicios', 'Salud'];
    return mainCats.includes(cat) ? mainAccount : (Math.random() > 0.5 ? mainAccount : altAccount);
  };

  // 4. Definir transacciones variadas (últimos 3 meses)
  const today = new Date();
  const d = (daysAgo) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - daysAgo);
    return dt.toISOString().split('T')[0];
  };

  const transactions = [
    // --- INGRESOS ---
    { type: 'income', amount: 450000, category: 'Sueldo',          description: 'Sueldo marzo',           date: d(75) },
    { type: 'income', amount: 450000, category: 'Sueldo',          description: 'Sueldo abril',           date: d(45) },
    { type: 'income', amount: 450000, category: 'Sueldo',          description: 'Sueldo mayo',            date: d(15) },
    { type: 'income', amount: 85000,  category: 'Freelance',       description: 'Proyecto web cliente A', date: d(60) },
    { type: 'income', amount: 120000, category: 'Freelance',       description: 'Diseño logo marca',      date: d(30) },
    { type: 'income', amount: 45000,  category: 'Freelance',       description: 'Consultoría SEO',        date: d(10) },
    { type: 'income', amount: 18000,  category: 'Inversiones',     description: 'Renta FCI',              date: d(55) },
    { type: 'income', amount: 22000,  category: 'Inversiones',     description: 'Renta FCI',              date: d(25) },
    { type: 'income', amount: 5000,   category: 'Otros ingresos',  description: 'Venta artículo usado',   date: d(40) },

    // --- GASTOS ---
    // Comida
    { type: 'expense', amount: 8500,  category: 'Comida', description: 'Supermercado Día',      date: d(70) },
    { type: 'expense', amount: 3200,  category: 'Comida', description: 'Almuerzo trabajo',       date: d(68) },
    { type: 'expense', amount: 12800, category: 'Comida', description: 'Supermercado Coto',      date: d(62) },
    { type: 'expense', amount: 4500,  category: 'Comida', description: 'Delivery sushi',         date: d(58) },
    { type: 'expense', amount: 2800,  category: 'Comida', description: 'Café y medialunas',      date: d(50) },
    { type: 'expense', amount: 9200,  category: 'Comida', description: 'Supermercado Changomas', date: d(42) },
    { type: 'expense', amount: 6100,  category: 'Comida', description: 'Cena restaurante',       date: d(35) },
    { type: 'expense', amount: 11500, category: 'Comida', description: 'Supermercado semanal',   date: d(20) },
    { type: 'expense', amount: 3800,  category: 'Comida', description: 'Delivery pizza',         date: d(12) },
    { type: 'expense', amount: 1900,  category: 'Comida', description: 'Kiosco / snacks',        date: d(5)  },

    // Transporte
    { type: 'expense', amount: 4200,  category: 'Transporte', description: 'Carga SUBE mensual',   date: d(72) },
    { type: 'expense', amount: 1800,  category: 'Transporte', description: 'Taxi al aeropuerto',   date: d(65) },
    { type: 'expense', amount: 4200,  category: 'Transporte', description: 'Carga SUBE mensual',   date: d(42) },
    { type: 'expense', amount: 3500,  category: 'Transporte', description: 'Nafta auto',            date: d(38) },
    { type: 'expense', amount: 4200,  category: 'Transporte', description: 'Carga SUBE mensual',   date: d(12) },

    // Alquiler
    { type: 'expense', amount: 180000, category: 'Alquiler', description: 'Alquiler marzo',  date: d(74) },
    { type: 'expense', amount: 180000, category: 'Alquiler', description: 'Alquiler abril',  date: d(44) },
    { type: 'expense', amount: 180000, category: 'Alquiler', description: 'Alquiler mayo',   date: d(14) },

    // Servicios
    { type: 'expense', amount: 15000, category: 'Servicios', description: 'Internet Fibertel',    date: d(71) },
    { type: 'expense', amount: 8200,  category: 'Servicios', description: 'Luz EDESUR',            date: d(65) },
    { type: 'expense', amount: 4500,  category: 'Servicios', description: 'Gas Metrogas',          date: d(63) },
    { type: 'expense', amount: 15000, category: 'Servicios', description: 'Internet Fibertel',    date: d(41) },
    { type: 'expense', amount: 9800,  category: 'Servicios', description: 'Luz EDESUR',            date: d(35) },
    { type: 'expense', amount: 15000, category: 'Servicios', description: 'Internet Fibertel',    date: d(11) },
    { type: 'expense', amount: 7200,  category: 'Servicios', description: 'Agua AySA',             date: d(8)  },

    // Ocio
    { type: 'expense', amount: 12000, category: 'Ocio', description: 'Entrada recital',    date: d(60) },
    { type: 'expense', amount: 3500,  category: 'Ocio', description: 'Cine x2 entradas',   date: d(52) },
    { type: 'expense', amount: 8900,  category: 'Ocio', description: 'Salida con amigos',  date: d(45) },
    { type: 'expense', amount: 5400,  category: 'Ocio', description: 'Netflix + Spotify',  date: d(30) },
    { type: 'expense', amount: 7200,  category: 'Ocio', description: 'Bar cumpleaños',      date: d(22) },
    { type: 'expense', amount: 5400,  category: 'Ocio', description: 'Netflix + Spotify',  date: d(2)  },

    // Compras
    { type: 'expense', amount: 35000, category: 'Compras', description: 'Zapatillas Nike',       date: d(55) },
    { type: 'expense', amount: 8500,  category: 'Compras', description: 'Libro técnico',          date: d(48) },
    { type: 'expense', amount: 15000, category: 'Compras', description: 'Ropa temporada',         date: d(32) },
    { type: 'expense', amount: 6800,  category: 'Compras', description: 'Accesorios cocina',      date: d(18) },
    { type: 'expense', amount: 22000, category: 'Compras', description: 'Auriculares Bluetooth',  date: d(7)  },

    // Salud
    { type: 'expense', amount: 12000, category: 'Salud', description: 'Prepaga Osde',         date: d(73) },
    { type: 'expense', amount: 4500,  category: 'Salud', description: 'Farmacia',              date: d(58) },
    { type: 'expense', amount: 12000, category: 'Salud', description: 'Prepaga Osde',         date: d(43) },
    { type: 'expense', amount: 8000,  category: 'Salud', description: 'Consulta médica',      date: d(37) },
    { type: 'expense', amount: 12000, category: 'Salud', description: 'Prepaga Osde',         date: d(13) },
    { type: 'expense', amount: 2800,  category: 'Salud', description: 'Farmacia antibióticos', date: d(3)  },

    // Educación
    { type: 'expense', amount: 25000, category: 'Educación', description: 'Curso React Native',  date: d(67) },
    { type: 'expense', amount: 18000, category: 'Educación', description: 'Inglés online',        date: d(40) },

    // Otros gastos
    { type: 'expense', amount: 5000,  category: 'Otros gastos', description: 'Regalo cumpleaños',  date: d(46) },
    { type: 'expense', amount: 3200,  category: 'Otros gastos', description: 'Peluquería',          date: d(28) },
    { type: 'expense', amount: 2500,  category: 'Otros gastos', description: 'Limpieza ropa',        date: d(16) },
  ];

  // 5. Insertar transacciones
  console.log(`\nInsertando ${transactions.length} transacciones...`);
  let ok = 0, fail = 0;

  for (const tx of transactions) {
    const categoryId = catByName[tx.category];
    if (!categoryId) {
      console.warn(`  ⚠ Categoría no encontrada: ${tx.category}`);
      fail++;
      continue;
    }

    const chosenAccount = pickAccount(tx.category);
    const { error } = await supabase.from('transactions').insert({
      user_id:     userId,
      account_id:  chosenAccount.id,
      category_id: categoryId,
      type:        tx.type,
      amount:      tx.amount,
      currency,
      description: tx.description,
      date:        tx.date,
    });

    if (error) {
      console.warn(`  ✗ ${tx.description}: ${error.message}`);
      fail++;
    } else {
      ok++;
    }
  }

  // 6. Actualizar balances consultando las transacciones reales por cuenta
  for (const acc of accounts) {
    const { data: accTxs } = await supabase
      .from('transactions')
      .select('type, amount')
      .eq('user_id', userId)
      .eq('account_id', acc.id);
    if (!accTxs?.length) continue;
    const income  = accTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = accTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const accDelta = income - expense;
    await supabase.rpc('update_account_balance', { p_account_id: acc.id, p_delta: accDelta });
    console.log(`  Balance ${acc.name}: +${income.toLocaleString('es-AR')} / -${expense.toLocaleString('es-AR')} = $${accDelta.toLocaleString('es-AR')}`);
  }

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const delta = totalIncome - totalExpense;

  console.log(`\n✅ Listo: ${ok} transacciones insertadas, ${fail} fallaron`);
  console.log(`   Ingresos totales:  $${totalIncome.toLocaleString('es-AR')}`);
  console.log(`   Gastos totales:    $${totalExpense.toLocaleString('es-AR')}`);
  console.log(`   Delta en cuenta:  ${delta >= 0 ? '+' : ''}$${delta.toLocaleString('es-AR')}`);
}

main().catch(console.error);
