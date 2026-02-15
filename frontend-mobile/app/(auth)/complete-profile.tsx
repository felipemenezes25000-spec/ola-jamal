import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function CompleteProfileScreen() {
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, completeProfile } = useAuth();
  const router = useRouter();

  const handleComplete = async () => {
    if (!phone || !cpf) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }
    setLoading(true);
    try {
      await completeProfile({ phone, cpf });
      if (user?.role === 'doctor') {
        router.replace('/(doctor)/dashboard');
      } else {
        router.replace('/(patient)/home');
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message);
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
              // POST /api/auth/cancel-registration
              const { apiClient } = require('../../lib/api-client');
              await apiClient.post('/api/auth/cancel-registration', {});
            } catch {}
            const { signOut } = useAuth();
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.iconBg}>
            <Ionicons name="person-add" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Complete seu Perfil</Text>
          <Text style={styles.subtitle}>
            Precisamos de mais alguns dados para finalizar seu cadastro.
          </Text>
        </View>

        <View style={styles.card}>
          <Input label="Telefone" placeholder="(11) 99999-9999" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="call-outline" />
          <Input label="CPF" placeholder="000.000.000-00" value={cpf} onChangeText={setCpf} keyboardType="numeric" leftIcon="card-outline" />
          <Button title="Finalizar Cadastro" onPress={handleComplete} loading={loading} fullWidth />
          <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancelar cadastro</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  iconBg: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primaryPaler,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.primaryDark, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.gray500, textAlign: 'center', maxWidth: 280 },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.xxl, padding: spacing.lg, ...shadows.md },
  cancelBtn: { alignItems: 'center', marginTop: spacing.lg },
  cancelText: { ...typography.bodySmallMedium, color: colors.error },
});
