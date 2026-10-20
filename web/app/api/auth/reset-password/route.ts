import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email inválido o no proporcionado' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const redirectTo = `${origin}/auth/callback?next=/auth/update-password`;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Si contamos con service role key, generamos el enlace y enviamos el correo customizado por Resend API
    if (serviceKey && supabaseUrl) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (data?.properties?.action_link) {
        await sendPasswordResetEmail({
          to: email,
          resetUrl: data.properties.action_link,
        });

        return NextResponse.json({ ok: true, method: 'resend_api' });
      }
    }

    // Fallback: usar el cliente estándar de Supabase (que usará el SMTP de Resend configurado en Supabase)
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: 'Configuración de Supabase incompleta' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, anonKey);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, method: 'supabase_smtp' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error inesperado al enviar el correo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
