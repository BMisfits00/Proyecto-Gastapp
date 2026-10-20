# 📋 Plan Maestro de Desarrollo e Ingeniería (Dev Lead) — Gastapp

**Versión:** 3.0.0  
**Fecha de Actualización:** 2026-10-20  
**Líder de Desarrollo:** Dev Lead (10+ años de experiencia en Fintech)  
**Estado del Documento:** Activo, Verificado y en Fase de Consolidación  

---

## 1. Visión y Arquitectura del Sistema

Gastapp opera bajo un modelo de arquitectura desacoplada y reactiva en tres capas bien delimitadas:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CAPA DE PRESENTACIÓN                        │
│  - Mobile: React Native (Expo SDK 54, React Navigation)         │
│  - Web: Next.js 16 (App Router, Tailwind CSS v4, shadcn/ui)     │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                    CAPA DE ESTADO Y HOOKS                       │
│  - TanStack Query v5 (Caché reactiva, invalidación atómica)     │
│  - AuthContext (Gestión de sesión JWT)                          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                    CAPA DE SERVICIOS (PURA)                     │
│  - transactionService, accountService, yieldService, biometric  │
│  - Totalmente desacoplada de dependencias visuales              │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                    CAPA DE DATOS (SUPABASE)                     │
│  - PostgreSQL + Triggers atómicos contables (006 y 007)         │
│  - Row Level Security (RLS) `user_id = auth.uid()`              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Detalle de Implementaciones Realizadas

### 2.1. Núcleo Contable y Transferencias (Migraciones 006 y 007)
* **Archivos:** 
  * `supabase/migrations/006_sync_account_balance_trigger.sql`
  * `supabase/migrations/007_transfers_support.sql`
* **Funcionalidad:**
  * Soporte atómico para altas, bajas, ediciones y **transferencias entre cuentas**.
  * En transferencias (`type = 'transfer'`): resta automáticamente de `account_id` (origen) y acredita en `to_account_id` (destino).
  * Al eliminar una transferencia, revierte simétricamente ambos saldos.

### 2.2. Adopción de `shadcn/ui` en la Plataforma Web
* **Ubicación:** `web/components/ui/` y `web/lib/utils.ts`
* **Componentes implementados:**
  * `Button`: Variantes con CVA (default, outline, ghost, destructive, link, secondary).
  * `Card`: Encabezado, título, descripción, contenido y pie con tokens dark fintech.
  * `Badge`: Variantes semánticas (success, destructive, secondary, outline).
  * `Dialog`: Modales accesibles construidos sobre Radix UI Primitive.
* **Pantallas refactorizadas:** `web/app/(app)/accounts/page.tsx` modernizada al 100% bajo estética shadcn.

### 2.3. Suite de Pruebas Unitarias Automatizadas con Jest
* **Archivo:** `jest.config.js` y tests en `src/utils/__tests__/` y `src/services/__tests__/`
* **Métricas:** 3 Test Suites ejecutadas, **12 tests unitarios pasando (100% verde)**.
* **Cobertura de tests:** Cálculos de tasa de ahorro, ratio de ocio, agrupación de categorías, formateo monetario y simulación matemática de rendimientos.

### 2.4. Módulo de Rendimiento Diario (`daily_yields`)
* **Archivos:** `src/services/yieldService.ts` y `src/hooks/useDailyYields.ts`
* **Capacidades:**
  * Simulación financiera: cálculo de ganancia diaria, mensual, anual y TNA estimada en base a `daily_yield_rate`.
  * Liquidación contable: inserción en `daily_yields` y creación simultánea de movimiento de ingreso para sumar al balance.

---

## 3. Bitácora de Acciones Realizadas

| Fecha | Versión | Componente | Descripción de la Tarea | Responsable |
|---|---|---|---|---|
| 2026-10-20 | v1.0.0 | Setup | Clonado e instalación inicial de dependencias. | Dev Lead |
| 2026-10-20 | v1.1.0 | DB Core | Migración 006 con trigger atómico para balance. | Dev Lead |
| 2026-10-20 | v1.2.0 | Mobile UI | Pantalla de edición y borrado de movimientos. | Dev Lead |
| 2026-10-20 | v1.3.0 | Mobile Auth | Biometría real con `expo-secure-store`. | Dev Lead |
| 2026-10-20 | v1.4.0 | Feed | Infinite scroll con `useInfiniteTransactions`. | Dev Lead |
| 2026-10-20 | v3.0.0 | Web UI | Instalación y configuración de `shadcn/ui` en Next.js. | Dev Lead |
| 2026-10-20 | v3.0.0 | Feature | Migración 007 y soporte de transferencias en mobile. | Dev Lead |
| 2026-10-20 | v3.0.0 | QA / CI | Suite de Jest con 12 tests unitarios al 100%. | Dev Lead |
| 2026-10-20 | v3.0.0 | Feature | Servicio y hook de rendimiento diario (`daily_yields`). | Dev Lead |
| 2026-10-20 | v3.1.0 | Web UI | Rediseño integral estilo Portal Bancario (shadcn/ui, azul marino/slate/blanco). | Dev Lead |
| 2026-10-20 | v3.2.0 | Auth / Email | Integración de Resend, recuperación de contraseña y plantillas corporativas. | Dev Lead |
| 2026-10-20 | v3.2.0 | DB Cron | Migración 008 con pg_cron para liquidación diaria automática de rendimientos. | Dev Lead |

---

## 4. Estado de Backlog

* [x] **Recuperación de Contraseña (`authService.resetPassword`):**
  * Botón *"¿Olvidaste tu contraseña?"* en Web (`/forgot-password`) y Mobile (`LoginScreen.tsx`).
  * Integración con Resend SDK y Supabase Auth (`/api/auth/reset-password`).
  * Pantalla de actualización de credenciales (`/auth/update-password`).
  * Plantillas de correo bancario HTML (recuperación y bienvenida).
* [x] **Cron de Rendimientos Diarios (`daily_yields`):**
  * Migración 008 (`008_daily_yields_cron.sql`) con job autónomo en `pg_cron`.
* [ ] **Pruebas de Campo Mobile (React Native):**
  * Ejecución con `npx expo start` y validación de transferencias y biometría.

