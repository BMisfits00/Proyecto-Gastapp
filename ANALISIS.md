# Análisis del Proyecto — Gastapp

## Descripción general

Gastapp es una aplicación móvil de finanzas personales orientada al mercado argentino. Permite al usuario registrar ingresos y gastos, gestionar múltiples cuentas bancarias/virtuales/efectivo, y visualizar la salud financiera del mes a través de métricas y gráficos.

El proyecto es un **MVP funcional en desarrollo activo**. Hay pantallas completas y otras con funcionalidad parcial (edición de transacciones, Face ID conectado a sesión, entre otros).

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework mobile | React Native 0.81 + Expo SDK 54 |
| Framework web | Next.js 16.2 (App Router, Turbopack) |
| Lenguaje | TypeScript (modo `strict`) |
| Backend | Supabase — PostgreSQL + Auth + RLS |
| Navegación (mobile) | React Navigation v6 (Stack + Bottom Tabs) |
| Estado del servidor | TanStack Query v5 (React Query) |
| Autenticación biométrica | expo-local-authentication (Face ID) |
| Almacenamiento seguro | expo-secure-store |
| Gráficos (mobile) | react-native-chart-kit (BarChart, LineChart, PieChart) |
| Gráficos (web) | Recharts |
| Gradientes | expo-linear-gradient |
| Gestos | react-native-gesture-handler + react-native-reanimated |
| Estilos (web) | Tailwind CSS v4 |
| Scraper | Playwright (Node.js) — Banco Galicia |

No hay backend propio: **todo el acceso a datos va exclusivamente a través del cliente JS de Supabase**.

---

## Arquitectura en capas

```
App.tsx  (providers globales)
    │
    ├── GestureHandlerRootView
    ├── SafeAreaProvider
    ├── QueryClientProvider        ← TanStack Query (staleTime: 5 min, retry: 1)
    └── AuthProvider               ← Contexto de sesión
            │
        RootNavigator
            │
    ┌───────┴────────┐
    │                │
AuthNavigator    AppNavigator
(sin sesión)    (con sesión)
```

### Regla de capas (estricta)

```
Screens / Components
        ↓  solo consumen
    Custom Hooks   (src/hooks/)
        ↓  solo llaman
      Services     (src/services/)
        ↓  solo usan
  supabase client  (src/lib/supabase.ts)
        ↓
    Supabase (nube)
```

Los servicios no importan hooks ni componentes. Los hooks no llaman a Supabase directamente. Esta separación se respeta en todo el código base.

---

## Estructura de archivos

