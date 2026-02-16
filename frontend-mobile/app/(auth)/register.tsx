import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, borderRadius } from '../../lib/theme';
import { apiClient } from '../../lib/api-client';
import { AuthResponseDto } from '../../types/database';

export default function Register() {
  const router = useRouter();
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [crm, setCrm] = useState('');
  const [crmState, setCrmState] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !phone.trim() || !cpf.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos.');
      return;
    }
    if (role === 'doctor' && (!crm.trim() || !crmState.trim() || !specialty.trim())) {
      Alert.alert('Campos obrigatórios', 'Preencha CRM, estado e especialidade.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = role === 'doctor' ? '/api/auth/register-doctor' : '/api/auth/register';
      const body: any = { name: name.trim(), email: email.trim().toLowerCase(), password, phone: phone.trim(), cpf: cpf.trim() };
      if (role === 'doctor') { body.crm = crm.trim(); body.crmState = crmState.trim(); body.specialty = specialty.trim(); }

      const response = await apiClient.post<AuthResponseDto>(endpoint, body);
      await AsyncStorage.setItem('@renoveja:auth_token', response.token);
      await AsyncStorage.setItem('@renoveja:user', JSON.stringify(response.user));
      if (response.doctorProfile) await AsyncStorage.setItem('@renoveja:doctor_profile', JSON.stringify(response.doctorProfile));

      if (response.user.role === 'doctor') router.replace('/(doctor)/dashboard');
      else router.replace('/(patient)/home');
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Criar Conta</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Role Toggle */}
        <View style={styles.roleRow}>
          <TouchableOpacity style={[styles.roleBtn, role === 'patient' && styles.roleBtnActive]} onPress={() => setRole('patient')}>
            <Ionicons name="person" size={20} color={role === 'patient' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Paciente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roleBtn, role === 'doctor' && styles.roleBtnActive]} onPress={() => setRole('doctor')}>
            <Ionicons name="medical" size={20} color={role === 'doctor' ? '#fff' : colors.textSecondary} />
            <Text style={[styles.roleText, role === 'doctor' && styles.roleTextActive]}>Médico</Text>
          </TouchableOpacity>
        </View>

        <Field label="Nome completo" value={name} onChangeText={setName} icon="person-outline" />
        <Field label="Email" value={email} onChangeText={setEmail} icon="mail-outline" keyboard="email-address" />
        <Field label="Senha" value={password} onChangeText={setPassword} icon="lock-closed-outline" secure />
        <Field label="Telefone" value={phone} onChangeText={setPhone} icon="call-outline" keyboard="phone-pad" />
        <Field label="CPF" value={cpf} onChangeText={setCpf} icon="card-outline" keyboard="numeric" />

        {role === 'doctor' && (
          <>
            <Field label="CRM" value={crm} onChangeText={setCrm} icon="shield-checkmark-outline" />
            <Field label="Estado do CRM" value={crmState} onChangeText={setCrmState} icon="location-outline" placeholder="SP" />
            <Field label="Especialidade" value={specialty} onChangeText={setSpecialty} icon="medkit-outline" />
          </>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Cadastrar</Text>}
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Já tem conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, icon, secure, keyboard, placeholder }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          keyboardType={keyboard}
          autoCapitalize={secure || keyboard === 'email-address' ? 'none' : 'words'}
          placeholder={placeholder || label}
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  roleRow: { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  roleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  roleTextActive: { color: '#fff' },
  fieldContainer: { marginHorizontal: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 50, borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  submitBtn: {
    backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.md, marginTop: spacing.lg,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  loginText: { fontSize: 14, color: colors.textSecondary },
  loginLink: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});
