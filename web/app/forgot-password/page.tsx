'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Landmark, ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar el correo de recuperación');
      }

      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado al solicitar el restablecimiento');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header institucional */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-blue-800 rounded-2xl border border-blue-100 shadow-xs">
            <Landmark className="h-8 w-8 text-blue-700" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gastapp</h1>
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
            Portal de Finanzas Personales
          </p>
        </div>

        {/* Card principal */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="space-y-1 pb-4 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">
              Recuperación de Acceso
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Ingresá tu correo electrónico para recibir un enlace de restablecimiento seguro
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {sent ? (
              <div className="space-y-5 text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    Correo de recuperación enviado
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hemos enviado las instrucciones para restablecer tu contraseña a{' '}
                    <strong className="text-slate-900">{email}</strong> a través de Resend.
                  </p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 leading-normal text-left">
                  ℹ Por seguridad bancaria, el enlace enviado expirará en 60 minutos. Si no lo ves en tu bandeja de entrada, revisá tu carpeta de spam.
                </div>
                <Link href="/login" className="block pt-2">
                  <Button variant="outline" className="w-full text-xs font-semibold">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio de Sesión
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tunombre@ejemplo.com"
                      required
                      autoFocus
                      className="pl-9"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading || !email.trim()} className="w-full mt-2 font-semibold">
                  {loading ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
                </Button>

                <div className="pt-2 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Volver al ingreso de usuario
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
