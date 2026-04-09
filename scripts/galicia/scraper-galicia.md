# Galicia Online Banking Scraper

Automatización que extrae datos financieros del Galicia Online Banking y los guarda en un JSON estructurado, listo para importar a Gastapp.

---

## Qué extrae

| Sección | Datos |
|---------|-------|
| **Movimientos de cuenta** | Últimos 6 meses de la Caja Ahorro Pesos: fecha, descripción, detalle completo, tipo (ingreso/egreso), monto, saldo parcial y moneda |
| **Tarjeta de crédito** | Resumen del período actual (consumo ARS/USD, vencimiento, cierre, pago mínimo, disponible) + 35 últimos movimientos individuales con comercio, monto, moneda y cuotas |
| **Plazos fijos** | Por cada plazo: tipo, días, fecha de vencimiento, TNA, capital invertido, total a cobrar y ganancia |
| **Compras/ventas de dólares** | Historial de operaciones: fecha, tipo de operación, cotización, USD acreditados y ARS debitados |

---

## Estructura de archivos

```
scripts/galicia/
├── scraper.mjs                  ← script principal
├── credentials.json             ← tus credenciales (NO se sube a git)
├── credentials.example.json     ← plantilla para crear credentials.json
├── package.json                 ← dependencias (solo Playwright)
├── output-YYYY-MM-DD.json       ← resultado de cada corrida (NO se sube a git)
└── debug/                       ← screenshots de errores (NO se sube a git)
```

### credentials.json

```json
{
  "dni":      "12345678",
  "username": "tu_usuario_galicia",
  "password": "tu_contraseña"
}
```

Este archivo nunca se sube a Git (está en `.gitignore`). Para crearlo:

```bash
cd scripts/galicia
cp credentials.example.json credentials.json
# Editarlo con tus datos reales
```

---

## Cómo correrlo

Desde la carpeta `scripts/galicia/`:

```bash
# Modo silencioso (recomendado para uso diario)
node scraper.mjs

# Con el navegador visible (útil para ver qué hace)
node scraper.mjs --headed

# Modo debug: navegador visible + movimientos lentos
node scraper.mjs --headed --slow
```

O usando los scripts de `package.json`:

```bash
npm run scrape
npm run scrape:headed
npm run scrape:debug
```

---

## Cómo funciona por dentro

### 1. Login

