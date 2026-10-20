import { useState } from 'react';
import { authService } from '../services/authService';
import { biometricService } from '../services/biometricService';
import { useAuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const { session, user, loading, signOut } = useAuthContext();
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (email: string, password: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await authService.signIn(email, password);
      // Guardar credenciales para futuros ingresos biométricos
      await biometricService.saveCredentials(email, password);
    } catch (e: any) {
      setError(e.message ?? 'Error al iniciar sesión');
      throw e;
    } finally {
      setAuthLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      await authService.signUp(email, password, fullName);
    } catch (e: any) {
      setError(e.message ?? 'Error al registrarse');
      throw e;
    } finally {
      setAuthLoading(false);
    }
  };

  return { session, user, loading, authLoading, error, signIn, signUp, signOut };
}
