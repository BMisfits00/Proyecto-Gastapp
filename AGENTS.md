# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Gastapp** is a personal finance mobile app built with React Native + Expo (SDK 54) and TypeScript. The backend is fully managed by Supabase (PostgreSQL + Auth + RLS). There is no custom backend server — all data access goes through the Supabase JS client.

## Commands

```bash
# Install dependencies
npm install

# Start dev server (Expo Go, choose platform interactively)
npx expo start

# Start directly for a platform
npx expo start --ios
npx expo start --android
npx expo start --web
```

There is no test suite or lint script configured in `package.json`. TypeScript type-checking can be run via:

```bash
npx tsc --noEmit
```

## Environment Setup

Copy `.env.example` to `.env` and fill in your Supabase project credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Variables prefixed `EXPO_PUBLIC_` are exposed to the client bundle. Never add secret keys with this prefix.

### Database setup (first time)

Run these SQL files in order via the Supabase SQL Editor:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rpc_functions.sql`
3. `supabase/seed.sql` (system categories)

## Architecture

### Layer structure

```
Screens / Components
       ↓
Custom Hooks (src/hooks/)       ← TanStack Query wrappers
       ↓
Services (src/services/)        ← Pure Supabase calls, no UI logic
       ↓
src/lib/supabase.ts             ← Single Supabase client instance
       ↓
Supabase (remote PostgreSQL)
```

Each layer has a strict responsibility boundary. Services never import hooks or components; hooks never call Supabase directly.

### State management

- **Server state**: TanStack Query v5. All data fetched from Supabase lives in the query cache. Query keys follow the pattern `['resource', 'variant', userId, ...params]` (e.g. `['transactions', 'monthly', userId, year, month]`).
- **Auth state**: `AuthContext` (`src/contexts/AuthContext.tsx`) holds `session`, `user`, and `loading`. It subscribes to `supabase.auth.onAuthStateChange`. All hooks read `user` from this context via `useAuthContext()`.
- **No global UI state library** — local `useState` is used within screens.

### Navigation

`RootNavigator` (`src/navigation/index.tsx`) renders either `AuthNavigator` (Login → Register stack) or `AppNavigator` (Bottom Tabs + modal stack) based on whether a Supabase session exists.

`AppNavigator` uses a two-level structure:
- Bottom tabs: Dashboard, Transactions, (FAB button), Reports, Accounts
- The center FAB navigates to `AddTransaction` as a modal stack screen (`presentation: 'modal'`)

### Path aliases

`@/*` maps to `src/*` (configured in `tsconfig.json` and `babel-plugin-module-resolver`). Use `@/services/...`, `@/hooks/...`, etc. for imports inside `src/`.

### Design system

All design tokens are in `src/constants/colors.ts`: `Colors`, `Spacing`, `BorderRadius`, `FontSize`, and `AccountColors`. The app uses a dark theme with `background: '#0D0D1A'` and `primary: '#7B68EE'`. Always use these constants instead of hardcoded values.

### Key business logic

**Balance updates**: When a transaction is created, `transactionService.create()` calls the Supabase RPC `update_account_balance(p_account_id, p_delta)` to atomically update `accounts.balance`. Deletion does **not** reverse the balance — this is a known gap in the current implementation.

**Financial metrics** (`src/utils/calculations.ts`): All metrics (savings rate, leisure ratio, expenses by category, monthly chart data) are computed client-side from the already-fetched transaction arrays. They are not stored in the database.

**Categories**: Categories with `user_id IS NULL` are system-wide defaults seeded via `supabase/seed.sql`. User-created categories have a `user_id`. The `categoryService.getAll()` fetches both together.

**RLS**: Every table has Row Level Security policies enforcing `user_id = auth.uid()`. The Supabase client automatically sends the JWT with every request.

### TypeScript types

All domain types are centralized in `src/types/index.ts`. Form input types (`CreateTransactionInput`, `CreateAccountInput`) are defined separately from the database entity types (`Transaction`, `Account`, etc.).
