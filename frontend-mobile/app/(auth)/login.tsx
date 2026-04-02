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
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { useColorSchemeContext } from '../../contexts/ColorSchemeContext';
import type { DesignColors, DesignTokens } from '../../lib/designSystem';
import { AppInput } from '../../components/ui';
import { FadeIn } from '../../components/ui/FadeIn';
import { Logo } from '../../components/Logo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, FORBIDDEN_MESSAGE_KEY } from '../../contexts/AuthContext';
import { validate } from '../../lib/validation';
import { loginSchema } from '../../lib/validation/schemas';
import { COMPANY } from '../../lib/company';

const SMALL_SCREEN_HEIGHT = 700;

export default function Login() {
  const router = useRouter();
  const { signIn, signInWithGoogle } = useAuth();
  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const { colors, shadows } = useAppTheme();
  const { isDark } = useColorSchemeContext();
  const styles = useMemo(() => makeStyles(colors, shadows, isDark), [colors, shadows, isDark]);

  const { height: windowHeight } = useWindowDimensions();
  const isSmallScreen = windowHeight < SMALL_SCREEN_HEIGHT;

  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const googleWebClientId =
    (extra?.googleWebClientId || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
  const googleAndroidClientId =
    (extra?.googleAndroidClientId || process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
  const googleIosClientId =
    (extra?.googleIosClientId || process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();

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
      const user = await signIn(result.data.email, result.data.password);
      const dest = !user.profileComplete
        ? (user.role === 'doctor' ? '/(auth)/complete-doctor' : '/(auth)/complete-profile')
        : user.role === 'doctor'
        ? '/(doctor)/dashboard'
        : user.role === 'admin'
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
        : user.role === 'admin'
        ? '/(doctor)/dashboard'
        : '/(patient)/home';
      setTimeout(() => nav.replace(router, dest as any), 0);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (err?.code === statusCodes.IN_PROGRESS) {
        return;
      }
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
    Linking.openURL(COMPANY.whatsapp).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(40, windowHeight * 0.08) },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <FadeIn visible duration={300} fromY={12} fill={false}>
              {/* Branding */}
              <View style={[styles.brandSection, isSmallScreen && styles.brandSectionSmall]}>
                <Logo size={isSmallScreen ? 'small' : 'medium'} variant="dark" compact />
                <Text style={[styles.brandTagline, isSmallScreen && styles.brandTaglineSmall]}>
                  Renove sua receita e pedido de exames.{'\n'}Rápido e sem burocracia.
                </Text>
              </View>

              {/* Form Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Entrar na sua conta</Text>

                {/* Email Input */}
                <AppInput
                  testID="login-email-input"
                  label="E-mail"
                  leftIcon="mail-outline"
                  placeholder="seu@email.com"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={focusPassword}
                  editable={!loading}
                  error={errors.email}
                  containerStyle={styles.inputSpacing}
                />

                {/* Password Input */}
                <AppInput
                  ref={passwordRef}
                  testID="login-password-input"
                  label="Senha"
                  leftIcon="lock-closed-outline"
                  placeholder="Sua senha"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={handleLogin}
                  editable={!loading}
                  error={errors.password}
                  containerStyle={styles.inputSpacingLast}
                />

                {/* Forgot Password */}
                <TouchableOpacity
                  testID="forgot-password-link"
                  onPress={handleForgotPassword}
                  style={styles.forgotRow}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotText}>Esqueci minha senha</Text>
                </TouchableOpacity>

                {/* Login Button */}
                <TouchableOpacity
                  testID="login-button"
                  style={[styles.primaryButton, (loading || googleLoading) && styles.primaryButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading || googleLoading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <Text style={styles.primaryButtonText}>Entrando...</Text>
                  ) : (
                    <Text style={styles.primaryButtonText}>Entrar</Text>
                  )}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>ou</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign-In */}
                <TouchableOpacity
                  style={[styles.googleButton, (!hasGoogleConfig || loading || googleLoading) && styles.googleButtonDisabled]}
                  onPress={handleGooglePress}
                  disabled={!hasGoogleConfig || loading || googleLoading}
                  activeOpacity={0.7}
                >
                  <Ionicons name="logo-google" size={18} color={hasGoogleConfig ? '#4285F4' : colors.textMuted} />
                  <Text style={[styles.googleButtonText, !hasGoogleConfig && styles.googleButtonTextDisabled]}>
                    {googleLoading ? 'Conectando...' : 'Continuar com Google'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Footer */}
              <View style={styles.footerSection}>
                <View style={styles.registerRow}>
                  <Text style={styles.registerText}>Não tem uma conta? </Text>
                  <TouchableOpacity
                    testID="register-link"
                    onPress={handleRegister}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.registerLink}>Cadastre-se</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={openWhatsApp}
                  style={styles.whatsappLink}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="logo-whatsapp" size={14} color={colors.textMuted} style={styles.whatsappIcon} />
                  <Text style={styles.whatsappLinkText}>Precisa de ajuda? Fale no WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </FadeIn>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(colors: DesignColors, shadows: DesignTokens['shadows'], isDark: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: { flex: 1 },
    keyboardView: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 16,
      justifyContent: 'center',
    },

    /* Branding */
    brandSection: {
      alignItems: 'center',
      marginBottom: 28,
    },
    brandSectionSmall: {
      marginBottom: 18,
    },
    brandTagline: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '400',
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      fontFamily: 'PlusJakartaSans_400Regular',
    },
    brandTaglineSmall: {
      fontSize: 13,
      marginTop: 6,
      lineHeight: 19,
    },

    /* Card */
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 28,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        android: { elevation: 4 },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
      }),
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 20,
      fontFamily: 'PlusJakartaSans_700Bold',
    },

    /* Inputs */
    inputSpacing: {
      marginBottom: 6,
    },
    inputSpacingLast: {
      marginBottom: 2,
    },

    /* Forgot password */
    forgotRow: {
      alignSelf: 'flex-end',
      marginTop: 4,
      marginBottom: 16,
    },
    forgotText: {
      fontSize: 13,
      fontWeight: '600',
      fontFamily: 'PlusJakartaSans_600SemiBold',
      color: colors.primary,
    },

    /* Primary Button */
    primaryButton: {
      backgroundColor: colors.primary,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        android: { elevation: 4 },
        default: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
      }),
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      fontFamily: 'PlusJakartaSans_700Bold',
      letterSpacing: 0.3,
    },

    /* Divider */
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
      gap: 14,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.borderLight,
    },
    dividerText: {
      fontSize: 13,
      fontWeight: '500',
      fontFamily: 'PlusJakartaSans_500Medium',
      color: colors.textMuted,
    },

    /* Google Button */
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 10,
    },
    googleButtonDisabled: {
      opacity: 0.5,
    },
    googleButtonText: {
      fontSize: 15,
      fontWeight: '600',
      fontFamily: 'PlusJakartaSans_600SemiBold',
      color: colors.text,
    },
    googleButtonTextDisabled: {
      color: colors.textMuted,
    },

    /* Footer */
    footerSection: {
      marginTop: 28,
      alignItems: 'center',
      gap: 14,
    },
    registerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    registerText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontFamily: 'PlusJakartaSans_400Regular',
    },
    registerLink: {
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'PlusJakartaSans_700Bold',
      color: colors.primary,
    },
    whatsappLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    whatsappIcon: {
      marginTop: 1,
    },
    whatsappLinkText: {
      fontSize: 12,
      color: colors.textMuted,
      textDecorationLine: 'underline',
      fontWeight: '400',
    },
  });
}
