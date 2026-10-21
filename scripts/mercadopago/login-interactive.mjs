import { chromium } from '../galicia/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credsPath = path.join(__dirname, 'credentials.json');
const storagePath = path.join(__dirname, 'storage_state.json');

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

async function main() {
  console.log('🚀 Abriendo navegador visible para Mercado Pago...');
  console.log('👉 Se va a abrir una ventana de Chrome en tu pantalla.');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
    ],
  }).catch(async () => {
    return chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
    });
  });

  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'es-AR',
  });

  const page = await context.newPage();

  // URL universal de login de Mercado Pago / Mercado Libre con sesión fresca
  const targetUrl = 'https://www.mercadolibre.com/jms/mla/lgz/msl/login?platform_id=mp';

  console.log('Navegando al login oficial de Mercado Pago...');
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Página cargada:', await page.title());

  // 1. Intentar autocompletar usuario / email / teléfono
  try {
    const idInput = page.locator('input[name="user_id"], input[name="identifier"], input[id*="user_id"], input[type="text"]').first();
    const visible = await idInput.isVisible({ timeout: 6000 }).catch(() => false);
    if (visible && creds.identifier) {
      console.log('✍ Autocompletando usuario/email...');
      await idInput.click();
      await idInput.fill(creds.identifier);
      await page.waitForTimeout(500);

      const submitBtn = page.locator('button[type="submit"], button:has-text("Continuar")').first();
      await submitBtn.click().catch(() => {});
      console.log('✓ Enviado identificador.');
    }
  } catch (e) {
    console.log('ℹ Podés ingresar tu usuario manualmente en la ventana.');
  }

  // 2. Intentar autocompletar contraseña
  try {
    const passInput = page.locator('input[name="password"], input[type="password"]').first();
    const passVisible = await passInput.isVisible({ timeout: 6000 }).catch(() => false);
    if (passVisible && creds.password) {
      console.log('✍ Autocompletando contraseña...');
      await passInput.click();
      await passInput.fill(creds.password);
      await page.waitForTimeout(500);

      const loginBtn = page.locator('button[type="submit"], button:has-text("Iniciar sesión"), button:has-text("Ingresar"), button:has-text("Continuar")').first();
      await loginBtn.click().catch(() => {});
      console.log('✓ Enviada contraseña.');
    }
  } catch (e) {
    console.log('ℹ Podés ingresar tu contraseña manualmente si aparece.');
  }

  console.log('\n⏳ Ventana de login abierta.');
  console.log('👉 Si Mercado Pago solicita verificación (2FA, WhatsApp, SMS o notificación en la app), completalo en la ventana de Chrome.');
  console.log('👉 El script está esperando a que ingreses a tu cuenta de Mercado Pago (espera hasta 10 minutos)...\n');

  // Esperar a que el usuario termine el login
  const startTime = Date.now();
  const maxWaitMs = 600_000; // 10 minutos
  let loggedIn = false;

  while (Date.now() - startTime < maxWaitMs) {
    const url = page.url();
    // Detectar cuando el usuario ya ingresó a Mercado Pago
    const isMPHome = url.includes('mercadopago.com.ar') &&
      !url.includes('/login') &&
      !url.includes('/identification') &&
      !url.includes('challenge') &&
      !url.includes('/signin') &&
      !url.includes('/gz/msl');

    if (isMPHome) {
      loggedIn = true;
      break;
    }
    await page.waitForTimeout(2000);
  }

  if (loggedIn) {
    console.log('\n🎉 ¡Inicio de sesión en Mercado Pago detectado exitosamente!');
    console.log('URL actual:', page.url());

    // Esperar unos segundos para asentar cookies y tokens
    await page.waitForTimeout(3000);

    // Guardar sesión
    await context.storageState({ path: storagePath });
    console.log('💾 Sesión y cookies guardadas en:', storagePath);
    console.log('✓ ¡Listo! Ya podemos scrapear Mercado Pago en segundo plano sin 2FA.');

    await page.waitForTimeout(3000);
  } else {
    console.warn('\n⚠ Tiempo de espera finalizado (10 min) sin detectar ingreso completo.');
  }

  await browser.close();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
