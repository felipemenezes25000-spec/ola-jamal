import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { useAuth } from '../../contexts/AuthContext';

const c = theme.colors;
const s = theme.spacing;
const t = theme.typography;

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

export default function Register() {
  const router = useRouter();
  const { signUp, signUpDoctor } = useAuth();
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
    const n = name.trim();
    const e = email.trim().toLowerCase();
    const p = password.trim();
    const ph = onlyDigits(phone);
    const cp = onlyDigits(cpf);
    if (!n || !e || !p || !ph || !cp) {
      Alert.alert('Campos obrigatórios', 'Preencha todos os campos.');
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
    if (p.length < 8) {
      Alert.alert('Senha curta', 'A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (n.split(/\s+/).filter(Boolean).length < 2) {
      Alert.alert('Nome incompleto', 'Informe nome e sobrenome.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      Alert.alert('Email inválido', 'Informe um email válido.');
      return;
    }
    if (role === 'doctor') {
      const cr = crm.trim();
      const cs = crmState.trim().toUpperCase().slice(0, 2);
      const sp = specialty.trim();
      if (!cr || !cs || !sp) {
        Alert.alert('Campos obrigatórios', 'Preencha CRM, estado e especialidade.');
        return;
      }
      if (cs.length !== 2) {
        Alert.alert('Estado inválido', 'O estado do CRM deve ter 2 letras (ex: SP).');
        return;
      }
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const data = {
        name: n,
        email: e,
        password: p,
        phone: ph,
        cpf: cp,
      };
      const user = role === 'doctor'
        ? await signUpDoctor({ ...data, crm: crm.trim(), crmState: crmState.trim().toUpperCase().slice(0, 2), specialty: specialty.trim() })
        : await signUp(data);

      const dest = user.role === 'doctor' ? '/(doctor)/dashboard' : '/(patient)/home';
      setTimeout(() => router.replace(dest as any), 0);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || String(error) || 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen variant="gradient" scroll>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Title & Subtitle */}
      <Text style={styles.title}>Vamos começar!</Text>
      <Text style={styles.subtitle}>
        preencha os dados abaixo para começar o cadastro.
      </Text>

      {/* Role Toggle */}
      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'patient' && styles.roleBtnActive]}
          onPress={() => setRole('patient')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="person"
            size={18}
            color={role === 'patient' ? '#FFFFFF' : c.text.tertiary}
          />
          <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>
            Paciente
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'doctor' && styles.roleBtnActive]}
          onPress={() => setRole('doctor')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="medical"
            size={18}
            color={role === 'doctor' ? '#FFFFFF' : c.text.tertiary}
          />
          <Text style={[styles.roleText, role === 'doctor' && styles.roleTextActive]}>
            Médico
          </Text>
        </TouchableOpacity>
      </View>

      {/* Form Fields */}
      <View style={styles.form}>
        <AppInput
          label="Nome completo"
          leftIcon="person-outline"
          placeholder="Seu nome completo"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <AppInput
          label="Email"
          leftIcon="mail-outline"
          placeholder="seu@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AppInput
          label="Senha"
          leftIcon="lock-closed-outline"
          placeholder="Crie uma senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <AppInput
          label="Telefone"
          leftIcon="call-outline"
          placeholder="(11) 99999-9999"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <AppInput
          label="CPF"
          leftIcon="card-outline"
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={setCpf}
          keyboardType="numeric"
        />

        {role === 'doctor' && (
          <>
            <AppInput
              label="CRM"
              leftIcon="shield-checkmark-outline"
              placeholder="Número do CRM"
              value={crm}
              onChangeText={setCrm}
            />
            <AppInput
              label="Estado do CRM"
              leftIcon="location-outline"
              placeholder="SP"
              value={crmState}
              onChangeText={setCrmState}
            />
            <AppInput
              label="Especialidade"
              leftIcon="medkit-outline"
              placeholder="Sua especialidade"
              value={specialty}
              onChangeText={setSpecialty}
            />
          </>
        )}

        {/* Submit Button */}
        <AppButton
          title="Cadastrar"
          onPress={handleRegister}
          loading={loading}
          fullWidth
          style={styles.submitButton}
        />
      </View>

      {/* Social Login */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou entre com</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialCircle} activeOpacity={0.7}>
          <Ionicons name="logo-google" size={22} color={c.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialCircle} activeOpacity={0.7}>
          <Ionicons name="logo-apple" size={22} color={c.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Login Link */}
      <View style={styles.loginRow}>
        <Text style={styles.loginText}>Já tem conta? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.loginLink}>Entrar</Text>
        </TouchableOpacity>
      </View>

      {/* WhatsApp Contact */}
      <View style={styles.whatsappRow}>
        <Ionicons name="logo-whatsapp" size={16} color={c.secondary.main} />
        <Text style={styles.whatsappText}>Whatsapp: (11) 98631-8000</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: 'center',
    marginTop: s.lg,
    marginBottom: s.md,
  },
  logo: {
    width: 160,
    height: 80,
  },
  title: {
    fontSize: t.variants.h1.fontSize,
    fontWeight: t.variants.h1.fontWeight as '700',
    letterSpacing: t.variants.h1.letterSpacing,
    color: c.text.primary,
    textAlign: 'center',
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: t.variants.body2.fontSize,
    fontWeight: t.variants.body2.fontWeight as '400',
    color: c.text.secondary,
    textAlign: 'center',
    marginBottom: s.lg,
  },
  roleRow: {
    flexDirection: 'row',
    gap: s.sm,
    marginBottom: s.lg,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    height: 48,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: c.background.paper,
    borderWidth: 1.5,
    borderColor: c.border.main,
  },
  roleBtnActive: {
    backgroundColor: c.primary.main,
    borderColor: c.primary.main,
  },
  roleText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text.tertiary,
  },
  roleTextActive: {
    color: '#FFFFFF',
  },
  form: {
    marginBottom: s.md,
  },
  submitButton: {
    marginTop: s.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.border.main,
  },
  dividerText: {
    fontSize: 13,
    color: c.text.tertiary,
    marginHorizontal: s.md,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s.lg,
    marginBottom: s.lg,
  },
  socialCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.background.paper,
    borderWidth: 1.5,
    borderColor: c.border.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: s.md,
  },
  loginText: {
    fontSize: 14,
    color: c.text.secondary,
  },
  loginLink: {
    fontSize: 14,
    color: c.primary.main,
    fontWeight: '600',
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.xs,
    marginBottom: s.lg,
  },
  whatsappText: {
    fontSize: 13,
    color: c.text.tertiary,
    fontWeight: '500',
  },
});
