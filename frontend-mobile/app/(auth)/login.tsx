import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { Screen, AppInput, AppButton } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { validate } from '../../lib/validation';
import { loginSchema } from '../../lib/validation/schemas';

const c = theme.colors;
const s = theme.spacing;

const LOG_RENDER = __DEV__ && false;

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const renderCount = useRef(0);
  renderCount.current += 1;
  if (LOG_RENDER) console.log('[Login] render #', renderCount.current);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    setErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
  }, []);

  const handleLogin = useCallback(async () => {
    Keyboard.dismiss();

    const result = validate(loginSchema, { email, password });
    if (!result.success) {
      setErrors((result.errors as { email?: string; password?: string }) ?? {});
      Alert.alert('Campos obrigatórios', result.firstError ?? 'Preencha email e senha.');
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const user = await signIn(result.data!.email, result.data!.password);
      const dest = !user.profileComplete
        ? (user.role === 'doctor' ? '/(auth)/complete-doctor' : '/(auth)/complete-profile')
        : user.role === 'doctor'
        ? '/(doctor)/dashboard'
        : '/(patient)/home';
      setTimeout(() => router.replace(dest as any), 0);
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const msg = err?.message || String(error) || 'Email ou senha incorretos.';
      const isNetworkError =
        !err?.status && (msg?.includes('fetch') || msg?.includes('network') || msg?.includes('Network'));
      const title = isNetworkError ? 'Erro de conexão' : 'Erro no login';
      const detail = isNetworkError
        ? `${msg}\n\nVerifique se a API está rodando e se o dispositivo alcança o servidor.`
        : msg;
      if (__DEV__) console.warn('[Login] Erro:', { status: err?.status, message: msg });
      Alert.alert(title, detail);
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, router]);

  const handleForgotPassword = useCallback(() => {
    router.push('/(auth)/forgot-password');
  }, [router]);

  const handleRegister = useCallback(() => {
    router.push('/(auth)/register');
  }, [router]);

  const focusPassword = useCallback(() => {
    passwordRef.current?.focus();
  }, []);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return (
    <Screen variant="gradient" scroll contentStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>RenoveJá +</Text>
        <Text style={styles.subtitle}>
          {'Renove sua receita e pedido de exames.\nRápido e sem burocracia.'}
        </Text>
      </View>

      {/* Form - inputs always mounted, no conditional rendering, no key changes */}
      <View style={styles.form}>
        <AppInput
          label="Email"
          leftIcon="mail-outline"
          placeholder="seu@email.com"
          value={email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={focusPassword}
          error={errors.email}
        />

        <AppInput
          ref={passwordRef}
          label="Senha"
          leftIcon="lock-closed-outline"
          placeholder="Sua senha"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={dismissKeyboard}
          error={errors.password}
        />

        <TouchableOpacity
          onPress={handleForgotPassword}
          style={styles.forgotRow}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
        </TouchableOpacity>

        <AppButton
          title="Login"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          fullWidth
          style={styles.loginButton}
        />

        {/* WhatsApp */}
        <Text style={styles.whatsapp}>WHATSAPP: (11) 98631-8000</Text>

        {/* Social Login Icons */}
        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialCircle} activeOpacity={0.7}>
            <Ionicons name="logo-google" size={22} color={c.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialCircle} activeOpacity={0.7}>
            <Ionicons name="logo-apple" size={22} color={c.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Register Link */}
      <View style={styles.registerRow}>
        <Text style={styles.registerText}>Não tem uma conta? </Text>
        <TouchableOpacity onPress={handleRegister}>
          <Text style={styles.registerLink}>Crie agora!</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: s.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: s.xxl,
    marginBottom: s.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: c.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: c.text.secondary,
    textAlign: 'center',
    marginTop: s.sm,
    lineHeight: 22,
  },
  form: {
    marginBottom: s.lg,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: s.md,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.primary.main,
  },
  loginButton: {
    marginTop: s.sm,
  },
  whatsapp: {
    fontSize: 12,
    fontWeight: '600',
    color: c.text.tertiary,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: s.lg,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s.md,
    marginTop: s.lg,
  },
  socialCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: c.border.main,
    backgroundColor: c.background.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: s.xl,
    marginBottom: s.lg,
  },
  registerText: {
    fontSize: 14,
    color: c.text.secondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: c.primary.main,
  },
});
