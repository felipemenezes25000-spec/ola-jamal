import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { colors, spacing } from '../../lib/theme';

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

export default function CompleteProfileScreen() {
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const { completeProfile, signOut } = useAuth();
  const router = useRouter();

  const handleComplete = async () => {
    const ph = onlyDigits(phone);
    const cp = onlyDigits(cpf);
    if (!ph || !cp) {
      Alert.alert('Atenção', 'Preencha telefone e CPF.');
      return;
    }
    if (ph.length < 10 || ph.length > 11) {
      Alert.alert('Telefone inválido', 'Informe 10 ou 11 dígitos.');
      return;
    }
    if (cp.length !== 11) {
      Alert.alert('CPF inválido', 'O CPF deve ter 11 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const user = await completeProfile({ phone: ph, cpf: cp });
      const dest = user.role === 'doctor' ? '/(doctor)/dashboard' : '/(patient)/home';
      setTimeout(() => router.replace(dest as any), 0);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || String(error) || 'Não foi possível completar o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancelar Cadastro',
      'Deseja cancelar o cadastro? Sua conta será removida.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { apiClient } = require('../../lib/api-client');
              await apiClient.post('/api/auth/cancel-registration', {});
            } catch { /* ignore */ }
            await signOut();
            setTimeout(() => router.replace('/(auth)/login'), 0);
          },
        },
      ]
    );
  };

  return (
    <Screen variant="gradient" scroll contentStyle={styles.content}>
      <Text style={styles.brand}>RenoveJá+</Text>

      <View style={styles.form}>
        <AppInput
          label="Telefone"
          placeholder="(11) 99999-9999"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          leftIcon="call-outline"
        />
        <AppInput
          label="CPF"
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={setCpf}
          keyboardType="numeric"
          leftIcon="card-outline"
        />
        <AppButton
          title="Finalizar Cadastro"
          onPress={handleComplete}
          loading={loading}
          fullWidth
        />
        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar cadastro</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: {
    gap: spacing.sm,
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.error,
  },
});
