import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function RegisterScreen() {
  const [isDoctor, setIsDoctor] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [crm, setCrm] = useState('');
  const [crmState, setCrmState] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signUpDoctor } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password || !phone || !cpf) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }
    if (isDoctor && (!crm || !crmState || !specialty)) {
      Alert.alert('Atenção', 'Preencha os dados profissionais');
      return;
    }

    setLoading(true);
    try {
      if (isDoctor) {
        const user = await signUpDoctor({ name, email, password, phone, cpf, crm, crmState, specialty });
        router.replace('/(doctor)/dashboard');
      } else {
        const user = await signUp({ name, email, password, phone, cpf });
        router.replace('/(patient)/home');
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.primaryPaler, '#F0F9FF']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
            </TouchableOpacity>

            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Preencha seus dados para começar</Text>

            {/* Role toggle */}
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isDoctor && styles.toggleActive]}
                onPress={() => setIsDoctor(false)}
              >
                <Ionicons name="person" size={18} color={!isDoctor ? colors.white : colors.gray500} />
                <Text style={[styles.toggleText, !isDoctor && styles.toggleTextActive]}>Paciente</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isDoctor && styles.toggleActive]}
                onPress={() => setIsDoctor(true)}
              >
                <Ionicons name="medical" size={18} color={isDoctor ? colors.white : colors.gray500} />
                <Text style={[styles.toggleText, isDoctor && styles.toggleTextActive]}>Médico</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <Input label="Nome Completo" placeholder="Seu nome" value={name} onChangeText={setName} leftIcon="person-outline" />
              <Input label="E-mail" placeholder="seu@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" leftIcon="mail-outline" />
              <Input label="Senha" placeholder="Mínimo 6 caracteres" value={password} onChangeText={setPassword} secureTextEntry leftIcon="lock-closed-outline" />
              <Input label="Telefone" placeholder="(11) 99999-9999" value={phone} onChangeText={setPhone} keyboardType="phone-pad" leftIcon="call-outline" />
              <Input label="CPF" placeholder="000.000.000-00" value={cpf} onChangeText={setCpf} keyboardType="numeric" leftIcon="card-outline" />

              {isDoctor && (
                <>
                  <View style={styles.sectionDivider}>
                    <View style={styles.sectionLine} />
                    <Text style={styles.sectionLabel}>Dados Profissionais</Text>
                    <View style={styles.sectionLine} />
                  </View>
                  <Input label="CRM" placeholder="123456" value={crm} onChangeText={setCrm} leftIcon="shield-checkmark-outline" />
                  <Input label="Estado do CRM (UF)" placeholder="SP" value={crmState} onChangeText={setCrmState} autoCapitalize="characters" leftIcon="location-outline" />
                  <Input label="Especialidade" placeholder="Ex: Clínico Geral" value={specialty} onChangeText={setSpecialty} leftIcon="medkit-outline" />
                </>
              )}

              <Button title="Criar Conta" onPress={handleRegister} loading={loading} fullWidth />

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Já tem uma conta? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.loginLink}>Entrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.md },
  backBtn: { marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.primaryDark, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.gray500, marginBottom: spacing.lg },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  toggleText: { ...typography.bodySmallMedium, color: colors.gray500 },
  toggleTextActive: { color: colors.white },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    ...shadows.md,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.md,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: colors.gray200 },
  sectionLabel: { ...typography.caption, color: colors.gray400, marginHorizontal: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  loginText: { ...typography.body, color: colors.gray500 },
  loginLink: { ...typography.bodySemiBold, color: colors.primary },
});
