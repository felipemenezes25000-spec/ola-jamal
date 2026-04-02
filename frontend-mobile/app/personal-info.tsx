import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader, AppCard, AppInput, AppButton } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { useRequireAuth } from '../hooks/useRequireAuth';

export default function PersonalInfoScreen() {
  useRequireAuth();
  const router = useRouter();
  const { user, completeProfile, refreshUser } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const cpf = user?.cpf ?? '';
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasChanges =
    name !== (user?.name ?? '') ||
    phone !== (user?.phone ?? '') ||
    birthDate !== (user?.birthDate ?? '');

  const handleSave = async () => {
    if (!hasChanges) return;
    setError('');
    setLoading(true);
    try {
      await completeProfile({ phone: phone || undefined, birthDate: birthDate || undefined });
      await refreshUser();
      Alert.alert('Sucesso', 'Dados atualizados com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Informações Pessoais" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.card}>
          <AppInput
            label="Nome completo"
            value={name}
            onChangeText={setName}
            editable={false}
            placeholder="Seu nome"
            leftIcon="person-outline"
          />
          <AppInput
            label="E-mail"
            value={user?.email ?? ''}
            editable={false}
            placeholder="Seu e-mail"
            leftIcon="mail-outline"
          />
          <AppInput
            label="CPF"
            value={cpf}
            editable={false}
            placeholder="000.000.000-00"
            leftIcon="card-outline"
          />
          <AppInput
            label="Telefone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="(00) 00000-0000"
            leftIcon="call-outline"
            editable={!loading}
          />
          <AppInput
            label="Data de nascimento"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="AAAA-MM-DD"
            leftIcon="calendar-outline"
            editable={!loading}
          />
          <Text style={styles.hint}>
            Nome, e-mail e CPF não podem ser alterados. Caso precise, entre em contato com o suporte.
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {hasChanges && (
            <AppButton title="Salvar alterações" onPress={handleSave} loading={loading} fullWidth />
          )}
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
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      marginBottom: uiTokens.spacing.md,
      lineHeight: 18,
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
