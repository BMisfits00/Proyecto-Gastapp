# Análisis del Proyecto — Gastapp

## Descripción general

Gastapp es una aplicación móvil de finanzas personales orientada al mercado argentino. Permite al usuario registrar ingresos y gastos, gestionar múltiples cuentas bancarias/virtuales/efectivo, y visualizar la salud financiera del mes a través de métricas y gráficos.

El proyecto es un **MVP funcional en desarrollo activo**. Hay pantallas completas y otras con funcionalidad parcial (edición de transacciones, Face ID conectado a sesión, entre otros).

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Lenguaje | TypeScript (modo `strict`) |
| Backend | Supabase — PostgreSQL + Auth + RLS |
| Navegación | React Navigation v6 (Stack + Bottom Tabs) |
| Estado del servidor | TanStack Query v5 (React Query) |
| Autenticación biométrica | expo-local-authentication (Face ID) |
| Almacenamiento seguro | expo-secure-store |
| Gráficos | react-native-chart-kit (BarChart, LineChart, PieChart) |
| Gradientes | expo-linear-gradient |
| Gestos | react-native-gesture-handler + react-native-reanimated |

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
├── App.tsx                          ← Punto de entrada, monta todos los providers
├── index.js                         ← Entry point de Expo
├── app.json                         ← Config Expo (nombre, orientación, plugins, bundle IDs)
├── babel.config.js                  ← babel-preset-expo + reanimated plugin
├── tsconfig.json                    ← Alias @/* → src/*
├── .env / .env.example              ← Variables EXPO_PUBLIC_SUPABASE_*
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  ← Tablas, índices, triggers, RLS
│   │   ├── 002_rpc_functions.sql   ← Función update_account_balance
│   │   └── 003_credit_cards_and_investments.sql  ← credit_cards, card_movements, extensión investments
│   └── seed.sql                    ← 13 categorías del sistema
│
├── scripts/
│   └── galicia/
│       ├── scraper.mjs             ← Scraper Playwright del Banco Galicia
│       ├── import-to-gastapp.mjs  ← Convierte output JSON a SQL importable
│       └── output-YYYY-MM-DD.json ← Resultado de cada corrida del scraper
│
└── src/
    ├── types/index.ts              ← Todos los tipos del dominio (+ CreditCard, CardMovement)
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
            ├── AccountsScreen.tsx  ← Lista de cuentas (ahora tappable → AccountDetail)
            └── AccountDetailScreen.tsx  ← Vista completa con 4 tabs
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
- Se reemplazan completamente en cada sync (DELETE + INSERT)

**Extensión de `investments`** — Campos nuevos para plazos fijos:
- `tna`: tasa nominal anual (ej: 22.0)
- `term_days`: días del plazo (ej: 33)
- `maturity_date`: fecha de vencimiento
- `gain_amount`: ganancia estimada al vencimiento

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

### Funcionalidad incompleta
- **Face ID sin sesión guardada**: `LoginScreen` llama a `authenticateAsync()` pero no recupera credenciales guardadas. Falta integrar `expo-secure-store` para guardar/leer el email+password o token.
- **Edición de transacciones**: `TransactionListScreen` tiene un `TODO: navegar a detalle/edición` en el `onPress` de cada ítem. La pantalla de edición no existe.
- **Balance al eliminar transacciones**: `transactionService.delete()` borra el registro pero **no llama a `update_account_balance`** con el delta inverso. El balance queda desactualizado al eliminar.
- **`daily_yields`**: La tabla existe en la DB y hay tipos definidos, pero no hay ninguna pantalla ni lógica implementada para registrar o visualizar rendimientos diarios.
- **`investments`**: Tabla extendida con campos de plazo fijo (TNA, días, vencimiento). Se visualizan en `AccountDetailScreen` tab Inversiones. No hay pantalla dedicada de gestión de inversiones ni servicio de creación manual (solo se importan via script del scraper Galicia).

### Deuda técnica
- La detección de categoría "Ocio" en `calcLeisureRatio` usa comparación por nombre (`t.category?.name === 'Ocio'`), lo que es frágil si el nombre cambia.
- `AddTransactionScreen` hardcodea la moneda `'ARS'` — no aprovecha el campo `currency` del modelo.
- No hay suite de tests configurada.
- No hay script de lint en `package.json`.
- La paginación en `useAllTransactions` está implementada en el servicio pero la pantalla siempre pide `page=0` (no hay scroll infinito).

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