```
Proyecto Gastapp/
├── App.tsx                          ← Punto de entrada Expo, monta todos los providers
├── index.js                         ← Entry point de Expo
├── app.json                         ← Config Expo (nombre, orientación, plugins, bundle IDs)
├── babel.config.js                  ← babel-preset-expo + reanimated plugin
├── tsconfig.json                    ← Alias @/* → src/*
├── .env / .env.example              ← Variables EXPO_PUBLIC_SUPABASE_*
│
├── packages/
│   └── shared/
│       └── index.ts                ← Tipos compartidos entre mobile y web
│                                      (Account, Transaction, CreditCard, CardMovement, etc.)
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  ← Tablas base, índices, triggers, RLS
│   │   ├── 002_rpc_functions.sql   ← Función update_account_balance
│   │   ├── 003_credit_cards_and_investments.sql  ← credit_cards, card_movements, investments
│   │   └── 004_card_movements_category.sql       ← category_id en card_movements
│   └── seed.sql                    ← 13 categorías del sistema
│
├── scripts/
│   └── galicia/
│       ├── scraper.mjs             ← Scraper Playwright del Banco Galicia (headless/headed)
│       ├── import-to-gastapp.mjs  ← Convierte output JSON a SQL importable (legacy)
│       ├── credentials.json        ← Credenciales del banco (no commitear)
│       └── output-YYYY-MM-DD.json ← Resultado de cada corrida del scraper
│
├── web/                            ← Aplicación web (Next.js 16)
│   ├── app/
│   │   ├── (app)/                  ← Rutas autenticadas
│   │   │   ├── accounts/
│   │   │   │   ├── page.tsx        ← Lista de cuentas
│   │   │   │   └── [id]/page.tsx   ← Detalle de cuenta (4 tabs con filtros avanzados)
│   │   │   ├── transactions/page.tsx
│   │   │   └── reports/page.tsx
│   │   ├── api/
│   │   │   └── scrape/galicia/route.ts  ← API route que ejecuta el scraper + importa datos
│   │   ├── login/
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── supabase.ts             ← Cliente browser (createBrowserClient)
│   │   └── types.ts                ← Re-exporta desde @gastapp/shared
│   └── .env.local                  ← NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
│
└── src/                            ← App mobile (Expo/React Native)
    ├── types/index.ts              ← Tipos del dominio mobile
    ├── constants/colors.ts         ← Design system completo
    ├── lib/supabase.ts             ← Cliente Supabase singleton
    ├── contexts/AuthContext.tsx    ← Estado global de autenticación
    ├── navigation/                 ← Navegación (Root, Auth, App)
    ├── services/                   ← Acceso a Supabase (sin UI)
    │   └── creditCardService.ts   ← CRUD de credit_cards y card_movements
    ├── hooks/                      ← TanStack Query wrappers
    │   └── useAccountDetail.ts    ← Hooks para AccountDetailScreen
    ├── utils/                      ← Formatters + cálculos financieros
    ├── components/                 ← Componentes reutilizables
    └── screens/                    ← Pantallas organizadas por dominio
        └── accounts/
            ├── AccountsScreen.tsx
            └── AccountDetailScreen.tsx
```

---

## Base de datos (Supabase / PostgreSQL)

### Diagrama de tablas

```
auth.users  (Supabase nativo)
    │
    ├──► profiles          (1:1)   full_name, avatar_url, currency
    ├──► accounts          (1:N)   cuentas financieras del usuario
    │       └──► credit_cards  (1:1)   tarjeta vinculada a la cuenta
    │                 └──► card_movements  (1:N)   consumos de la tarjeta
    ├──► categories        (1:N)   propias + sistema (user_id IS NULL)
    ├──► transactions      (1:N)   movimientos (income / expense / transfer)
    ├──► investments       (1:N)   plazos fijos y otras inversiones
    └──► daily_yields      (1:N)   rendimientos diarios de billeteras virtuales
```

### Tablas clave

**`accounts`** — Representa cada cuenta financiera.
- `type`: `bank | virtual_wallet | cash`
- `balance`: saldo actualizado por RPC, no calculado en tiempo real
- `has_daily_yield` + `daily_yield_rate`: para billeteras como Mercado Fondo

**`transactions`** — Cada ingreso o gasto.
- `type`: `income | expense | transfer`
- `amount`: siempre positivo; el signo lo determina el `type`
- Joined a `accounts` y `categories` en todas las queries (`select('*, account:accounts(...), category:categories(...)')`)

**`categories`** — `user_id IS NULL` = sistema (seed), con `user_id` = propia del usuario.

**`daily_yields`** — Registra ganancia diaria de billeteras con rendimiento: `balance`, `yield_rate`, `yield_amount`.

### Seguridad (RLS)

Todas las tablas tienen Row Level Security con la política `user_id = auth.uid()`. El cliente Supabase envía automáticamente el JWT en cada request. No hay posibilidad de que un usuario acceda a datos de otro.

### Funciones RPC

`update_account_balance(p_account_id UUID, p_delta DECIMAL)` — incrementa/decrementa el balance de una cuenta atómicamente. Se llama desde `transactionService.create()` justo después del INSERT.

---

### Migración 003 — Tarjetas de crédito e inversiones (plazos fijos)

Agrega soporte para tarjetas vinculadas a cuentas bancarias y extiende el modelo de inversiones para plazos fijos.

