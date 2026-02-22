import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Keyboard,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Linking,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../lib/theme';
import { AppInput, AppButton } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { validate } from '../../lib/validation';
import { loginSchema } from '../../lib/validation/schemas';

const c = theme.colors;
const s = theme.spacing;

const LOG_RENDER = __DEV__ && false;
const WHATSAPP_NUMBER = '5511986318000';
const SMALL_SCREEN_HEIGHT = 700;
const EXTRA_SMALL_SCREEN_HEIGHT = 560;

// Gradiente suave único (sem bloco azul chapado)
const AUTH_GRADIENT: [string, string, ...string[]] = ['#F7FBFF', '#B8DFFB', '#8FD0FF'];

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const { height: windowHeight } = useWindowDimensions();
  const isSmallScreen = windowHeight < SMALL_SCREEN_HEIGHT;
  const isExtraSmallScreen = windowHeight < EXTRA_SMALL_SCREEN_HEIGHT;

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

  const openWhatsApp = useCallback(() => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const content = (
    /* Card único centralizado no gradiente */
    <View style={[styles.card, isSmallScreen && styles.cardSmall]}>

      {/* Logo + tagline no topo do card */}
      <View style={[styles.logoSection, isSmallScreen && styles.logoSectionSmall]}>
        <Logo size="small" variant="dark" compact />
        <Text style={[styles.tagline, isSmallScreen && styles.taglineSmall]}>
          Renove sua receita e pedido de exames.{'\n'}Rápido e sem burocracia.
        </Text>
      </View>

      {/* Separador visual */}
      <View style={styles.cardDivider} />

      {/* Inputs */}
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
        containerStyle={styles.inputContainer}
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
        containerStyle={styles.inputLast}
      />

      {/* Botão Login — lugar correto: após Senha, antes de Esqueceu senha (TouchableOpacity para garantir visibilidade no Expo Go) */}
      <View style={styles.loginButtonWrap}>
        <TouchableOpacity
          style={[styles.loginButtonPrimary, loading && styles.loginButtonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Esqueceu senha */}
      <TouchableOpacity
        onPress={handleForgotPassword}
        style={styles.forgotRow}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
      </TouchableOpacity>

      {/* OU */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Botões sociais */}
      <AppButton
        title="Continuar com Apple"
        onPress={() => {}}
        disabled
        variant="outline"
        fullWidth
        icon="logo-apple"
        style={styles.socialButton}
      />

      {/* Rodapé */}
      <TouchableOpacity
        onPress={openWhatsApp}
        style={styles.whatsappLink}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.whatsappLinkText}>Precisa de ajuda? Fale no WhatsApp</Text>
      </TouchableOpacity>

      <View style={styles.registerRow}>
        <Text style={styles.registerText}>Não tem uma conta? </Text>
        <TouchableOpacity onPress={handleRegister} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.registerLink}>Crie agora!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <LinearGradient
      colors={AUTH_GRADIENT}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(60, windowHeight * 0.15) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // Card único — contém TUDO (logo + form + social + links)
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    ...theme.shadows.card,
  },
  cardSmall: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },

  // Logo + tagline (topo do card)
  logoSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logoSectionSmall: {
    marginBottom: 8,
  },
  tagline: {
    marginTop: 8,
    fontSize: 13,
    color: c.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  taglineSmall: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },

  // Separador fino entre header e form
  cardDivider: {
    height: 1,
    backgroundColor: c.border.light,
    marginBottom: 10,
  },

  // Inputs
  inputContainer: {
    marginBottom: 4,
  },
  inputLast: {
    marginBottom: 0,
  },

  // Esqueceu senha
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 6,
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '500',
    color: c.primary.main,
  },

  // Botão Login (após Senha — lugar correto)
  loginButtonWrap: {
    height: 52,
    minHeight: 52,
    marginTop: 12,
    marginBottom: 8,
  },
  loginButtonPrimary: {
    flex: 1,
    height: 52,
    backgroundColor: c.primary.main,
    borderRadius: theme.borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Separador OU
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.border.light,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
    color: c.text.tertiary,
    letterSpacing: 0.5,
  },

  // Botões sociais
  socialButton: {
    height: 48,
    marginBottom: 0,
  },

  // WhatsApp
  whatsappLink: {
    marginTop: 14,
    alignSelf: 'center',
  },
  whatsappLinkText: {
    fontSize: 12,
    color: c.text.tertiary,
    textDecorationLine: 'underline',
    fontWeight: '400',
  },

  // Crie agora
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    flexWrap: 'wrap',
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
