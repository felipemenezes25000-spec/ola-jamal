import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '../components/Logo';
import { Loading } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

export default function SplashScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        if (user) {
          if (user.role === 'patient') {
            router.replace('/(patient)/home');
          } else {
            router.replace('/(doctor)/dashboard');
          }
        } else {
          router.replace('/(auth)/login');
        }
      }, 1500);
    }
  }, [user, loading]);

  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDarker]}
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
