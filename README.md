# Gastapp

Aplicación móvil de gestión de finanzas personales construida con React Native, Expo y Supabase.

---

## Índice

- [Descripción general](#descripción-general)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura del sistema](#arquitectura-del-sistema)
- [Base de datos](#base-de-datos)
- [Lógica del sistema](#lógica-del-sistema)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Cómo correr el proyecto](#cómo-correr-el-proyecto)
- [Roadmap MVP — 30 días](#roadmap-mvp--30-días)

---

## Descripción general

Gastapp permite a los usuarios registrar ingresos y gastos, gestionar múltiples cuentas financieras y visualizar su salud financiera a través de métricas y gráficos. El objetivo es que cualquier persona pueda entender en segundos cómo está su dinero.

**Funcionalidades principales:**

- Registro e inicio de sesión con autenticación biométrica (Face ID)
- Múltiples cuentas financieras (banco, billetera virtual, efectivo)
- Registro de transacciones con categorías personalizables
- Dashboard con balance total, métricas de salud financiera y gráficos
- Reportes visuales: gastos por categoría, evolución mensual, tasa de ahorro
- Soporte para cuentas con rendimiento diario (billeteras virtuales)

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React Native + Expo SDK 52 + TypeScript |
| Backend | Supabase (PostgreSQL + Auth + APIs) |
| Navegación | React Navigation v6 (Stack + Bottom Tabs) |
| Estado del servidor | TanStack Query v5 (React Query) |
| Autenticación biométrica | Expo Local Authentication |
| Almacenamiento seguro | Expo Secure Store |
| Gráficos | React Native Chart Kit |
| Gradientes | Expo Linear Gradient |

---

## Arquitectura del sistema

```
┌──────────────────────────────────────────────┐
│                 React Native App              │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Screens  │  │Components│  │Navigation │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │              │              │         │
│  ┌────▼──────────────▼──────────────▼─────┐  │
│  │              Custom Hooks               │  │
│  │  useAuth · useTransactions · useMetrics │  │
│  └────────────────────┬────────────────────┘  │
│                        │                       │
│  ┌─────────────────────▼──────────────────┐   │
│  │               Services Layer           │   │
│  │  authService · transactionService      │   │
│  │  accountService · categoryService      │   │
│  └─────────────────────┬──────────────────┘   │
│                         │                      │
│  ┌──────────────────────▼─────────────────┐   │
│  │           Supabase JS Client            │   │
│  └──────────────────────┬─────────────────┘   │
└─────────────────────────┼────────────────────-┘
                           │ HTTPS
┌──────────────────────────▼─────────────────────┐
│                   Supabase                      │
│                                                 │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  │
│  │ PostgreSQL │  │   Auth   │  │    RLS     │  │
│  │  Database  │  │  (JWT)   │  │  Policies  │  │
│  └────────────┘  └──────────┘  └────────────┘  │
└─────────────────────────────────────────────────┘
```

### Flujo de autenticación

```
App abre
   │
   ▼
AuthContext verifica sesión (AsyncStorage)
   │
   ├── Sesión activa ──► AppNavigator (Bottom Tabs)
   │
   └── Sin sesión ─────► AuthNavigator
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
               LoginScreen         RegisterScreen
                    │                    │
               Face ID / Email+Pass   Email+Pass
                    │                    │
                    └────────┬───────────┘
                             ▼
                      supabase.auth.signIn/signUp
                             │
                      AuthContext.onAuthStateChange
                             │
                      ► AppNavigator
```

### Flujo de una transacción

```
Usuario completa AddTransactionScreen
   │
   ▼
useCreateTransaction (TanStack Query mutation)
   │
   ▼
transactionService.create(userId, input)
   │
   ├── INSERT INTO transactions (...)
   │
   └── RPC update_account_balance(account_id, ±delta)
            │
            ▼
        UPDATE accounts SET balance = balance + delta

   ▼
QueryClient.invalidateQueries(['transactions', 'accounts'])
   │
   ▼
React re-renderiza Dashboard y TransactionList con datos frescos
```

---

## Base de datos

### Diagrama de tablas

```
auth.users (Supabase)
    │
    ├──► profiles          (1:1)  — datos extra del usuario
    ├──► accounts          (1:N)  — cuentas financieras
    ├──► categories        (1:N)  — categorías propias del usuario
    ├──► transactions      (1:N)  — movimientos de dinero
    ├──► investments       (1:N)  — inversiones
    └──► daily_yields      (1:N)  — rendimientos diarios
```

### Tablas principales

#### `accounts`
Representa cada cuenta financiera del usuario.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `user_id` | UUID | FK → auth.users |
| `name` | TEXT | Nombre de la cuenta |
| `type` | TEXT | `bank`, `virtual_wallet`, `cash` |
| `provider` | TEXT | Ej: Mercado Pago, Ualá, Brubank |
| `balance` | DECIMAL | Saldo actual calculado |
| `has_daily_yield` | BOOLEAN | Si genera rendimiento diario |
| `daily_yield_rate` | DECIMAL | Tasa diaria en decimal (0.0009 = 0.09%) |

#### `transactions`
Cada ingreso o gasto registrado.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Clave primaria |
| `account_id` | UUID | FK → accounts |
| `category_id` | UUID | FK → categories |
| `type` | TEXT | `income`, `expense`, `transfer` |
| `amount` | DECIMAL | Monto (siempre positivo) |
| `currency` | TEXT | `ARS`, `USD`, etc. |
| `date` | DATE | Fecha del movimiento |

#### `categories`
Las categorías del sistema (`user_id IS NULL`) son compartidas para todos. Las del usuario son propias.

#### `daily_yields`
Registra el rendimiento diario de billeteras virtuales como Mercado Fondo.

| Campo | Descripción |
|-------|-------------|
| `balance` | Saldo del día |
| `yield_rate` | Tasa aplicada ese día |
| `yield_amount` | Ganancia generada ese día |

### Seguridad — Row Level Security (RLS)

Cada tabla tiene políticas RLS que garantizan que un usuario **solo puede leer y escribir sus propios datos**. Supabase verifica el JWT en cada request y filtra automáticamente por `user_id = auth.uid()`.

```sql
-- Ejemplo: solo ves tus propias transacciones
CREATE POLICY "Users manage own transactions"
  ON transactions FOR ALL
  USING (user_id = auth.uid());
```

---

## Lógica del sistema

### Cálculo de balance

El balance de cada cuenta se mantiene actualizado mediante la función RPC `update_account_balance`, que se llama automáticamente al crear una transacción:

```
balance_nuevo = balance_actual + delta

donde:
  delta = +amount  (si type = 'income')
  delta = -amount  (si type = 'expense')
```

El **balance total** es la suma del saldo de todas las cuentas activas.

### Métricas de salud financiera

Todas las métricas se calculan en el cliente a partir de las transacciones del mes actual:

#### Tasa de ahorro
```
savingsRate = ((ingresos - gastos) / ingresos) × 100
```
- Verde ≥ 20% — Buen ritmo
- Amarillo 10–19% — Mejorable
- Rojo < 10% — Atención

#### Gasto en ocio
```
leisureRatio = (gastos categoría "Ocio" / gastos totales) × 100
```

#### Ahorro neto
```
netSavings = ingresos del mes - gastos del mes
```

### Reportes

Los gráficos de evolución mensual agrupan las transacciones de los últimos 6 meses en la función `calcMonthlyData`. El pie chart de categorías usa `calcExpensesByCategory`, que agrupa gastos por categoría y calcula el porcentaje de cada una sobre el total.

### Flujo de datos con TanStack Query

```
Componente
   │
   ▼
useMonthlyTransactions()          ← Hook personalizado
   │
   ▼
useQuery({ queryKey: ['transactions', 'monthly', userId, year, month] })
   │                                │
   ├── Cache HIT ──────────────────► datos inmediatos + refetch en background
   │
   └── Cache MISS ─────────────────► transactionService.getMonthly()
                                           │
                                           ▼
                                    supabase.from('transactions').select(...)
```

Cuando se crea o elimina una transacción, se invalidan las queries de `transactions` y `accounts`, forzando un refetch automático en todos los componentes suscritos.

---

## Estructura del proyecto

```
Proyecto Gastapp/
│
├── App.tsx                         ← Punto de entrada, providers globales
├── app.json                        ← Configuración Expo
├── tsconfig.json                   ← Configuración TypeScript
├── babel.config.js                 ← Configuración Babel + module-resolver
├── .env.example                    ← Variables de entorno requeridas
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  ← Tablas, índices, RLS, triggers
│   │   └── 002_rpc_functions.sql   ← Funciones: update_account_balance
│   └── seed.sql                    ← Categorías del sistema (13 categorías)
│
└── src/
    ├── types/
    │   └── index.ts                ← Interfaces TypeScript de todo el dominio
    │
    ├── constants/
    │   └── colors.ts               ← Design system: Colors, Spacing, FontSize, BorderRadius
    │
    ├── lib/
    │   └── supabase.ts             ← Cliente Supabase configurado con AsyncStorage
    │
    ├── contexts/
    │   └── AuthContext.tsx         ← Estado global de sesión (session, user, loading)
    │
    ├── navigation/
    │   ├── index.tsx               ← RootNavigator: decide Auth vs App según sesión
    │   ├── AuthNavigator.tsx       ← Stack: Login → Register
    │   └── AppNavigator.tsx        ← Bottom Tabs + Stack modal para AddTransaction
    │
    ├── services/                   ← Capa de acceso a Supabase (sin lógica de UI)
    │   ├── authService.ts          ← signIn, signUp, signOut, resetPassword
    │   ├── transactionService.ts   ← getMonthly, getAll, create, delete, getLast6Months
    │   ├── accountService.ts       ← getAll, create, update, delete, getTotalBalance
    │   └── categoryService.ts      ← getAll (sistema + propias), create
    │
    ├── hooks/                      ← Wrappean services con TanStack Query
    │   ├── useAuth.ts              ← signIn/signUp con estado local de loading/error
    │   ├── useTransactions.ts      ← useMonthlyTransactions, useAllTransactions, useCreateTransaction
    │   ├── useAccounts.ts          ← useAccounts, useCreateAccount, useDeleteAccount
    │   ├── useMetrics.ts           ← useMetrics, useMonthlyChartData (cálculos sobre transacciones)
    │   └── useCategories.ts        ← useCategories (filtrable por tipo)
    │
    ├── utils/
    │   ├── formatters.ts           ← formatCurrency, formatDate, formatRelativeDate, todayISO
    │   └── calculations.ts         ← calcSavingsRate, calcLeisureRatio, calcExpensesByCategory, calcMonthlyData
    │
    ├── components/
    │   ├── common/
    │   │   ├── Button.tsx          ← Variantes: primary, secondary, ghost, danger
    │   │   ├── Input.tsx           ← Con label, icono, error y soporte password
    │   │   └── Card.tsx            ← Contenedor con estilo de tarjeta
    │   ├── dashboard/
    │   │   ├── BalanceCard.tsx     ← Tarjeta principal con gradiente: balance + ingresos/gastos
    │   │   └── MetricCard.tsx      ← Tarjeta de métrica individual con ícono
    │   └── transactions/
    │       └── TransactionItem.tsx ← Ítem de lista con icono, descripción y monto coloreado
    │
    └── screens/
        ├── auth/
        │   ├── LoginScreen.tsx     ← Email/password + Face ID
        │   └── RegisterScreen.tsx  ← Nombre + email + password
        ├── dashboard/
        │   └── DashboardScreen.tsx ← Balance, métricas, gráfico de barras, últimos movimientos
        ├── transactions/
        │   ├── TransactionListScreen.tsx  ← Lista con filtros (todos/ingresos/gastos)
        │   └── AddTransactionScreen.tsx   ← Formulario: tipo, monto, cuenta, categoría
        ├── reports/
        │   └── ReportsScreen.tsx   ← Pie chart categorías + line chart evolución + tasa de ahorro
        └── accounts/
            └── AccountsScreen.tsx  ← Lista de cuentas + modal para crear nueva
```

---

## Cómo correr el proyecto

### Prerrequisitos

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Cuenta en [Supabase](https://supabase.com) (gratuita)
- Expo Go en iPhone o simulador iOS

### 1. Configurar Supabase

1. Crear un nuevo proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar en orden:
   ```
   supabase/migrations/001_initial_schema.sql
   supabase/migrations/002_rpc_functions.sql
   supabase/seed.sql
   ```
3. Copiar la **Project URL** y la **anon public key** desde *Settings → API*

### 2. Variables de entorno

Crear el archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Correr la app

```bash
# En iPhone (Expo Go)
npx expo start --ios

# En simulador Android
npx expo start --android

# En web (limitado)
npx expo start --web
```

---

## Roadmap MVP — 30 días

### Semana 1 — Fundación y auth (Días 1–7)

| Día | Tarea |
|-----|-------|
| 1 | Crear proyecto Supabase, ejecutar migraciones y seed |
| 2 | Conectar app con `.env`, verificar login/registro funcionando |
| 3 | Probar RLS: verificar que cada usuario solo ve sus datos |
| 4 | Crear primera cuenta desde AccountsScreen y verificar en DB |
| 5 | Registrar primera transacción y verificar que el balance se actualiza |
| 6 | Pulir flujo de onboarding: login → crear cuenta → primera transacción |
| 7 | Testing en dispositivo físico iOS con Expo Go |

### Semana 2 — Transacciones y cuentas (Días 8–14)

| Día | Tarea |
|-----|-------|
| 8  | Completar validaciones en AddTransactionScreen |
| 9  | Implementar filtros en TransactionListScreen (por fecha, cuenta) |
| 10 | Agregar swipe-to-delete en TransactionItem |
| 11 | Pantalla de edición de transacción existente |
| 12 | Soporte multi-moneda (ARS / USD) con selector |
| 13 | Lógica de rendimiento diario: cálculo y registro en daily_yields |
| 14 | Testing de flujo completo de cuentas y transacciones |

### Semana 3 — Dashboard y reportes (Días 15–21)

| Día | Tarea |
|-----|-------|
| 15 | Conectar BalanceCard con datos reales de Supabase |
| 16 | Refinar métricas: alertas visuales según umbrales |
| 17 | Mejorar gráfico de barras: comparación ingresos vs gastos |
| 18 | Pie chart en ReportsScreen con categorías reales |
| 19 | Filtros en reportes: selección de mes |
| 20 | Comparación entre meses (mes actual vs mes anterior) |
| 21 | Pulir diseño general: espaciados, tipografías, consistencia visual |

### Semana 4 — Pulido y distribución (Días 22–30)

| Día | Tarea |
|-----|-------|
| 22 | Pantalla de perfil: nombre, moneda preferida, cerrar sesión |
| 23 | Notificaciones locales: alerta cuando el gasto supera el 80% del ingreso |
| 24 | Persistencia offline básica con React Query cache |
| 25 | Implementar Face ID real conectado a sesión guardada |
| 26 | Configurar eas.json para build de producción |
| 27 | `eas build --platform ios` — primer build de TestFlight |
| 28 | Testing en dispositivo real (no Expo Go) |
| 29 | Fix de bugs encontrados en testing |
| 30 | Distribución en TestFlight para beta testers |

---

### Funcionalidades futuras (post-MVP)

| Feature | Descripción |
|---------|-------------|
| Open Banking | Integración con Belvo / Prometeo para sincronizar cuentas bancarias automáticamente |
| Presupuestos | Definir límites de gasto por categoría con alertas |
| Metas de ahorro | Objetivos con progreso visual |
| Exportar datos | Exportar transacciones a CSV / PDF |
| Widgets iOS | Widget de balance en pantalla de inicio |
| Soporte familia | Múltiples perfiles bajo una misma cuenta |
| Inversiones | Seguimiento de cartera de inversiones con evolución |

---

## Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anónima de Supabase |

> Las variables con prefijo `EXPO_PUBLIC_` son expuestas al cliente. Nunca agregar claves secretas con este prefijo.