El scraper abre un Chromium controlado por [Playwright](https://playwright.dev/) y navega a `https://onlinebanking.bancogalicia.com.ar/login`.

El formulario de login del Galicia tiene una particularidad: el botón "Iniciar Sesión" está **deshabilitado por JavaScript** hasta que los tres campos estén completos. Por eso el scraper usa `pressSequentially()` en lugar de `fill()` — simula pulsaciones de teclado reales para disparar los eventos del DOM que habilitan el botón.

```
DNI → #DocumentNumber
Usuario → #UserName
Contraseña → #Password
Submit → #submitButton (espera a que se habilite)
```

Después del login, el banco redirige a `/inicio`. Si la URL no cambia, el scraper toma un screenshot en `debug/login-error.png` y termina con error.

---

### 2. Interceptor de respuestas (el truco central)

Antes de navegar a cualquier sección, el scraper registra un listener que escucha **todas las respuestas JSON** que el banco hace internamente:

```
GetMovimientosCuenta     → movimientos de cuenta
GetConsumosTarjetas      → resumen legacy de tarjeta
bff/overview/cards       → datos modernos de tarjeta (BFF)
bff/cards/movements-tc   → movimientos individuales de tarjeta
obtener-plazos-fijos     → plazos fijos
```

Cuando el scraper navega a una sección, el banco hace sus llamadas AJAX internas y el interceptor las captura silenciosamente. Así no hay que parsear HTML complejo — se trabaja directo con JSON limpio.

---

### 3. Movimientos de cuenta

**Sección:** `menulink/2` → `cuentas.bancogalicia.com.ar/cuentas/inicio`

El Galicia usa dos subdominios: `onlinebanking.bancogalicia.com.ar` y `cuentas.bancogalicia.com.ar`. La sesión se comparte mediante cookies de dominio `.bancogalicia.com.ar`.

Para cargar los movimientos, el scraper hace click en la primera tarjeta de cuenta (`div.box_ctas.clickeable`), lo que dispara un `POST` a:

```
POST /Cuentas/GetMovimientosCuenta
Body: fd=DD/MM/YYYY&fh=DD/MM/YYYY&motivo=Todos&pagina=0
```

El interceptor captura la respuesta. Cada movimiento en el JSON tiene:

```json
{
  "id":          "uuid",
  "date":        "2026-04-06",
  "description": "Transferencia a terceros",
  "detail":      "TRANSFERENCIA A TERCEROS NOMBRE APELLIDO CUIT ...",
  "type":        "expense",
  "amount":      36000,
  "balance":     276270.69,
  "currency":    "ARS",
  "pending":     false
}
```

---

### 4. Tarjeta de crédito

**Sección:** `menulink/390` → SPA Next.js en `static.bancogalicia.com.ar/cards-overview-spa`

La sección de tarjetas es una aplicación Next.js separada (distinto al resto del sitio que usa jQuery/ASP.NET MVC). Tarda más en cargar (5 segundos de espera extra).

Usa dos endpoints modernos tipo BFF (Backend for Frontend):

**Resumen:**
```
GET bff-cards-overview-pota-cards.bff.bancogalicia.com.ar/bff/overview/cards
```
Devuelve: últimos 4 dígitos, marca, producto, titular, vencimiento, consumos ARS/USD, forma de pago.

**Movimientos:**
```
POST bff-cards-movements-tc-pota-cards.bff.bancogalicia.com.ar/bff/cards/movements-tc
```
Devuelve: fecha, nombre del comercio, moneda, monto, plan de cuotas.

Ejemplo de movimiento de tarjeta:
```json
{
  "date":        "2026-04-05",
  "merchant":    "NETFLIX.COM USA",
  "currency":    "USD",
  "amount":      10.82,
  "installment": null,
  "type":        "credit"
}
```

---

### 5. Plazos fijos

**Sección:** `menulink/6` → `inversiones.bancogalicia.com.ar`

El contenido de plazos fijos lo renderiza el servidor como HTML embebido dentro de una respuesta JSON (`HTMLVista`). El scraper tiene dos estrategias:

1. **Primero intenta** leer la API interceptada `obtener-plazos-fijos` — si el campo `PlazosFijos` viene con datos estructurados, los usa directamente.
2. **Si no**, lee el texto visible del DOM y lo parsea con regex. El texto tiene esta forma:
   ```
   Tradicional Sin alias 33 días 04/05/2026 22,00% $800.000,00 $803.375,34 $3.375,34 0,42%
   ```
   Y lo convierte en:
   ```json
   {
     "type":        "Tradicional",
     "termDays":    33,
     "maturityDate":"2026-05-04",
     "tna":         22,
     "capitalARS":  800000,
     "totalARS":    803375.34,
     "gainARS":     3375.34,
     "currency":    "ARS"
   }
   ```

---

### 6. Compras de dólares

**Sección:** `menulink/76` → `Compra/Venta de moneda extranjera`

Esta sección es server-rendered con jQuery (la más simple). La tabla de historial se lee directamente del DOM:

```
Columnas: Fecha | Operación | Cotización | Monto acreditado (USD) | Monto debitado (ARS)
```

Ejemplo de resultado:
```json
{
  "date":      "2026-03-02",
  "operation": "Compra de Dólares",
  "rateARS":   1420,
  "amountUSD": 20,
  "amountARS": 28400,
  "type":      "buy"
}
```

---

## Archivo de salida

Cada corrida genera `output-YYYY-MM-DD.json` con esta estructura:

```json
{
  "scrapedAt": "2026-04-08T21:00:00.000Z",
  "period": {
    "from": "08/10/2025",
    "to":   "08/04/2026"
  },
  "movements": [...],
  "cards": {
    "summary": { ... },
    "movements": [...]
  },
  "investments": [...],
  "fxPurchases": [...]
}
```

Si corrés el scraper más de una vez en el mismo día, el archivo se sobreescribe.

---

## Debug y errores

Si algo falla, el scraper:
1. Muestra el error en consola con `⚠`
2. Guarda un screenshot en `debug/<nombre-del-error>.png`
3. Continúa con las secciones siguientes (no aborta todo)

Solo aborta completamente si falla el login.

Screenshots posibles:

| Archivo | Qué indica |
|---------|-----------|
| `debug/login-error.png` | Credenciales incorrectas o el banco bloqueó el acceso |
| `debug/movements-error.png` | No se cargaron los movimientos de cuenta |
| `debug/cards-error.png` | Error al cargar la sección de tarjetas |
| `debug/investments-error.png` | Error al cargar inversiones |
| `debug/fx-error.png` | Error al cargar compra/venta de dólares |
| `debug/fatal-error.png` | Error inesperado no contemplado |

---

## Limitaciones conocidas

- **Solo extrae la Caja Ahorro Pesos** como cuenta principal. La Caja Ahorro Dólares y la Cuenta Corriente no están incluidas (se puede agregar repitiendo el flujo para las otras cards).
- **Los movimientos tienen un máximo de 6 meses** hacia atrás. El banco no devuelve más que eso en una sola llamada.
- **El historial de dólares** muestra solo las operaciones visibles en la tabla (máximo 10 por página por defecto). Si hay más, se necesitaría paginación.
- **Si el banco actualiza su UI** o cambia los IDs de los campos de login (`#DocumentNumber`, `#UserName`, `#Password`), el scraper necesita ajuste.
- **Requiere sesión activa**: si el banco agrega un segundo factor de autenticación (2FA por SMS) en algún momento, el flujo de login deberá manejarlo.
