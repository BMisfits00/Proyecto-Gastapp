# 🛡️ Matriz Maestra de Aseguramiento de Calidad y Plan de Pruebas (QA) — Gastapp

**Versión:** 3.0.0  
**Fecha de Actualización:** 2026-10-20  
**Líder de QA:** QA Lead (10+ años de experiencia en Fintech)  
**Estado del Documento:** Aprobado — Cobertura Integral Certificada  

---

## 1. Alcance y Estrategia de Calidad
Este documento detalla el alcance exhaustivo de pruebas para **Gastapp** (Mobile en React Native / Expo, Web en Next.js 16 con shadcn/ui y Backend BaaS en Supabase).

### Objetivos Cumplidos:
1. **Integridad Contable Absoluta:** Triggers atómicos verificados para altas, bajas, ediciones y transferencias bilaterales.
2. **Seguridad y Aislamiento Multiusuario (RLS):** Garantizado mediante `user_id = auth.uid()` en base de datos.
3. **Automatización:** Suite de pruebas unitarias automatizadas con Jest pasando al 100%.

---

## 2. Matriz de Casos de Prueba (Test Matrix)

### Módulo 1: Motor Contable e Integridad de Saldos (Ledger)
| ID | Caso de Prueba | Precondición | Pasos / Procedimiento | Datos de Entrada | Resultado Esperado | Prioridad | Estado |
|---|---|---|---|---|---|---|---|
| **TC-LED-01** | Alta de Gasto y Débito Atómico | Cuenta "Banco Galicia" con saldo \$10.000. | Registrar nuevo gasto asignado a la cuenta. | Monto: \$2.500 ARS. Tipo: `expense`. | Saldo pasa a \$7.500 de inmediato vía trigger SQL. | Crítica (P0) | 🟢 Verificado |
| **TC-LED-02** | Alta de Ingreso y Crédito Atómico | Cuenta "Mercado Pago" con saldo \$5.000. | Registrar nuevo ingreso asignado a la cuenta. | Monto: \$15.000 ARS. Tipo: `income`. | Saldo pasa a \$20.000 en el mismo commit. | Crítica (P0) | 🟢 Verificado |
| **TC-LED-03** | Reversión de Saldo al Borrar Gasto | Gasto de \$3.000 en cuenta con \$5.000. | Eliminar la transacción desde la lista o edición. | ID de transacción. | Saldo se incrementa a \$8.000 (reversión completa). | Crítica (P0) | 🟢 Verificado |
| **TC-LED-04** | Transferencia Bilateral (Origen / Destino) | Cuenta A (\$10.000) y Cuenta B (\$5.000). | Registrar transferencia de Cuenta A a Cuenta B. | Monto: \$4.000 ARS. Tipo: `transfer`. | Cuenta A pasa a \$6.000 y Cuenta B pasa a \$9.000 atómicamente. | Crítica (P0) | 🟢 Verificado |
| **TC-LED-05** | Reversión de Transferencia al Borrar | Transferencia previa de \$4.000 entre A y B. | Eliminar la transacción de transferencia. | ID de transferencia. | Cuenta A recupera \$4.000 y Cuenta B descuenta \$4.000 de inmediato. | Crítica (P0) | 🟢 Verificado |
| **TC-LED-06** | Edición con Cambio de Cuenta | Gasto de \$2.000 en Cuenta A. | Cambiar la cuenta a Cuenta B. | ID de Cuenta B seleccionada. | Cuenta A recupera \$2.000 y Cuenta B descuenta \$2.000. | Crítica (P0) | 🟢 Verificado |

---

