import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../components/Logo';
import { Loading } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import { gradients } from '../lib/theme';

// Se após esse tempo ainda estiver na splash, força ir para login (evita tela travada)
const SPLASH_MAX_MS = 4000;

export default function SplashScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!loading) {
      const delay = user ? 400 : 100;
      const t = setTimeout(() => {
        if (hasNavigated.current) return;
        hasNavigated.current = true;
        if (user) {
          if (user.role === 'patient') {
            router.replace('/(patient)/home');
          } else if (user.role === 'doctor' && !user.profileComplete) {
            router.replace('/(auth)/complete-doctor');
          } else {
            router.replace('/(doctor)/dashboard');
          }
        } else {
          router.replace('/(auth)/login');
        }
      }, delay);
      return () => clearTimeout(t);
    }
  }, [user, loading]);

  // Plano B: se após SPLASH_MAX_MS ainda estiver na splash, força login (evita tela travada)
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      router.replace('/(auth)/login');
    }, SPLASH_MAX_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <LinearGradient
      colors={gradients.splash as any}
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