**`credit_cards`** — Una tarjeta por cuenta bancaria.
- Vinculada a `accounts` via `account_id`
- Almacena: últimos 4 dígitos, marca, producto, titular, fecha de vencimiento y cierre, consumos ARS/USD del período, pago mínimo, disponible
- `synced_at`: marca de cuándo fue sincronizada desde el banco

**`card_movements`** — Consumos individuales de la tarjeta.
- `merchant`, `amount`, `currency`, `installment` (ej: "1/3"), `type` (`credit | instalments | debit`)
- Se reemplazan completamente en cada sync (DELETE + INSERT con auto-categorización)

**Extensión de `investments`** — Campos nuevos para plazos fijos:
- `tna`: tasa nominal anual (ej: 22.0)
- `term_days`: días del plazo (ej: 33)
- `maturity_date`: fecha de vencimiento
- `gain_amount`: ganancia estimada al vencimiento

### Migración 004 — Categorías en movimientos de tarjeta

Agrega `category_id UUID REFERENCES categories(id)` a `card_movements`. Permite asignar categorías a los consumos de tarjeta de crédito de forma manual desde la UI web, con auto-categorización automática en las próximas sincronizaciones basada en el historial de asignaciones por merchant.

### Migración 005 — Categorías ocultas por usuario

Crea la tabla `user_hidden_categories(user_id, category_id)` con RLS estricta (`user_id = auth.uid()`). Permite que cada usuario oculte categorías del sistema (`user_id IS NULL`) sin afectar a otros usuarios ni violar las políticas RLS existentes sobre la tabla `categories`. Las categorías ocultas se excluyen en todas las queries de `categoryService.getAll()`.

---

## Autenticación

### Flujo

```
App abre
   │
AuthContext.getSession()
   │
   ├── Sesión válida  ──► AppNavigator  (Bottom Tabs)
   │
   └── Sin sesión    ──► AuthNavigator
                             │
                    LoginScreen   RegisterScreen
                             │
                    supabase.auth.signIn / signUp
                             │
                    onAuthStateChange  →  AppNavigator
```

### Estado de autenticación

`AuthContext` expone: `session`, `user`, `loading`, `signOut`.
- Se suscribe a `onAuthStateChange` para reaccionar a login/logout/expiración automáticamente.
- Todos los hooks leen `user` desde este contexto con `useAuthContext()`.

### Face ID

En `LoginScreen`, `expo-local-authentication` está integrado y llama a `authenticateAsync()`. Sin embargo, **actualmente no está conectado a una sesión guardada** — es un TODO pendiente (muestra alerta de "Autenticación exitosa" sin loguear automáticamente). La integración completa requiere guardar las credenciales en `expo-secure-store` y recuperarlas al autenticarse con biometría.

---

## Navegación

### Estructura completa

```
RootNavigator  (NavigationContainer)
    │
    ├── AuthNavigator  (NativeStack — sin sesión)
    │       ├── LoginScreen
    │       └── RegisterScreen
    │
    └── AppNavigator  (NativeStack — con sesión)
            │
            ├── Tabs  (BottomTabNavigator)
            │     ├── Dashboard      → DashboardScreen
            │     ├── Transactions   → TransactionListScreen
            │     ├── [FAB central]  → navega a AddTransaction (modal)
            │     ├── Reports        → ReportsScreen
            │     └── Accounts       → AccountsScreen  (tappable → AccountDetail)
            │
            ├── AddTransaction  (modal, presentation: 'modal')
            │       └── AddTransactionScreen
            │
            └── AccountDetail  (stack screen — params: accountId, accountName)
                    └── AccountDetailScreen  (4 tabs: Ingresos, Gastos, Tarjeta, Inversiones)
```

El botón central del tab bar es un FAB personalizado (+) que no activa una tab sino que navega al stack modal `AddTransaction`. Este es un patrón habitual en apps de finanzas.

---

## Pantallas

### DashboardScreen

