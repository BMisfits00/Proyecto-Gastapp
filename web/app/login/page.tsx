'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D1A]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">
            <span className="text-[#7B68EE]">Gast</span>app
          </h1>
          <p className="text-[#8888AA] text-sm">Tus finanzas, bajo control</p>
        </div>

        {/* Card */}
        <div className="bg-[#1A1A2E] rounded-2xl p-8 border border-[#2A2A45]">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-[#8888AA] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE] transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm text-[#8888AA] mb-1">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-[#252540] border border-[#2A2A45] rounded-xl px-4 py-3 text-white placeholder-[#55556A] focus:outline-none focus:border-[#7B68EE] transition-colors"
              />
            </div>

            {error && (
              <p className="text-[#FF6B6B] text-sm bg-[#FF6B6B]/10 px-4 py-3 rounded-xl">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7B68EE] hover:bg-[#9B8FFF] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Cargando...' : isRegister ? 'Crear cuenta' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-[#8888AA] text-sm mt-6">
            {isRegister ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}{' '}
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-[#7B68EE] hover:text-[#9B8FFF] font-medium"
            >
              {isRegister ? 'Iniciá sesión' : 'Registrate'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
