// ============================================================================
// GASTAPP - Motor Inteligente de Auto-Categorización
// ============================================================================
// 1. Aprende de asignaciones previas del usuario (patrones repetitivos mes a mes).
// 2. Extrae raíces de comercios (ej: "DIA TIENDA 344" -> "DIA") y CUITs de transferencias.
// 3. Aplica similitud difusa (fuzzy/tokens/substrings) para asociar ítems iguales o similares.
// 4. Aplica reglas heurísticas de palabras clave para banca argentina y tarjetas.
// ============================================================================

export interface CategoryRef {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export interface LearnedPattern {
  raw: string;
  clean: string;
  tokens: string[];
  cuit: string | null;
  categoryId: string;
  categoryName: string;
  type: 'income' | 'expense';
}

export interface CategorizationKnowledge {
  // Lista de patrones aprendidos directamente de las asignaciones manuales del usuario
  learnedPatterns: LearnedPattern[];
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

/**
 * Extrae tokens significativos (palabras >= 3 caracteres, ignorando números y stop words bancarias).
 */
export function extractSignificantTokens(text: string | null | undefined): string[] {
  if (!text) return [];
  const clean = extractCleanMerchantOrConcept(text);
  const stopWords = new Set([
    'de', 'la', 'el', 'los', 'las', 'en', 'por', 'con', 'para', 'del', 'al',
    'srl', 'sa', 'sas', 'cia', 'sh', 'cta', 'ctas', 'caja', 'ahorro', 'cajas',
    'pago', 'pagos', 'debito', 'credito', 'tarjeta', 'transf', 'transferencia',
  ]);

  return clean
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !/^\d+$/.test(t) && !stopWords.has(t));
}

/**
 * Coeficiente de similitud de Sørensen-Dice entre dos cadenas (0 a 1).
 */
export function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sA = a.replace(/\s+/g, '');
  const sB = b.replace(/\s+/g, '');
  if (sA.length < 2 || sB.length < 2) return sA === sB ? 1 : 0;

  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bg = str.slice(i, i + 2);
      bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    return bigrams;
  };

  const bgA = getBigrams(sA);
  const bgB = getBigrams(sB);
  let intersection = 0;

  for (const [bg, count] of bgA.entries()) {
    if (bgB.has(bg)) {
      intersection += Math.min(count, bgB.get(bg)!);
    }
  }

  const totalA = Array.from(bgA.values()).reduce((sum, n) => sum + n, 0);
  const totalB = Array.from(bgB.values()).reduce((sum, n) => sum + n, 0);

  return (2 * intersection) / (totalA + totalB);
}

/**
 * Compara dos listas de tokens significativos y calcula su grado de superposición.
 */
