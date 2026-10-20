import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Gastapp <onboarding@resend.dev>';

/**
 * Plantilla HTML de correo corporativo para recuperación de contraseña
 */
export function getPasswordResetHtml(resetUrl: string) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Restablecer contraseña - Gastapp</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Bancario -->
          <tr>
            <td style="background-color: #1E3A8A; padding: 28px 36px; text-align: left;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                    🏛️ Gastapp
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #93C5FD; font-weight: 500; padding-top: 4px;">
                    Portal de Finanzas Personales & Gestión Bancaria
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 16px 0;">
                Solicitud para restablecer tu contraseña
              </h1>
              <p style="font-size: 15px; line-height: 24px; color: #475569; margin: 0 0 24px 0;">
                Recibimos una solicitud para actualizar la clave de acceso a tu portal en <strong>Gastapp</strong>. Para crear una nueva contraseña segura, presioná el siguiente botón:
              </p>

              <!-- Botón CTA -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #1E40AF;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 30px; font-size: 15px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 10px;">
                      Restablecer mi contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 20px; color: #64748B; margin: 0 0 16px 0;">
                Si el botón no funciona, copiá y pegá el siguiente enlace en tu navegador:
              </p>
              <p style="font-size: 12px; line-height: 18px; color: #1E40AF; word-break: break-all; margin: 0 0 28px 0; background-color: #F1F5F9; padding: 12px; border-radius: 8px;">
                <a href="${resetUrl}" style="color: #1E40AF; text-decoration: underline;">${resetUrl}</a>
              </p>

              <!-- Alerta de seguridad -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FEF2F2; border: 1px solid #FEE2E2; border-radius: 10px; padding: 14px; margin-top: 10px;">
                <tr>
                  <td style="font-size: 12px; line-height: 18px; color: #991B1B;">
                    <strong>🔒 Aviso de seguridad:</strong> Si no solicitaste este cambio, no te preocupes; tu cuenta continúa segura y podés desestimar este mensaje. Por tu protección, este enlace caducará en 60 minutos.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 36px; text-align: center;">
              <p style="font-size: 12px; color: #94A3B8; margin: 0;">
                © 2026 Gastapp. Sistema de Control Financiero Inteligente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Plantilla HTML de correo de bienvenida y alta de usuario
 */
export function getWelcomeEmailHtml(userEmail: string) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Bienvenido a Gastapp</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #1E3A8A; padding: 28px 36px; text-align: left;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 24px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
                    🏛️ Gastapp
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #93C5FD; font-weight: 500; padding-top: 4px;">
                    Portal de Finanzas Personales & Gestión Bancaria
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 36px 36px 28px 36px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #0F172A; margin: 0 0 16px 0;">
                ¡Te damos la bienvenida a tu portal financiero!
              </h1>
              <p style="font-size: 15px; line-height: 24px; color: #475569; margin: 0 0 20px 0;">
                Tu cuenta asociada a <strong>${userEmail}</strong> fue dada de alta con éxito. A partir de ahora podés consolidar tus cuentas bancarias, controlar consumos en tarjetas, monitorear tus rendimientos diarios y realizar transferencias bilaterales en un solo lugar.
              </p>

              <div style="background-color: #F1F5F9; border-radius: 12px; padding: 18px 20px; margin: 24px 0;">
                <p style="font-size: 14px; font-weight: 700; color: #1E3A8A; margin: 0 0 8px 0;">
                  Primeros pasos recomendados:
                </p>
                <ul style="font-size: 13px; color: #475569; margin: 0; padding-left: 20px; line-height: 22px;">
                  <li>Configurá tus cuentas bancarias o billeteras virtuales.</li>
                  <li>Registrá tus ingresos o consumos frecuentes.</li>
                  <li>Sincronizá tus tarjetas de crédito y colocaciones.</li>
                </ul>
              </div>

              <p style="font-size: 14px; color: #64748B; margin: 0;">
                Gracias por confiar en Gastapp para optimizar tu economía personal.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 36px; text-align: center;">
              <p style="font-size: 12px; color: #94A3B8; margin: 0;">
                © 2026 Gastapp. Sistema de Control Financiero Inteligente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Función para enviar correo de restablecimiento de contraseña
 */
export async function sendPasswordResetEmail({ to, resetUrl }: { to: string; resetUrl: string }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurada');
  }

  return await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: '🔒 Restablecimiento de contraseña - Gastapp',
    html: getPasswordResetHtml(resetUrl),
  });
}

/**
 * Función para enviar correo de bienvenida
 */
export async function sendWelcomeEmail({ to }: { to: string }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurada');
  }

  return await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: '🏛️ ¡Bienvenido a Gastapp! Tu portal financiero personal',
    html: getWelcomeEmailHtml(to),
  });
}
