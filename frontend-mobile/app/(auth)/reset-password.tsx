import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { AppCard } from '../../components/ui/AppCard';
import { useAuth } from '../../contexts/AuthContext';
import { validate } from '../../lib/validation';
import { resetPasswordSchema } from '../../lib/validation/schemas';
import { theme, colors, spacing } from '../../lib/theme';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const actualToken = Array.isArray(token) ? token[0] : token;
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!actualToken?.trim()) {
      Alert.alert(
        'Link inválido',
        'O link de redefinição de senha está incompleto ou expirou. Solicite uma nova recuperação de senha.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/forgot-password') }]
      );
    }
  }, [actualToken, router]);

  const handleSubmit = async () => {
    setError('');
    if (!actualToken?.trim()) return;
    const result = validate(resetPasswordSchema, { newPassword, confirmPassword });
    if (!result.success) {
      setError(result.firstError ?? 'Preencha os campos corretamente.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(actualToken, result.data!.newPassword);
      Alert.alert(
        'Senha alterada!',
        'Sua senha foi redefinida com sucesso. Faça login com a nova senha.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err: unknown) {
      const msg = (err as Error)?.message || String(err) || 'Não foi possível redefinir a senha. O link pode ter expirado.';
      setError(msg);
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!actualToken?.trim()) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <Ionicons name="link-outline" size={64} color={colors.textMuted} />
          <Text style={styles.errorText}>Aguardando link válido...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant="gradient" scroll>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
      </TouchableOpacity>

      <View style={styles.cardWrapper}>
        <AppCard variant="elevated" style={styles.card}>
          <View style={styles.centerContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="key" size={32} color={colors.primary} />
            </View>
            <Text style={styles.title}>Nova senha</Text>
            <Text style={styles.subtitle}>
              Defina uma nova senha com pelo menos 8 caracteres.
            </Text>

            <AppInput
              label="Nova senha"
              placeholder="Mínimo 8 caracteres"
              value={newPassword}
              onChangeText={(t: string) => { setNewPassword(t); setError(''); }}
              secureTextEntry
              leftIcon="lock-closed-outline"
            />
            <AppInput
              label="Confirmar senha"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChangeText={(t: string) => { setConfirmPassword(t); setError(''); }}
              secureTextEntry
              leftIcon="lock-closed-outline"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title="Redefinir senha"
              onPress={handleSubmit}
              loading={loading}
              fullWidth
            />
          </View>
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  cardWrapper: {
    flex: 1,
    paddingBottom: spacing.xxl,
  },
  card: {
    padding: spacing.lg,
  },
  centerContent: {
    alignItems: 'stretch',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: theme.typography.variants.h2.fontSize,
    fontWeight: theme.typography.variants.h2.fontWeight,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.variants.body2.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
