'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Landmark, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la contraseña');
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
            Seguridad Bancaria & Credenciales
          </p>
        </div>

        {/* Card principal */}
        <Card className="border-slate-200 bg-white shadow-xs">
          <CardHeader className="space-y-1 pb-4 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-900">
              Nueva Contraseña
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Establecé una nueva clave de acceso para tu cuenta
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {success ? (
              <div className="space-y-5 text-center py-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    ¡Contraseña actualizada con éxito!
                  </h3>
                  <p className="text-xs text-slate-600">
                    Tu nueva clave de acceso ha sido guardada. Te estamos redirigiendo a tu Posición Global...
                  </p>
                </div>
                <Button onClick={() => router.push('/dashboard')} className="w-full text-xs font-semibold">
                  Ir al Panel Principal
                </Button>
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
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Confirmar Nueva Contraseña
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Reescribí tu contraseña"
                      required
                      minLength={6}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/60 p-3 rounded-xl space-y-1">
                  <p className="font-semibold text-slate-700">Requisitos de seguridad:</p>
                  <p>• Mínimo 6 caracteres de longitud.</p>
                  <p>• Se recomienda combinar letras, números y símbolos.</p>
                </div>

                <Button type="submit" disabled={loading} className="w-full mt-2 font-semibold">
                  {loading ? 'Guardando nueva clave...' : 'Actualizar contraseña'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