export function tokenOverlapScore(tokensA: string[], tokensB: string[]): { score: number; shared: string[] } {
  if (tokensA.length === 0 || tokensB.length === 0) return { score: 0, shared: [] };

  const setB = new Set(tokensB);
  const shared = tokensA.filter(t => setB.has(t));
  const union = new Set([...tokensA, ...tokensB]);

  const minLen = Math.min(tokensA.length, tokensB.length);
  const containment = shared.length / minLen;
  const jaccard = shared.length / union.size;

  // Si contiene todos los términos clave de la cadena más corta
  const score = Math.max(jaccard, containment >= 1 && minLen >= 1 ? 0.85 : 0);

  return { score, shared };
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
  const categoryById = new Map<string, CategoryRef>();
  const learnedPatterns: LearnedPattern[] = [];

  // Indexar categorías
  for (const cat of categories) {
    categoryByNameAndType.set(`${normalizeText(cat.name)}_${cat.type}`, cat.id);
    categoryById.set(cat.id, cat);
  }

  // Identificar categorías genéricas (estas NO deben aprenderse como preferencia de usuario)
  const genericCatIds = new Set(
    categories
      .filter(c => {
        const n = normalizeText(c.name);
        return n === 'otros gastos' || n === 'otros ingresos' || n === 'varios' || n === 'sin categoria';
      })
      .map(c => c.id)
  );

  // 1. Aprender de transacciones de cuenta asignadas por el usuario
  for (const tx of historicalTransactions) {
    if (!tx.category_id || !tx.description) continue;
    if (genericCatIds.has(tx.category_id)) continue; // Ignorar genéricas

    const cat = categoryById.get(tx.category_id);
    if (!cat) continue;

    const norm = normalizeText(tx.description);
    const clean = extractCleanMerchantOrConcept(tx.description);
    const cuit = extractCuit(tx.description);
    const tokens = extractSignificantTokens(clean);

    if (norm) exactMap.set(norm, tx.category_id);
    if (cuit) cuitMap.set(cuit, tx.category_id);
    if (clean && clean.length >= 3) tokenMap.set(clean, tx.category_id);

    learnedPatterns.push({
      raw: norm,
      clean,
      tokens,
      cuit,
      categoryId: cat.id,
      categoryName: cat.name,
      type: tx.type === 'income' ? 'income' : 'expense',
    });
  }

  // 2. Aprender de consumos de tarjeta asignados por el usuario
  for (const mv of historicalCardMovements) {
    if (!mv.category_id || !mv.merchant) continue;
    if (genericCatIds.has(mv.category_id)) continue; // Ignorar genéricas

    const cat = categoryById.get(mv.category_id);
    if (!cat) continue;

    const norm = normalizeText(mv.merchant);
    const clean = extractCleanMerchantOrConcept(mv.merchant);
    const cuit = extractCuit(mv.merchant);
    const tokens = extractSignificantTokens(clean);

    if (norm) exactMap.set(norm, mv.category_id);
    if (cuit) cuitMap.set(cuit, mv.category_id);
    if (clean && clean.length >= 3) tokenMap.set(clean, mv.category_id);

    learnedPatterns.push({
      raw: norm,
      clean,
      tokens,
      cuit,
      categoryId: cat.id,
      categoryName: cat.name,
      type: 'expense',
    });
  }

  return { learnedPatterns, exactMap, cuitMap, tokenMap, categoryByNameAndType };
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
  const cleanCandidate = extractCleanMerchantOrConcept(normDesc || normFull);
  const candidateTokens = extractSignificantTokens(cleanCandidate);
  const candidateCuit = extractCuit(fullText);

  if (!normFull && !normDesc) return null;

  // ==========================================================================
  // FASE 1: APRENDIZAJE DE ASIGNACIONES DEL USUARIO (Patrones aprendidos)
  // ==========================================================================
  if (knowledge.learnedPatterns && knowledge.learnedPatterns.length > 0) {
    const applicablePatterns = knowledge.learnedPatterns.filter(p => p.type === item.type);

    // 1.1 Coincidencia Exacta con Ítem Previamente Categorizado
    for (const pattern of applicablePatterns) {
      if (
        (normDesc && normDesc === pattern.raw) ||
        (cleanCandidate && cleanCandidate === pattern.clean)
      ) {
        return {
          categoryId: pattern.categoryId,
          categoryName: pattern.categoryName,
          confidence: 'high',
          reason: `Coincidencia exacta con asignación previa: "${pattern.clean || pattern.raw}"`,
        };
      }
    }

    // 1.2 Coincidencia por CUIT
    if (candidateCuit) {
      for (const pattern of applicablePatterns) {
        if (pattern.cuit && pattern.cuit === candidateCuit) {
          return {
            categoryId: pattern.categoryId,
            categoryName: pattern.categoryName,
            confidence: 'high',
            reason: `Mismo CUIT ${candidateCuit} asignado por el usuario a ${pattern.categoryName}`,
          };
        }
      }
    }

    // 1.3 Coincidencia por Contención de Subcadena (Ítems similares / ramas de comercio)
    // Ej: "BURGER KING ALTO PALERMO" contiene "BURGER KING"
    // Ej: "SUPERMERCADOS DIA TIENDA 520" contiene "DIA TIENDA"
    if (cleanCandidate && cleanCandidate.length >= 4) {
      for (const pattern of applicablePatterns) {
        if (pattern.clean && pattern.clean.length >= 4) {
          if (
            cleanCandidate.includes(pattern.clean) ||
            pattern.clean.includes(cleanCandidate)
          ) {
            return {
              categoryId: pattern.categoryId,
              categoryName: pattern.categoryName,
              confidence: 'high',
              reason: `Contiene concepto asignado previamente: "${pattern.clean}"`,
            };
          }
        }
      }
    }

    // 1.4 Coincidencia por Superposición de Tokens Significativos (Palabras Clave Compartidas)
    // Ej: "TRANSFERENCIA A MARIA PEREZ 12345" vs "TRANSFERENCIA A MARIA PEREZ"
    if (candidateTokens.length > 0) {
      let bestPattern: LearnedPattern | null = null;
      let bestScore = 0;
      let bestShared: string[] = [];

      for (const pattern of applicablePatterns) {
        if (pattern.tokens.length === 0) continue;
        const { score, shared } = tokenOverlapScore(candidateTokens, pattern.tokens);
        if (score > bestScore) {
          bestScore = score;
          bestPattern = pattern;
          bestShared = shared;
        }
      }

      // Si comparten tokens relevantes con alta similitud
      if (bestPattern && (bestScore >= 0.65 || (bestShared.length >= 2 && bestScore >= 0.5))) {
        return {
          categoryId: bestPattern.categoryId,
          categoryName: bestPattern.categoryName,
          confidence: 'medium',
          reason: `Concepto similar a asignación previa ("${bestShared.join(' ')}")`,
        };
      }
    }

    // 1.5 Similitud de Texto Difusa (Dice similarity >= 0.82)
    if (cleanCandidate && cleanCandidate.length >= 4) {
      for (const pattern of applicablePatterns) {
        if (pattern.clean && pattern.clean.length >= 4) {
          const sim = diceSimilarity(cleanCandidate, pattern.clean);
          if (sim >= 0.82) {
            return {
              categoryId: pattern.categoryId,
              categoryName: pattern.categoryName,
              confidence: 'medium',
              reason: `Similitud textual (${Math.round(sim * 100)}%) con "${pattern.clean}"`,
            };
          }
        }
      }
    }
  }

  // ==========================================================================
  // FASE 2: REGLAS HEURÍSTICAS POR PALABRAS CLAVE DEL SISTEMA
  // ==========================================================================
  const rules = item.type === 'income' ? INCOME_KEYWORD_RULES : EXPENSE_KEYWORD_RULES;

  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (normFull.includes(kw)) {
        let catId = knowledge.categoryByNameAndType.get(`${normalizeText(rule.categoryName)}_${item.type}`);
        let finalCatName = rule.categoryName;

        // Fallback temporal si no existe 'Suscripciones'
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

  // ==========================================================================
  // FASE 3: CATEGORÍA POR DEFECTO (GENÉRICA)
  // ==========================================================================
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