La pantalla principal. Combina:
- **`BalanceCard`**: balance total (suma de todas las cuentas) + ingresos/gastos del mes
- **Métricas de salud**: tasa de ahorro, gasto en ocio, ahorro neto, cuentas activas — con colores semánticos según umbrales
- **BarChart**: evolución de ingresos vs gastos de los últimos 6 meses
- **Últimos 5 movimientos** del mes actual

Usa `pull-to-refresh` (`RefreshControl`) para refetch manual de las 3 queries.

### TransactionListScreen

Lista paginada (`FlatList`) de todas las transacciones con filtros por tipo (`all / income / expense`). El filtrado es **local** (sobre los datos ya cargados). Tiene `useDeleteTransaction` disponible pero el swipe-to-delete no está implementado aún (hay un `TODO` en el `onPress` del item).

### AddTransactionScreen

Formulario modal para crear una transacción. Campos:
- **Tipo**: Gasto / Ingreso (botones toggle)
- **Monto**: input numérico
- **Descripción**: opcional
- **Cuenta**: chips horizontales scrollables con color de la cuenta
- **Categoría**: grilla de chips filtrada por tipo de transacción

Al confirmar llama a `useCreateTransaction`, que invalida `['transactions']` y `['accounts']` forzando refetch en todo el árbol.

### AccountsScreen

Lista de cuentas con balance y proveedor. Tiene un modal nativo (`presentationStyle="pageSheet"`) para crear una cuenta nueva con campos:
- Nombre, tipo (bank/virtual_wallet/cash), proveedor (lista predefinida argentina)
- Saldo inicial, color (paleta de 8 colores)
- Toggle de rendimiento diario con campo de tasa

Cada tarjeta de cuenta es **tappable**: navega a `AccountDetailScreen` pasando `accountId` y `accountName`.

### AccountDetailScreen

Pantalla de detalle de una cuenta con **4 solapas horizontales scrollables**:

| Tab | Contenido |
|-----|-----------|
| **Ingresos** | Total del período + breakdown por categoría (barra de progreso) + lista de transacciones `type='income'` |
| **Gastos** | Total del período + breakdown por categoría + lista de transacciones `type='expense'` |
| **Tarjeta** | Resumen de la Mastercard (consumos ARS/USD, vencimiento, cierre, pago mínimo, disponible) + lista de 35 consumos individuales con merchant, cuotas y moneda |
| **Inversiones** | Totales (capital invertido + ganancia estimada) + lista de plazos fijos con TNA, días, fecha de vencimiento y badge de días restantes |

Datos de cada tab se cargan con queries independientes via `useAccountDetail.ts`.

### ReportsScreen

Análisis del mes actual:
- Resumen (ingresos / gastos / ahorro neto) en 3 Cards
- Barra de progreso de tasa de ahorro con mensaje contextual
- **PieChart** de gastos por categoría (top 6) + tabla detallada debajo
- **LineChart** con curva suavizada (`bezier`) de ingresos vs gastos 6 meses

### LoginScreen / RegisterScreen

Formulario estándar con manejo de estado local. `LoginScreen` incluye el botón de Face ID (parcialmente funcional). Los errores de Supabase Auth se muestran en un banner rojo.

---

## Aplicación web (Next.js)

La web es una segunda interfaz para Gastapp, pensada para uso en escritorio. Comparte la misma base de datos Supabase que la app mobile.

### Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Redirect a `/accounts` |
| `/login` | Autenticación (email + password) |
| `/accounts` | Lista de cuentas activas del usuario |
| `/accounts/[id]` | Detalle de cuenta con 4 tabs y filtros avanzados |
| `/transactions` | Lista de transacciones con filtros |
| `/reports` | Reportes mensuales con gráficos (Recharts) |

### Detalle de cuenta web (`/accounts/[id]`)

Replica y extiende `AccountDetailScreen` con funcionalidades adicionales:

**Filtros disponibles en Ingresos, Gastos y Tarjeta:**
- **Año** — dropdown derivado de los datos disponibles; al cambiar resetea el mes
- **Mes** — dropdown filtrado por el año seleccionado
- **Rango de fechas** — calendar picker con selección de día único o rango:
  - Vista días con navegación mes/año
  - Click en nombre de mes → vista selector de mes
  - Click en año → vista selector de año
  - Hover preview del rango al seleccionar el segundo extremo
