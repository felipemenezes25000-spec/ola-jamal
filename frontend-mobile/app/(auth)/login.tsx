import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Logo } from '../../components/Logo';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '393882962431-141i571c0527230j11q544rvhm1633af.apps.googleusercontent.com';

// Redirect URI - deve corresponder ao scheme em app.json (renoveja)
// IMPORTANTE: Adicione em Google Cloud Console > Credentials > OAuth 2.0 Client ID > Authorized redirect URIs:
//   - renoveja://auth
//   - com.renoveja.app:/auth (para Android)
const getGoogleRedirectUri = () => {
  const uri = AuthSession.makeRedirectUri({
    scheme: 'renoveja',
    path: 'auth',
    native: 'renoveja://auth',
  });
  // Expo Go gera exp://... que o Google rejeita - use build de desenvolvimento (expo run:android)
  if (uri.startsWith('exp://') || uri.includes('192.168') || uri.includes('localhost')) {
    return 'renoveja://auth';
  }
  return uri || 'renoveja://auth';
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  const redirectUri = React.useMemo(() => getGoogleRedirectUri(), []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    }
  );

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.idToken) {
        handleGoogleLogin(authentication.idToken);
      }
    }
  }, [response]);

  const navigateByRole = (role: 'patient' | 'doctor') => {
    if (role === 'patient') router.replace('/(patient)/home');
    else router.replace('/(doctor)/dashboard');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha todos os campos');
      return;
    }
    setLoading(true);
    try {
      const user = await signIn(email, password);
      navigateByRole(user.role);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (googleToken: string) => {
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle(googleToken);
      navigateByRole(user.role);
    } catch (error: any) {
      if (error.message === 'PROFILE_INCOMPLETE') {
        router.replace('/(auth)/complete-profile');
      } else {
        Alert.alert('Erro', error.message || 'Erro ao fazer login com Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.primaryPaler, '#F0F9FF']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.logoContainer}>
              <View style={styles.logoBg}>
                <Logo size="large" color={colors.primaryDark} />
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.title}>Bem-vindo de volta!</Text>
              <Text style={styles.subtitle}>Entre com sua conta para continuar</Text>

              <Input
                label="E-mail"
                placeholder="seu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />

              <Input
                label="Senha"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                leftIcon="lock-closed-outline"
              />

              <TouchableOpacity
                onPress={() => router.push('/(auth)/forgot-password')}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Esqueci minha senha</Text>
              </TouchableOpacity>

              <Button title="Entrar" onPress={handleLogin} loading={loading} fullWidth />

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.googleBtn}
                onPress={() => promptAsync()}
                disabled={googleLoading || !request}
              >
                <Ionicons name="logo-google" size={20} color={colors.gray700} />
                <Text style={styles.googleText}>
                  {googleLoading ? 'Entrando...' : 'Entrar com Google'}
                </Text>
              </TouchableOpacity>

              <View style={styles.registerRow}>
                <Text style={styles.registerText}>Não tem uma conta? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                  <Text style={styles.registerLink}>Cadastre-se</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoContainer: { alignItems: 'center', marginBottom: spacing.xl },
  logoBg: { alignItems: 'center' },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  title: {
    ...typography.h2,
    color: colors.primaryDark,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  forgotText: { ...typography.bodySmallMedium, color: colors.primary },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.gray200 },
  dividerText: { ...typography.bodySmall, color: colors.gray400, marginHorizontal: spacing.md },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    minHeight: 52,
    marginBottom: spacing.md,
  },
  googleText: { ...typography.bodySemiBold, color: colors.gray700, marginLeft: spacing.sm },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  registerText: { ...typography.body, color: colors.gray500 },
  registerLink: { ...typography.bodySemiBold, color: colors.primary },
});