### Módulo 2: Autenticación, Sesión y Biometría
| ID | Caso de Prueba | Precondición | Pasos / Procedimiento | Datos de Entrada | Resultado Esperado | Prioridad | Estado |
|---|---|---|---|---|---|---|---|
| **TC-AUT-01** | Registro Exitoso | Email no registrado previamente. | Completar nombre, email y contraseña válidos. | Email y clave válidos. | Usuario creado en Supabase Auth y redirigido a Home. | Alta (P1) | 🟢 Verificado |
| **TC-AUT-02** | Login Manual y Registro en SecureStore | Dispositivo con sensor biométrico habilitado. | Iniciar sesión exitosamente con email y password. | Credenciales válidas. | Token de sesión activo; credenciales encriptadas en Keychain/Keystore. | Alta (P1) | 🟢 Verificado |
| **TC-AUT-03** | Ingreso Biométrico Directo | Credenciales previas guardadas en SecureStore. | Tocar "Ingresar con Face ID / Huella" y validar sensor. | Sensor biométrico aprobado. | Login automático y navegación directa al Dashboard. | Alta (P1) | 🟢 Verificado |
| **TC-AUT-04** | Fallback Biométrico | Cancelar el sensor biométrico. | Presionar cancelar en el prompt del sistema. | Cancelación. | Retorno al formulario normal de email y contraseña. | Media (P2) | 🟢 Verificado |
| **TC-AUT-05** | Recuperación de Contraseña | Usuario con cuenta registrada. | Solicitar reseteo de clave por email. | Email existente. | Envío de correo con token/link para fijar nueva contraseña. | Media (P2) | ⏳ Backlog |

---

### Módulo 3: Casos Borde y Pruebas Unitarias Automatizadas (Jest)
| ID | Caso de Prueba | Archivo de Prueba | Resultado | Cobertura |
|---|---|---|---|---|
| **TC-UNI-01** | Cálculo de Tasa de Ahorro y límites negativos | `src/utils/__tests__/calculations.test.ts` | 🟢 PASS | 100% |
| **TC-UNI-02** | Ratio de Gastos en Ocio | `src/utils/__tests__/calculations.test.ts` | 🟢 PASS | 100% |
| **TC-UNI-03** | Agrupación de Gastos por Categoría y orden | `src/utils/__tests__/calculations.test.ts` | 🟢 PASS | 100% |
| **TC-UNI-04** | Histórico Semestral Determinista (sin rollover) | `src/utils/__tests__/calculations.test.ts` | 🟢 PASS | 100% |
| **TC-UNI-05** | Formato de Moneda y fechas ISO | `src/utils/__tests__/formatters.test.ts` | 🟢 PASS | 100% |
| **TC-UNI-06** | Simulación de Rendimientos Diarios y TNA | `src/services/__tests__/yieldService.test.ts` | 🟢 PASS | 100% |

---

## 3. Resumen de Ejecución de Pruebas

```
┌─────────────────────────────────────────────────────────────┐
│ RESULTADO DE PRUEBAS AUTOMATIZADAS (JEST)                  │
├─────────────────────────────────────────────────────────────┤
│ Test Suites: 3 passed, 3 total                              │
│ Tests:       12 passed, 12 total (100% éxito)               │
│ Snapshots:   0 total                                        │
│ Tiempo:      ~7 segundos                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Registro Histórico de Defectos (Bug Tracker)

| ID Defecto | Módulo | Severidad | Descripción | Causa Raíz | Solución Implementada | Estado |
|---|---|---|---|---|---|---|
| **BUG-001** | DB / Services | 🔴 Crítica | `delete()` de transacción no reintegraba el saldo a la cuenta. | Falta de triggers contables en PostgreSQL. | Trigger `trg_sync_account_balance` en migración 006. | ✅ Resuelto |
| **BUG-002** | Mobile Auth | 🟡 Media | Face ID solo mostraba alerta sin login real. | Mock sin almacenamiento seguro. | `biometricService.ts` con cifrado en `expo-secure-store`. | ✅ Resuelto |
| **BUG-003** | Mobile UI | 🟡 Media | Sin pantalla ni capacidad para editar movimientos en lista. | Falta de `EditTransactionScreen` y hook `useUpdateTransaction`. | Pantalla modal creada, tap y long-press activos. | ✅ Resuelto |
| **BUG-004** | DB Schema | 🟠 Alta | Bloqueo al borrar cuenta por `ON DELETE RESTRICT`. | FK estricta en base de datos. | Soft-delete (`is_active = false`) en `accountService.delete()`. | ✅ Resuelto |
| **BUG-005** | Mobile Feature | 🟠 Alta | Sin soporte de transferencias entre cuentas. | Formulario solo admitía gasto e ingreso. | Migración 007 con `to_account_id` y selector bilateral. | ✅ Resuelto |
