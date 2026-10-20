import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_CREDENTIALS_KEY = 'gastapp_biometric_credentials';

export const biometricService = {
  // Comprobar si el dispositivo cuenta con hardware y biometría enrolada
  async checkAvailability() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return {
      available: hasHardware && isEnrolled,
      hasHardware,
      isEnrolled,
      supportedTypes,
    };
  },

  // Guardar credenciales de forma segura y encriptada en el Keychain/Keystore
  async saveCredentials(email: string, password: string): Promise<void> {
    try {
      const data = JSON.stringify({ email, password });
      await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, data, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch (error) {
      console.warn('No se pudieron guardar las credenciales biométricas:', error);
    }
  },

  // Obtener credenciales guardadas
  async getSavedCredentials(): Promise<{ email: string; password: string } | null> {
    try {
      const data = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  // Verificar si hay credenciales previamente almacenadas
  async hasSavedCredentials(): Promise<boolean> {
    try {
      const data = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      return !!data;
    } catch {
      return false;
    }
  },

  // Eliminar credenciales guardadas
  async clearCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
    } catch (error) {
      console.warn('Error al eliminar credenciales biométricas:', error);
    }
  },

  // Disparar el diálogo biométrico nativo
  async authenticate(prompt = 'Ingresá a Gastapp'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        fallbackLabel: 'Usar contraseña',
        cancelLabel: 'Cancelar',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch {
      return false;
    }
  },
};
