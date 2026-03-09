import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { useColorSchemeContext } from '../../contexts/ColorSchemeContext';
import type { DesignColors } from '../../lib/designSystem';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { forgotPassword } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { isDark } = useColorSchemeContext();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const AUTH_GRADIENT: [string, string, ...string[]] = isDark
    ? [colors.background, colors.surfaceSecondary, colors.primaryDark]
    : [theme.colors.background.secondary, theme.colors.accent.soft, theme.colors.accent.main];

  const handleSend = async () => {
    const e = (email || '').trim().toLowerCase();
    if (!e) {
      Alert.alert('Atenção', 'Informe seu e-mail.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      Alert.alert('Email inválido', 'Informe um email válido.');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(e);
      setSent(true);
    } catch (error: unknown) {
      Alert.alert('Erro', (error as Error)?.message || String(error) || 'Não foi possível enviar o e-mail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={AUTH_GRADIENT}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.card}>
              {sent ? (
                <View style={styles.centerContent}>
                  <View style={styles.successCircle}>
                    <Ionicons name="checkmark" size={36} color={colors.white} />
                  </View>
                  <Text style={styles.title}>E-mail enviado!</Text>
                  <Text style={styles.subtitle}>
                    Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.
                  </Text>
                  <AppButton
                    title="Voltar ao Login"
                    onPress={() => router.replace('/(auth)/login')}
                    fullWidth
                    style={styles.btnWrap}
                  />
                </View>
              ) : (
                <View style={styles.centerContent}>
                  <View style={styles.logoSection}>
                    <Logo size="small" variant="dark" compact />
                  </View>
                  <Text style={styles.instruction}>
                    Digite seu e-mail cadastrado para receber o link de recuperação de senha.
                  </Text>
                  <AppInput
                    label="E-mail"
                    placeholder="seu@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    leftIcon="mail-outline"
                    containerStyle={styles.inputWrap}
                  />
                  <AppButton
                    title="Recuperar acesso"
                    onPress={handleSend}
                    loading={loading}
                    fullWidth
                    style={styles.btnWrap}
                  />
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1 },
    keyboardView: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 40,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
      ...theme.shadows.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 24,
      ...theme.shadows.card,
    },
    centerContent: {
      alignItems: 'center',
    },
    logoSection: {
      marginBottom: 16,
    },
    instruction: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 20,
    },
    inputWrap: {
      marginBottom: 8,
      alignSelf: 'stretch',
    },
    btnWrap: {
      marginTop: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    successCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
  });
}
