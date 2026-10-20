// ============================================================================
// GASTAPP - Motor Inteligente de Auto-Categorización
// ============================================================================
// 1. Aprende de asignaciones previas del usuario (patrones repetitivos mes a mes).
// 2. Extrae raíces de comercios (ej: "DIA TIENDA 344" -> "DIA") y CUITs de transferencias.
// 3. Aplica reglas heurísticas de palabras clave para banca argentina y tarjetas.
// ============================================================================

export interface CategoryRef {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export interface CategorizationKnowledge {
  // Mapa de texto exacto limpio -> category_id
  exactMap: Map<string, string>;
  // Mapa de CUIT extraído de transferencias -> category_id (mantiene el patrón entre meses)
  cuitMap: Map<string, string>;
  // Mapa de raíz de comercio/concepto -> category_id
  tokenMap: Map<string, string>;
  // Categorías del sistema / usuario mapeadas por nombre
  categoryByNameAndType: Map<string, string>;
}

/**
 * Normaliza un texto: minúsculas, sin tildes ni caracteres especiales.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9\s*]/g, ' ')   // Conservar asteriscos (útil para MERPAGO*...)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae CUIT de un texto si existe (11 dígitos continuos comunes en Argentina).
 */
export function extractCuit(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\b(20|23|24|27|30|33|34)\d{9}\b/);
  return match ? match[0] : null;
}

/**
 * Limpia y extrae la raíz principal de un comercio o descripción bancaria.
 * Remueve máscaras de tarjeta (4517XXXXXXXXXX45), códigos de terminal (A204),
 * prefijos bancarios redundantes, etc.
 */
export function extractCleanMerchantOrConcept(text: string | null | undefined): string {
  if (!text) return '';
  let str = normalizeText(text);

  // Remover máscaras de tarjetas
  str = str.replace(/\d{4}\s*x+\s*\d{4}/g, '');
  str = str.replace(/\b\d{4}x+\d{4}\b/g, '');

  // Remover códigos de terminal comunes (ej: A204, A001, A279, POS12)
  str = str.replace(/\ba\d{3,4}\b/g, '');

  // Remover palabras de protocolo bancario
  const noise = [
    'compra debito', 'deb autom de serv', 'deb autom', 'transferencia a terceros',
    'transferencias cash', 'transf ctas propias', 'pago de servicios', 'pago tarjeta master',
    'pago tarjeta visa', 'operacion', 'varios', 'banco de galicia', 'banco santander',
    'link', 'mercado libre srl', 'merpago', 'cuota sind', 'c sindical',
  ];

  for (const n of noise) {
    str = str.replace(new RegExp(`\\b${n}\\b`, 'g'), '');
  }

  // Quitar números aislados de sucursales (ej: "tienda 344" -> "tienda")
  str = str.replace(/\b\d+\b/g, '');

  return str.replace(/\s+/g, ' ').trim();
}

// ─── Diccionario de Palabras Clave (Banca Argentina & Tarjetas) ───────────────

interface KeywordRule {
  keywords: string[];
  categoryName: string;
}

