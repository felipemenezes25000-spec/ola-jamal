import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';
import { useAuth } from '../../contexts/AuthContext';
import { theme, colors, spacing } from '../../lib/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { forgotPassword } = useAuth();
  const router = useRouter();

  const handleSend = async () => {
    const e = (email || '').trim().toLowerCase();
    if (!e) {
      Alert.alert('Atenção', 'Informe seu e-mail.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      Alert.alert('Email inválido', 'Informe um email válido.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(e);
      setSent(true);
    } catch (error: unknown) {
      Alert.alert('Erro', (error as Error)?.message || String(error) || 'Não foi possível enviar o e-mail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen variant="gradient" scroll={false} contentStyle={styles.screenContent}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.cardWrapper}>
        <AppCard variant="elevated" style={styles.card}>
          {sent ? (
            <View style={styles.centerContent}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={36} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>E-mail enviado!</Text>
              <Text style={styles.subtitle}>
                Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
              </Text>
              <AppButton
                title="Voltar ao Login"
                onPress={() => router.replace('/(auth)/login')}
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.centerContent}>
              <Text style={styles.brandTitle}>RenoveJá+</Text>
              <Text style={styles.subtitle}>
                escreva seu email abaixo para recuperar seu acesso!
              </Text>
              <AppInput
                label="Email Address"
                placeholder="seu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail-outline"
              />
              <AppButton
                title="Recuperar acesso"
                onPress={handleSend}
                loading={loading}
                fullWidth
              />
            </View>
          )}
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: 'flex-start',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  card: {
    padding: spacing.lg,
  },
  centerContent: {
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: theme.typography.variants.h1.fontSize,
    lineHeight: theme.typography.variants.h1.lineHeight,
    fontWeight: theme.typography.variants.h1.fontWeight,
    color: theme.colors.primary.main,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: theme.typography.variants.h2.fontSize,
    lineHeight: theme.typography.variants.h2.lineHeight,
    fontWeight: theme.typography.variants.h2.fontWeight,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.variants.body2.fontSize,
    lineHeight: theme.typography.variants.body2.lineHeight,
    fontWeight: theme.typography.variants.body2.fontWeight,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
});
