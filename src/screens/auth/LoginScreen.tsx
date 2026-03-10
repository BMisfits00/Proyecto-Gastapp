import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, authLoading, error } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completá email y contraseña.');
      return;
    }
    await signIn(email.trim(), password);
  };

  const handleBiometric = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Ingresá a Gastapp',
      fallbackLabel: 'Usar contraseña',
    });
    if (result.success) {
      Alert.alert('Biométrica OK', 'Autenticación por Face ID exitosa (conectar con sesión guardada).');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[Colors.primaryDark, Colors.primary]}
              style={styles.logoBox}
            >
              <Ionicons name="wallet" size={36} color={Colors.text} />
            </LinearGradient>
            <Text style={styles.title}>Gastapp</Text>
            <Text style={styles.subtitle}>Controlá tus finanzas personales</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              icon="mail-outline"
            />

            <Input
              label="Contraseña"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              isPassword
              icon="lock-closed-outline"
            />

            <Button
              title="Iniciar sesión"
              onPress={handleLogin}
              loading={authLoading}
              style={styles.mainButton}
            />

            {/* Face ID */}
            <TouchableOpacity style={styles.biometricBtn} onPress={handleBiometric}>
              <Ionicons name="scan-outline" size={22} color={Colors.primary} />
              <Text style={styles.biometricText}>Ingresar con Face ID</Text>
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerText}>
              ¿No tenés cuenta?{' '}
              <Text style={styles.registerBold}>Registrate</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { color: Colors.text, fontSize: FontSize.xxxl, fontWeight: '800' },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.md, marginTop: Spacing.xs },
  form: { marginBottom: Spacing.xl },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: { color: Colors.error, fontSize: FontSize.sm, flex: 1 },
  mainButton: { marginTop: Spacing.sm },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  biometricText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '500' },
  registerLink: { alignItems: 'center', paddingBottom: Spacing.xl },
  registerText: { color: Colors.textSecondary, fontSize: FontSize.md },
  registerBold: { color: Colors.primary, fontWeight: '700' },
});
