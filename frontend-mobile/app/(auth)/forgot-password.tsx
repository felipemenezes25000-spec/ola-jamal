import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { forgotPassword } = useAuth();
  const router = useRouter();

  const handleSend = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Informe seu e-mail');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[colors.primaryPaler, '#F0F9FF']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
          </TouchableOpacity>

          <View style={styles.formCard}>
            {sent ? (
              <View style={styles.successContainer}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                </View>
                <Text style={styles.title}>E-mail enviado!</Text>
                <Text style={styles.subtitle}>
                  Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
                </Text>
                <Button title="Voltar ao Login" onPress={() => router.replace('/(auth)/login')} fullWidth />
              </View>
            ) : (
              <>
                <View style={styles.iconContainer}>
                  <Ionicons name="key-outline" size={40} color={colors.primary} />
                </View>
                <Text style={styles.title}>Recuperar Senha</Text>
                <Text style={styles.subtitle}>
                  Informe seu e-mail e enviaremos um link para redefinir sua senha.
                </Text>
                <Input
                  label="E-mail"
                  placeholder="seu@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  leftIcon="mail-outline"
                />
                <Button title="Enviar Link" onPress={handleSend} loading={loading} fullWidth />
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  backBtn: { position: 'absolute', top: 0 },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xxl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryPaler,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: { ...typography.h3, color: colors.primaryDark, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.gray500, textAlign: 'center', marginBottom: spacing.lg },
  successContainer: { alignItems: 'center' },
  successIcon: { marginBottom: spacing.md },
});
