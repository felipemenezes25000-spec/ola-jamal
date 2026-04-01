import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../components/Logo';
import { Loading } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../lib/ui/useAppTheme';
import { isOnboardingDone } from '../lib/onboarding';

// Se após esse tempo ainda estiver na splash, força ir para login (evita tela travada)
const SPLASH_MAX_MS = 4000;
const NAVIGATION_DELAY_MS = 100;

export default function SplashScreen() {
  const { user, loading } = useAuth();
  const { gradients } = useAppTheme();
  const router = useRouter();
  const hasNavigated = useRef(false);

  // FIX #1 + #27: Unificação da lógica de navegação — elimina race condition entre
  // os dois useEffects anteriores e remove dead code (delay ternário redundante).
  // O timeout de segurança (SPLASH_MAX_MS) agora é parte do mesmo effect.
  useEffect(() => {
    // Guarda: se já navegou, não faz nada
    const navigate = (route: string) => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      router.replace(route as any);
    };

    // Plano B: timeout de segurança — se após SPLASH_MAX_MS nada acontecer, força login
    const fallbackTimer = setTimeout(() => {
      navigate('/(auth)/login');
    }, SPLASH_MAX_MS);

    if (!loading) {
      const navTimer = setTimeout(async () => {
        if (hasNavigated.current) return;
        if (user) {
          if (user.role === 'patient') {
            navigate('/(patient)/home');
          } else if (user.role === 'doctor' && !user.profileComplete) {
            navigate('/(auth)/complete-doctor');
          } else {
            navigate('/(doctor)/dashboard');
          }
        } else {
          // Primeiro acesso: mostrar onboarding para pacientes
          const done = await isOnboardingDone();
          navigate(done ? '/(auth)/login' : '/onboarding');
        }
      }, NAVIGATION_DELAY_MS);

      return () => {
        clearTimeout(navTimer);
        clearTimeout(fallbackTimer);
      };
    }

    return () => clearTimeout(fallbackTimer);
  }, [user, loading, router]);

  return (
    <LinearGradient
      colors={gradients.splash as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <Logo size="large" />
      </View>
      <View style={styles.loadingContainer}>
        <Loading />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 40,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
  },
});