const EXPENSE_KEYWORD_RULES: KeywordRule[] = [
  // Comida / Supermercados / Gastronomía
  {
    categoryName: 'Comida',
    keywords: [
      'pedidosya', 'rappi', 'mcdonald', 'burger', 'mostaza', 'starbucks', 'pancheria',
      'sushi', 'coto', 'dia tienda', 'dia%', 'supermercado', 'carrefour', 'jumbo', 'disco',
      'vea', 'hipermay', 'vital', 'makro', 'chango', 'dhabasto', 'panaderia', 'confiteria',
      'carniceria', 'verduleria', 'rotiseria', 'heladeria', 'freddo', 'lucciano', 'grido',
      'restaurante', 'cerveceria', 'pizzeria', 'empanad', 'almacen', 'kiosco', 'open 25',
      'abasto', 'pancho', 'gastronomia', 'bar', 'cafe', 'rojooriente', 'magdalenasola',
      'andescorrient', 'pvs*supermercado', 'tienda 344',
    ],
  },
  // Transporte / Combustible
  {
    categoryName: 'Transporte',
    keywords: [
      'sube', 'emova', 'subte', 'trenes', 'didi', 'uber', 'cabify', 'taxi', 'ypf',
      'shell', 'axion', 'puma energy', 'combustible', 'peaje', 'ausol', 'autopistas',
      'estacionamiento', 'garage', 'estacion de servicio',
    ],
  },
  // Servicios Públicos e Impuestos
  {
    categoryName: 'Servicios',
    keywords: [
      'edenor', 'edesur', 'metrogas', 'naturgy', 'aysa', 'telecom', 'fibertel', 'personal',
      'claro', 'movistar', 'telecentro', 'iplan', 'abl', 'rentas', 'arba', 'agip',
      'deb. autom', 'cuota-sind', 'asociacion cuota', 'afip', 'monotributo', 'vep',
      'luz', 'gas', 'electricidad', 'internet', 'cable', 'telefonia',
    ],
  },
  // Salud y Farmacia
  {
    categoryName: 'Salud',
    keywords: [
      'osde', 'swiss medical', 'medicus', 'galeno', 'omint', 'farmacia', 'farmacity',
      'dr. ahorro', 'vantage', 'optica', 'laboratorio', 'odontolog', 'clinica',
      'hospital', 'sanatorio', 'medicamento', 'consultorio',
    ],
  },
  // Suscripciones digitales fijas y recurrentes
  {
    categoryName: 'Suscripciones',
    keywords: [
      'spotify', 'netflix', 'youtube', 'youtubeprem', 'disney', 'max', 'hbo',
      'prime video', 'amazon prime', 'paramount', 'apple.com', 'apple services',
      'icloud', 'google *', 'google storage', 'chatgpt', 'openai', 'github',
      'midjourney', 'notion', 'crunchyroll', 'playstation plus', 'ps plus',
      'xbox game pass', 'game pass', 'deezer', 'star+', 'flow',
    ],
  },
  // Ocio, Salidas y Entretenimiento variable
  {
    categoryName: 'Ocio',
    keywords: [
      'cine', 'cinemark', 'hoyts', 'showroom', 'teatro', 'recital', 'concierto',
      'ticketek', 'allaccess', 'passline', 'livepass', 'movistar arena', 'estadio',
      'entradas', 'steam', 'playstation', 'nintendo', 'videojuegos', 'boliche',
      'fiesta', 'parque', 'bowling', 'escape room', 'evento',
    ],
  },
  // Alquiler y Vivienda
  {
    categoryName: 'Alquiler',
    keywords: [
      'alquiler', 'expensas', 'inmobiliaria', 'consorcio', 'administracion expensas',
    ],
  },
  // Compras generales / Retail
  {
    categoryName: 'Compras',
    keywords: [
      'mercadolibre', 'mercado libre', 'zara', 'falabella', 'tienda', 'indumentaria',
      'ropa', 'calzado', 'dexter', 'sportline', 'ferreteria', 'easy', 'sodimac',
      'fravega', 'musimundo', 'libreria', 'bazar',
    ],
  },
  // Educación
  {
    categoryName: 'Educación',
    keywords: [
      'colegio', 'universidad', 'instituto', 'curso', 'coderhouse', 'platzi', 'udemy',
      'cuota escolar', 'facultad', 'uade', 'uba', 'itba', 'utn', 'matricula',
    ],
  },
  // Inversiones
  {
    categoryName: 'Inversiones',
    keywords: [
      'plazo fijo', 'compra venta de dolares', 'dolar mep', 'lecap', 'bono', 'caucion',
    ],
  },
];

const INCOME_KEYWORD_RULES: KeywordRule[] = [
  // Sueldos / Haberes
  {
    categoryName: 'Sueldo',
    keywords: [
      'sueldo', 'haberes', 'cash sueldos', 'remuneracion', 'jornal', 'honorarios de profesionales',
      'pago de haberes', 'consultoria en t',
    ],
  },
  // Freelance / Honorarios
  {
    categoryName: 'Freelance',
    keywords: [
      'proveedores', 'upwork', 'fiverr', 'deel', 'payoneer', 'servicios profesionales',
      'factura', 'honorarios',
    ],
  },
  // Inversiones y Rendimientos
  {
    categoryName: 'Inversiones',
    keywords: [
      'interes capitalizado', 'cobro plazo', 'acreditacion plazo', 'plazo fijo',
      'dividendo', 'rendimiento', 'rescate fci', 'fci', 'caucion', 'venta dolar',
    ],
  },
  // Otros Ingresos
  {
    categoryName: 'Otros ingresos',
    keywords: [
      'reintegro', 'devolucion', 'premio', 'acreditacion', 'transferencia de terceros',
    ],
  },
];

// ─── Constructor de la Base de Conocimiento ───────────────────────────────────

