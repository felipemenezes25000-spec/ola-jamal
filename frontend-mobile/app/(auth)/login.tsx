import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Linking,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import Constants from 'expo-constants';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { useColorSchemeContext } from '../../contexts/ColorSchemeContext';
import type { DesignColors, DesignTokens } from '../../lib/designSystem';
import { AppInput, AppButton } from '../../components/ui';
import { FadeIn } from '../../components/ui/FadeIn';
import { Logo } from '../../components/Logo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, FORBIDDEN_MESSAGE_KEY } from '../../contexts/AuthContext';
import { validate } from '../../lib/validation';
import { loginSchema } from '../../lib/validation/schemas';

const LOG_RENDER = __DEV__ && false;
const WHATSAPP_NUMBER = '5511986318000';
const SMALL_SCREEN_HEIGHT = 700;

// Fallback Google OAuth — garante botão ativo mesmo quando extra/env não carrega (APK antigo, cache)
const GOOGLE_FALLBACK = {
  web: '598286841038-j095u3iopiqltpgbvu0f5od924etobk7.apps.googleusercontent.com',
  android: '598286841038-780e9kksjoscthg0g611virnchlb7kcr.apps.googleusercontent.com',
  ios: '598286841038-28ili7c5stg5524sicropmm7s7nkq936.apps.googleusercontent.com',
};

