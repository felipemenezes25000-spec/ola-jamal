import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { AppCard } from '../components/ui/AppCard';
import { AppInput } from '../components/ui/AppInput';
import { AppButton } from '../components/ui/AppButton';
import { changePassword } from '../lib/api';
import { validate } from '../lib/validation';
import { changePasswordSchema } from '../lib/validation/schemas';
import { spacing } from '../lib/theme';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';

export default function ChangePasswordScreen() {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alterar Senha</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
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
    </SafeAreaView>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primaryDark },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { padding: spacing.lg },
  hint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  errorText: { fontSize: 12, fontWeight: '500', color: colors.error, marginBottom: spacing.md },
  });
}