export function buildKnowledgeBase(
  categories: CategoryRef[],
  historicalTransactions: Array<{
    description: string | null;
    category_id: string | null;
    type: string;
  }>,
  historicalCardMovements: Array<{
    merchant: string;
    category_id: string | null;
  }> = [],
): CategorizationKnowledge {
  const exactMap = new Map<string, string>();
  const cuitMap = new Map<string, string>();
  const tokenMap = new Map<string, string>();
  const categoryByNameAndType = new Map<string, string>();

  // Indexar categorías
  for (const cat of categories) {
    categoryByNameAndType.set(`${normalizeText(cat.name)}_${cat.type}`, cat.id);
  }

  // 1. Aprender de transacciones de cuenta
  for (const tx of historicalTransactions) {
    if (!tx.category_id || !tx.description) continue;
    const norm = normalizeText(tx.description);
    if (norm) exactMap.set(norm, tx.category_id);

    // CUIT
    const cuit = extractCuit(tx.description);
    if (cuit) cuitMap.set(cuit, tx.category_id);

    // Raíz
    const root = extractCleanMerchantOrConcept(tx.description);
    if (root && root.length >= 3) tokenMap.set(root, tx.category_id);
  }

  // 2. Aprender de consumos de tarjeta
  for (const mv of historicalCardMovements) {
    if (!mv.category_id || !mv.merchant) continue;
    const norm = normalizeText(mv.merchant);
    if (norm) exactMap.set(norm, mv.category_id);

    const root = extractCleanMerchantOrConcept(mv.merchant);
    if (root && root.length >= 3) tokenMap.set(root, mv.category_id);
  }

  return { exactMap, cuitMap, tokenMap, categoryByNameAndType };
}

// ─── Predictor de Categoría ──────────────────────────────────────────────────

export interface MatchResult {
  categoryId: string;
  categoryName: string;
  confidence: 'high' | 'medium' | 'rule';
  reason: string;
}

export function predictCategory(
  item: {
    description?: string | null;
    detail?: string | null;
    merchant?: string | null;
    type: 'income' | 'expense';
  },
  knowledge: CategorizationKnowledge,
  categories: CategoryRef[],
): MatchResult | null {
  const fullText = `${item.description ?? ''} ${item.detail ?? ''} ${item.merchant ?? ''}`.trim();
  const normFull = normalizeText(fullText);
  const normDesc = normalizeText(item.description ?? item.merchant ?? '');

  if (!normFull) return null;

  // 1. Coincidencia Histórica Exacta
  if (knowledge.exactMap.has(normDesc)) {
    const id = knowledge.exactMap.get(normDesc)!;
    const cat = categories.find(c => c.id === id);
    if (cat) {
      return {
        categoryId: id,
        categoryName: cat.name,
        confidence: 'high',
        reason: 'Coincidencia exacta con movimiento previo',
      };
    }
  }

  // 2. Coincidencia por CUIT (reincidencia mensual de transferencias al mismo destinatario)
  const cuit = extractCuit(fullText);
  if (cuit && knowledge.cuitMap.has(cuit)) {
    const id = knowledge.cuitMap.get(cuit)!;
    const cat = categories.find(c => c.id === id);
    if (cat) {
      return {
        categoryId: id,
        categoryName: cat.name,
        confidence: 'high',
        reason: `Reincidencia por CUIT ${cuit}`,
      };
    }
  }

  // 3. Coincidencia por Raíz del Comercio / Concepto
  const root = extractCleanMerchantOrConcept(normDesc);
  if (root && root.length >= 3 && knowledge.tokenMap.has(root)) {
    const id = knowledge.tokenMap.get(root)!;
    const cat = categories.find(c => c.id === id);
    if (cat) {
      return {
        categoryId: id,
        categoryName: cat.name,
        confidence: 'medium',
        reason: `Patrón de comercio recurrente ("${root}")`,
      };
    }
  }

  // 4. Reglas Heurísticas por Palabras Clave
  const rules = item.type === 'income' ? INCOME_KEYWORD_RULES : EXPENSE_KEYWORD_RULES;

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (normFull.includes(kw)) {
        let catId = knowledge.categoryByNameAndType.get(`${normalizeText(rule.categoryName)}_${item.type}`);
        let finalCatName = rule.categoryName;

        // Si la regla busca 'Suscripciones' pero aún no existe en la base de datos, fallback temporal a 'Ocio'
        if (!catId && rule.categoryName === 'Suscripciones') {
          catId = knowledge.categoryByNameAndType.get(`ocio_${item.type}`);
          finalCatName = 'Ocio';
        }

        if (catId) {
          return {
            categoryId: catId,
            categoryName: finalCatName,
            confidence: 'rule',
            reason: `Palabra clave detectada: "${kw}"`,
          };
        }
      }
    }
  }

  // 5. Fallback a categoría genérica si existe
  const defaultName = item.type === 'income' ? 'Otros ingresos' : 'Otros gastos';
  const defaultCatId = knowledge.categoryByNameAndType.get(`${normalizeText(defaultName)}_${item.type}`);
  if (defaultCatId) {
    return {
      categoryId: defaultCatId,
      categoryName: defaultName,
      confidence: 'rule',
      reason: 'Categoría por defecto',
    };
  }

  return null;
}