- **Categoría** — dropdown con todas las categorías del usuario (solo en Ingresos y Gastos) o todas las categorías (en Tarjeta)

Los filtros se aplican en cadena (AND): año/mes → rango → categoría.

**Tab Tarjeta — funcionalidades extra:**
- Botón **"Sincronizar Galicia"** que ejecuta el scraper via API route y actualiza los datos en Supabase
- **Asignación manual de categorías**: cada fila de consumo tiene un picker inline clickeable
  - Muestra `+ Asignar` si no tiene categoría, o el nombre con punto de color si tiene
  - Dropdown con todas las categorías + opción "Quitar categoría"
  - Opción **"+ Nueva categoría"** que abre un modal
  - Opción **"Ocultar categoría"** (×) visible al hacer hover sobre cada ítem — persiste via `user_hidden_categories`
- **Modal crear categoría**: nombre, tipo (Gasto/Ingreso), selector de 8 colores preset
  - La categoría nueva aparece inmediatamente en todos los pickers sin recargar

**Tabs Ingresos y Gastos — funcionalidades añadidas:**
- **Paginador** de 10 items por página al pie de la tabla de movimientos
- **Asignación inline de categorías**: igual que en Tarjeta — picker con flip automático hacia arriba cuando no hay espacio
- **Ocultar categorías** desde el picker (× al hover) con persistencia en `user_hidden_categories`
- La categoría oculta desaparece inmediatamente del picker sin recargar

**Comportamiento del dropdown de categorías:**
- Detecta espacio disponible debajo del botón trigger al abrirse (`getBoundingClientRect`)
- Si hay menos de 260 px de espacio, el panel se despliega hacia arriba (`bottom-full`) en lugar de hacia abajo (`top-full`)

### API Route: `POST /api/scrape/galicia`

Ejecuta el scraper de Banco Galicia y sincroniza los datos con Supabase:

1. Verifica existencia de `scripts/galicia/credentials.json`
2. Obtiene el usuario autenticado desde la cookie de sesión
3. Ejecuta `node scraper.mjs` como subprocess (timeout: 5 minutos)
4. Lee el JSON generado (`output-YYYY-MM-DD.json`)
5. **Auto-categorización**: construye un mapa `merchant (lowercase) → category_id` desde los movimientos existentes con categoría asignada
6. Hace upsert de `credit_cards` (por `account_id + user_id`)
7. Elimina los movimientos anteriores e inserta los nuevos con `category_id` aplicado automáticamente donde el merchant coincide

Respuesta: `{ ok: true, cardLastDigits, movementsCount }` o `{ error: string }`.

---

## Estado del servidor (TanStack Query)

### QueryClient (App.tsx)

```ts
defaultOptions: {
  queries: { retry: 1, staleTime: 5 * 60 * 1000 }  // 5 minutos
}
```

### Convención de query keys

```
['transactions', 'monthly', userId, year, month]
['transactions', 'all', userId, page]
['transactions', '6months', userId]
['accounts', userId]
['categories', userId, type?]
['account-transactions', accountId, type?]
['credit-card', accountId]
['card-movements', cardId]
['account-investments', accountId]
```

### Patrón de invalidación

Cuando se crea o elimina una transacción, se invalidan tanto `['transactions']` como `['accounts']`. Esto actualiza automáticamente el dashboard, la lista y el balance de cuentas sin recargar la app.

---

## Hooks personalizados

