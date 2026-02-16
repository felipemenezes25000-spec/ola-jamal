import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { apiClient } from '../../lib/api-client';
import { AuthResponseDto } from '../../types/database';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha email e senha.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<AuthResponseDto>('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      await AsyncStorage.setItem('@renoveja:auth_token', response.token);
      await AsyncStorage.setItem('@renoveja:user', JSON.stringify(response.user));
      if (response.doctorProfile) {
        await AsyncStorage.setItem('@renoveja:doctor_profile', JSON.stringify(response.doctorProfile));
      }

      if (!response.profileComplete) {
        router.replace('/(auth)/complete-profile');
      } else if (response.user.role === 'doctor') {
        router.replace('/(doctor)/dashboard');
      } else {
        router.replace('/(patient)/home');
      }
    } catch (error: any) {
      Alert.alert('Erro no login', error?.message || 'Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Logo Section */}
        <LinearGradient colors={['#0EA5E9', '#38BDF8']} style={styles.logoSection}>
          <Ionicons name="medical" size={48} color="#fff" />
          <Text style={styles.logoText}>RenoveJá+</Text>
          <Text style={styles.logoSub}>Telemedicina simplificada</Text>
        </LinearGradient>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Entrar</Text>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Sua senha"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Entrar</Text>}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  logoSection: {
    paddingTop: 80, paddingBottom: 40, alignItems: 'center',
    borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl,
  },
  logoText: { fontSize: 32, fontWeight: '700', color: '#fff', marginTop: spacing.sm },
  logoSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  form: { padding: spacing.lg, flex: 1 },
  formTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 50,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
  forgotText: { fontSize: 13, color: colors.primary, fontWeight: '600', textAlign: 'right', marginTop: spacing.sm },
  loginButton: {
    backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
  },
  loginButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  registerText: { fontSize: 14, color: colors.textSecondary },
  registerLink: { fontSize: 14, color: colors.primary, fontWeight: '600' },
});
