import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader, AppCard, AppInput, AppButton } from '../components/ui';
import { changePassword } from '../lib/api';
import { validate } from '../lib/validation';
import { changePasswordSchema } from '../lib/validation/schemas';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { useRequireAuth } from '../hooks/useRequireAuth';

export default function ChangePasswordScreen() {
  useRequireAuth();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    const result = validate(changePasswordSchema, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!result.success) {
      setError(result.firstError ?? 'Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      await changePassword(result.data!.currentPassword, result.data!.newPassword);
      Alert.alert('Sucesso', 'Senha alterada com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message || String(e) || 'Erro ao alterar senha. Verifique a senha atual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Alterar Senha" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.card}>
          <Text style={styles.hint}>Para sua segurança, informe a senha atual e defina uma nova senha com no mínimo 8 caracteres.</Text>
          <AppInput
            label="Senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Digite sua senha atual"
            leftIcon="lock-closed-outline"
          />
          <AppInput
            label="Nova senha"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Digite a nova senha"
            leftIcon="key-outline"
          />
          <AppInput
            label="Confirmar nova senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Repita a nova senha"
            leftIcon="key-outline"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <AppButton title="Alterar Senha" onPress={handleSubmit} loading={loading} fullWidth />
        </AppCard>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
      paddingBottom: uiTokens.sectionGap * 3,
    },
    card: { padding: uiTokens.spacing.lg },
    hint: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      marginBottom: uiTokens.spacing.lg,
      lineHeight: 20,
    },
    errorText: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: colors.error,
      marginBottom: uiTokens.spacing.md,
    },
  });
}