| Hook | Fuente | Descripción |
|------|--------|-------------|
| `useMonthlyTransactions(year?, month?)` | `useTransactions.ts` | Transacciones del mes actual o indicado |
| `useAllTransactions(page?)` | `useTransactions.ts` | Todas las transacciones (paginado, page size 20) |
| `useLast6MonthsTransactions()` | `useTransactions.ts` | Para gráficos de evolución |
| `useCreateTransaction()` | `useTransactions.ts` | Mutation + invalida queries |
| `useDeleteTransaction()` | `useTransactions.ts` | Mutation + invalida queries |
| `useAccounts()` | `useAccounts.ts` | Lista de cuentas activas |
| `useCreateAccount()` | `useAccounts.ts` | Mutation |
| `useDeleteAccount()` | `useAccounts.ts` | Mutation |
| `useCategories(type?)` | `useCategories.ts` | Sistema + propias, filtrable por tipo |
| `useMetrics(transactions?)` | `useMetrics.ts` | Calcula `FinancialMetrics` + `expensesByCategory` |
| `useMonthlyChartData(transactions?)` | `useMetrics.ts` | Calcula `MonthlyData[]` para gráficos |
| `useAuth()` | `useAuth.ts` | `signIn` / `signUp` con estado local de loading/error |
| `useAccountTransactions(accountId, type?)` | `useAccountDetail.ts` | Transacciones de una cuenta, filtrable por income/expense |
| `useAccountCreditCard(accountId)` | `useAccountDetail.ts` | Tarjeta de crédito vinculada a la cuenta |
| `useCardMovements(cardId?)` | `useAccountDetail.ts` | Consumos individuales de la tarjeta |
| `useAccountInvestments(accountId)` | `useAccountDetail.ts` | Plazos fijos de la cuenta |

---

## Lógica de negocio (calculations.ts)

Todos los cálculos son **client-side**, sobre arrays de transacciones ya cargados:

### Tasa de ahorro
```
savingsRate = ((ingresos - gastos) / ingresos) × 100

≥ 30%  → "Excelente ahorro"
≥ 20%  → "Buen ritmo"  (verde)
≥ 10%  → "Mejorable"   (amarillo)
< 10%  → "Atención"    (rojo)
```

### Ratio de ocio
```
leisureRatio = (gastos categoría "Ocio" / gastos totales) × 100
```
Usa el nombre de categoría como string (`'Ocio'`). Si el nombre cambia en la DB, el cálculo deja de funcionar correctamente.

### Gastos por categoría (`calcExpensesByCategory`)
Agrupa gastos por `category.id`, calcula total y porcentaje sobre el total general. Ordena de mayor a menor.

### Evolución mensual (`calcMonthlyData`)
Itera los últimos N meses (default 6), agrupa transacciones por prefijo `YYYY-MM` de la fecha, y acumula `income`, `expenses` y `savings` por mes.

---

## Design system (constants/colors.ts)

Todo el diseño visual parte de este único archivo. Nunca se usan valores hardcodeados en los estilos.

### Paleta principal

| Token | Valor | Uso |
|-------|-------|-----|
| `Colors.background` | `#0D0D1A` | Fondo global |
| `Colors.surface` | `#1A1A2E` | Tab bar |
| `Colors.card` | `#252540` | Tarjetas |
| `Colors.primary` | `#7B68EE` | Acento principal (violeta) |
| `Colors.income` | `#00D4AA` | Verde para ingresos |
| `Colors.expense` | `#FF6B6B` | Rojo para gastos |
| `Colors.warning` | `#FFB347` | Naranja para alertas |

### Espaciado (Spacing)
`xs=4 · sm=8 · md=16 · lg=24 · xl=32 · xxl=48`

### Tipografía (FontSize)
`xs=11 · sm=13 · md=15 · lg=17 · xl=20 · xxl=24 · xxxl=32`

### Colores de cuentas (AccountColors)
Paleta fija de 8 colores para asignar a cuentas nuevas.

---

## Componentes reutilizables

### Button (`components/common/Button.tsx`)
Variantes: `primary` (fondo sólido), `secondary`, `ghost`, `danger`. Soporta prop `loading` que muestra un spinner y deshabilita el botón.

### Input (`components/common/Input.tsx`)
Con label, ícono izquierdo (`Ionicons`), mensaje de error y soporte `isPassword` (toggle de visibilidad).

### Card (`components/common/Card.tsx`)
Contenedor con `backgroundColor: Colors.card`, border y `BorderRadius.lg`. Acepta `style` para sobreescribir.