export default function Login() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { colors, shadows } = useAppTheme();
  const { isDark } = useColorSchemeContext();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  const AUTH_GRADIENT: [string, string, ...string[]] = isDark
    ? [colors.background, colors.surfaceSecondary, colors.primaryDark]
    : [colors.surfaceSecondary, colors.primarySoft, colors.primary];

  const { height: windowHeight } = useWindowDimensions();
  const isSmallScreen = windowHeight < SMALL_SCREEN_HEIGHT;

  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const googleWebClientId =
    (extra?.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim() || GOOGLE_FALLBACK.web;
  const googleAndroidClientId =
    (extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim() || GOOGLE_FALLBACK.android;
  const googleIosClientId =
    (extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim() || GOOGLE_FALLBACK.ios;

  const hasGoogleConfig = !!(googleWebClientId || googleAndroidClientId || googleIosClientId);

  useEffect(() => {
    if (googleWebClientId) {
      GoogleSignin.configure({ webClientId: googleWebClientId, offlineAccess: false });
    }
  }, [googleWebClientId]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(FORBIDDEN_MESSAGE_KEY).then((message) => {
      if (message) {
        AsyncStorage.removeItem(FORBIDDEN_MESSAGE_KEY).catch(() => {});
        Alert.alert('Acesso negado', message);
      }
    });
  }, []);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const renderCount = useRef(0);
  renderCount.current += 1;
  if (LOG_RENDER) console.warn('[Login] render #', renderCount.current);

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
      setTimeout(() => nav.replace(router, dest as any), 0);
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      const msg = err?.message || String(error) || 'Email ou senha incorretos.';
      const isNetworkError =
        !err?.status && (msg?.includes('fetch') || msg?.includes('network') || msg?.includes('Network') || msg?.includes('servidor'));
      const title = isNetworkError ? 'Erro de conexão' : 'Erro no login';
      const detail = isNetworkError
        ? `${msg}\n\nSe o problema persistir, aguarde 1 minuto e tente novamente.`
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

  const handleGooglePress = useCallback(async () => {
    if (!hasGoogleConfig || !googleWebClientId?.trim()) {
      if (__DEV__) {
        console.warn('[Login] Google OAuth não configurado.', {
          googleWebClientId, googleAndroidClientId, googleIosClientId,
        });
      }
      Alert.alert(
        'Login com Google indisponível',
        'No momento o login com Google não está disponível neste dispositivo. Tente entrar com email e senha.'
      );
      return;
    }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if ((response as { type?: string })?.type === 'cancelled') return;
      const idToken = (response as { data?: { idToken?: string }; idToken?: string })?.data?.idToken
        ?? (response as { idToken?: string })?.idToken;
      if (!idToken) throw new Error('Google não retornou o ID Token.');
      const user = await signInWithGoogle(idToken);
      const dest = !user.profileComplete
        ? (user.role === 'doctor' ? '/(auth)/complete-doctor' : '/(auth)/complete-profile')
        : user.role === 'doctor'
        ? '/(doctor)/dashboard'
        : '/(patient)/home';
      setTimeout(() => nav.replace(router, dest as any), 0);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (err?.code === statusCodes.IN_PROGRESS) return;
      if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Erro', 'Google Play Services não disponível neste dispositivo.');
        return;
      }
      const msg = err?.message || String(error) || 'Erro ao fazer login com Google.';
      Alert.alert('Erro no login', msg);
    } finally {
      setGoogleLoading(false);
    }
  }, [hasGoogleConfig, googleWebClientId, googleAndroidClientId, googleIosClientId, signInWithGoogle, router]);

  const openWhatsApp = useCallback(() => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const content = (
    <View style={[styles.card, isSmallScreen && styles.cardSmall]}>

      <View style={styles.accentBar} />

      {/* Logo + tagline */}
      <View style={[styles.logoSection, isSmallScreen && styles.logoSectionSmall]}>
        <Logo size="small" variant="dark" compact />
        <Text style={[styles.tagline, isSmallScreen && styles.taglineSmall]}>
          Renove sua receita e pedido de exames.{'\n'}Rápido e sem burocracia.
        </Text>
      </View>

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

      {/* Esqueceu senha — acima do botão */}
      <TouchableOpacity
        onPress={handleForgotPassword}
        style={styles.forgotRow}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
      </TouchableOpacity>

      <AppButton
        title="Entrar"
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        variant="primary"
        fullWidth
        size="lg"
        style={styles.loginButtonWrap}
      />

      {/* Separador OU */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou continue com</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Botões sociais lado a lado */}
      <View style={styles.socialRow}>
        <AppButton
          title="Google"
          onPress={handleGooglePress}
          loading={googleLoading}
          disabled={!hasGoogleConfig || googleLoading}
          variant="outline"
          fullWidth
          icon="logo-google"
          style={styles.socialButton}
        />
        <AppButton
          title="Apple"
          onPress={() => {}}
          disabled
          variant="outline"
          fullWidth
          icon="logo-apple"
          style={styles.socialButton}
        />
      </View>

      {/* Rodapé */}
      <View style={styles.footerSection}>
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Não tem uma conta? </Text>
          <TouchableOpacity onPress={handleRegister} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.registerPill}>
            <Text style={styles.registerLink}>Crie agora</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={openWhatsApp}
          style={styles.whatsappLink}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.whatsappLinkText}>Precisa de ajuda? Fale no WhatsApp</Text>
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
              { paddingBottom: Math.max(60, windowHeight * 0.12) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <FadeIn visible duration={300} fromY={12} fill={false}>
              {content}
            </FadeIn>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(colors: DesignColors, shadows: DesignTokens['shadows']) {
  return StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'center',
  },

  // Card v2: mais generoso, cantos mais arredondados
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    ...shadows.elevated,
  },
  cardSmall: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
  },
  accentBar: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    alignSelf: 'center',
    marginBottom: 12,
  },

  logoSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoSectionSmall: {
    marginBottom: 14,
  },
  tagline: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 21,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  taglineSmall: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
  },

  // Inputs
  inputContainer: {
    marginBottom: 4,
  },
  inputLast: {
    marginBottom: 0,
  },

  // Esqueceu senha — acima do botão, alinhado à direita
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: colors.primary,
  },

  loginButtonWrap: {
    marginTop: 8,
    marginBottom: 4,
  },

  // Separador v2
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: colors.textMuted,
  },

  // Social v2: botões lado a lado
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 48,
    marginBottom: 12,
  },

  // Footer v2: mais espaço
  footerSection: {
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  registerText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.primary,
  },
  registerPill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  whatsappLink: {
    alignSelf: 'center',
  },
  whatsappLinkText: {
    fontSize: 12,
    color: colors.textMuted,
    textDecorationLine: 'underline',
    fontWeight: '400',
  },
  });
}
