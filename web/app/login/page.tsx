'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1E40AF] text-white shadow-md mb-4">
            <Landmark className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            <span className="text-[#1E40AF]">Gast</span>app
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Portal de Gestión Financiera</p>
        </div>

        {/* Card */}
        <Card className="border-slate-200 shadow-xl bg-white p-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-slate-900">
              {isRegister ? 'Crear nueva cuenta' : 'Ingreso a Banca Personal'}
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              {isRegister
                ? 'Completá tus credenciales para darte de alta en la plataforma'
                : 'Ingresá tu correo electrónico y clave para acceder'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-4 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Correo electrónico
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Contraseña</label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => alert('La funcionalidad de recuperación por correo se habilitará en la próxima actualización.')}
                      className="text-xs text-[#1E40AF] hover:underline font-semibold cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-2">
                {loading ? 'Procesando...' : isRegister ? 'Registrarme' : 'Ingresar'}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="text-xs text-slate-600 hover:text-[#1E40AF] transition-colors font-semibold cursor-pointer"
              >
                {isRegister
                  ? '¿Ya tenés una cuenta registrada? Iniciar sesión'
                  : '¿Primera vez en Gastapp? Crear una cuenta'}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400">
          Conexión cifrada y protegida por Supabase Auth (TLS 1.3)
        </p>
      </div>
    </div>
  );
}