### BalanceCard (`components/dashboard/BalanceCard.tsx`)
Tarjeta con gradiente `primaryDark → primary`. Muestra balance total, ingresos y gastos del mes.

### MetricCard (`components/dashboard/MetricCard.tsx`)
Tarjeta compacta con ícono, valor principal, label y subtítulo opcional. Color del ícono configurable.

### TransactionItem (`components/transactions/TransactionItem.tsx`)
Ítem de lista. Muestra ícono de categoría, descripción, cuenta, fecha y monto coloreado (verde/rojo según tipo).

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anónima (segura para cliente) |

El prefijo `EXPO_PUBLIC_` hace que Expo las incluya en el bundle del cliente. No se deben agregar claves secretas con este prefijo.

---

## Configuración de Expo (app.json)

- **Orientación**: `portrait` (solo vertical)
- **Tema**: `dark`
- **Color de splash/fondo**: `#0D0D1A`
- **iOS**: `bundleIdentifier: com.gastapp.app`, Face ID habilitado via `NSFaceIDUsageDescription`
- **Android**: `package: com.gastapp.app`
- **Plugins**: `expo-local-authentication`, `expo-secure-store`, `expo-asset`
- **Scheme**: `gastapp` (para deep links)

---

## Limitaciones conocidas y TODOs pendientes

### Funcionalidad incompleta (mobile)
- **Face ID sin sesión guardada**: `LoginScreen` llama a `authenticateAsync()` pero no recupera credenciales guardadas. Falta integrar `expo-secure-store` para guardar/leer el email+password o token.
- **Edición de transacciones**: `TransactionListScreen` tiene un `TODO: navegar a detalle/edición` en el `onPress` de cada ítem. La pantalla de edición no existe.
- **Balance al eliminar transacciones**: `transactionService.delete()` borra el registro pero **no llama a `update_account_balance`** con el delta inverso. El balance queda desactualizado al eliminar.
- **`daily_yields`**: La tabla existe en la DB y hay tipos definidos, pero no hay ninguna pantalla ni lógica implementada para registrar o visualizar rendimientos diarios.
- **`investments`**: Se visualizan en el tab Inversiones pero no hay pantalla de gestión ni creación manual (solo via scraper).

### Funcionalidad incompleta (web)
- **Edición y eliminación de transacciones**: la tabla de transacciones es solo lectura.
- **Auto-categorización del scraper en transacciones de cuenta**: el script `import-to-gastapp.mjs` categoriza por reglas fijas en código; no usa el historial de asignaciones del usuario.

### Deuda técnica
- La detección de categoría "Ocio" en `calcLeisureRatio` usa comparación por nombre (`t.category?.name === 'Ocio'`), lo que es frágil si el nombre cambia.
- `AddTransactionScreen` hardcodea la moneda `'ARS'` — no aprovecha el campo `currency` del modelo.
- No hay suite de tests configurada.
- La paginación en `useAllTransactions` está implementada en el servicio pero la pantalla siempre pide `page=0` (no hay scroll infinito).
- El scraper usa DELETE + INSERT en cada sync, lo que destruye y recrea todos los movimientos. Si Supabase tuviera FK externas a `card_movements`, esto fallaría.

---

## Flujo completo de datos: crear una transacción

```
Usuario toca "Guardar" en AddTransactionScreen
    │
    ▼
handleSubmit() — valida monto y cuenta seleccionada
    │
    ▼
useCreateTransaction().mutate(input)   ← TanStack Query mutation
    │
    ▼
transactionService.create(userId, input)
    ├── supabase.from('transactions').insert(...)
    └── supabase.rpc('update_account_balance', { p_account_id, p_delta })
    │
    ▼
onSuccess:
    ├── queryClient.invalidateQueries(['transactions'])
    └── queryClient.invalidateQueries(['accounts'])
    │
    ▼
React re-renderiza DashboardScreen, TransactionListScreen y AccountsScreen
con datos frescos automáticamente
```
