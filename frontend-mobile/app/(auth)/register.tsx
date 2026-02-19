import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAddressByCep } from '../../lib/viacep';
import { isValidCpf } from '../../lib/validation/cpf';

const c = theme.colors;
const s = theme.spacing;
const t = theme.typography;

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function formatCep(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function Register() {
  const router = useRouter();
  const { signUp, signUpDoctor } = useAuth();
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [crm, setCrm] = useState('');
  const [crmState, setCrmState] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const lookupCep = useCallback(async () => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    try {
      const result = await fetchAddressByCep(digits);
      setStreet((prev) => result.street || prev);
      setNeighborhood((prev) => result.neighborhood || prev);
      setCity((prev) => result.city || prev);
      setState((prev) => result.state || prev);
    } catch (e: any) {
      Alert.alert('CEP', e?.message || 'Não foi possível buscar o CEP.');
    }
  }, [cep]);

  const handleCepChange = (text: string) => {
    setCep(formatCep(text));
    const d = onlyDigits(text);
    if (d.length === 8) {
      fetchAddressByCep(d).then((result) => {
        setStreet((prev) => result.street || prev);
        setNeighborhood((prev) => result.neighborhood || prev);
        setCity((prev) => result.city || prev);
        setState((prev) => result.state || prev);
      }).catch(() => {});
    }
  };

  const handleRegister = async () => {
    const n = name.trim();
    const e = email.trim().toLowerCase();
    const p = password.trim();
    const pc = confirmPassword.trim();
    const ph = onlyDigits(phone);
    const cp = onlyDigits(cpf);
    const err: Record<string, string> = {};

    if (!n) err.name = 'Nome é obrigatório.';
    else if (/\d/.test(n)) err.name = 'O nome não deve conter números.';
    else if (n.split(/\s+/).filter(Boolean).length < 2) err.name = 'Informe nome e sobrenome.';

    if (!e) err.email = 'E-mail é obrigatório.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) err.email = 'Informe um e-mail válido.';

    if (!p) err.password = 'Senha é obrigatória.';
    else if (p.length < 8) err.password = 'A senha deve ter pelo menos 8 caracteres.';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/.test(p)) {
      err.password = 'Use letra maiúscula, minúscula, número e caractere especial.';
    }

    if (!pc) err.confirmPassword = 'Confirme a senha.';
    else if (p !== pc) err.confirmPassword = 'As senhas não coincidem.';

    if (!ph) err.phone = 'Telefone é obrigatório.';
    else if (ph.length < 10 || ph.length > 11) err.phone = 'Informe 10 ou 11 dígitos.';

    if (!cp) err.cpf = 'CPF é obrigatório.';
    else if (cp.length !== 11) err.cpf = 'O CPF deve ter 11 dígitos.';
    else if (!isValidCpf(cp)) err.cpf = 'CPF inválido. Verifique os dígitos.';

    if (role === 'doctor') {
      const cr = crm.trim().replace(/\D/g, '');
      const cs = crmState.trim().toUpperCase().slice(0, 2);
      const sp = specialty.trim();
      if (!cr) err.crm = 'CRM é obrigatório.';
      else if (cr.length < 4 || cr.length > 7) err.crm = 'CRM deve ter de 4 a 7 dígitos.';
      if (!cs) err.crmState = 'Estado do CRM é obrigatório.';
      else if (cs.length !== 2) err.crmState = 'Informe 2 letras (ex.: SP).';
      if (!sp) err.specialty = 'Especialidade é obrigatória.';
    }

    if (role === 'patient') {
      const str = street.trim();
      const num = number.trim();
      const neigh = neighborhood.trim();
      const ci = city.trim();
      const st = state.trim().toUpperCase();
      if (!str) err.street = 'Rua é obrigatória.';
      if (!num) err.number = 'Número é obrigatório.';
      if (!neigh) err.neighborhood = 'Bairro é obrigatório.';
      if (!ci) err.city = 'Cidade é obrigatória.';
      if (!st) err.state = 'UF é obrigatória.';
      else if (st.length !== 2) err.state = 'Informe a sigla com 2 letras.';
    }

    if (Object.keys(err).length > 0) {
      setFieldErrors(err);
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        name: n,
        email: e,
        password: p,
        confirmPassword: pc,
        phone: ph,
        cpf: cp,
      };
      if (role === 'patient') {
        const str = street.trim();
        const num = number.trim();
        const neigh = neighborhood.trim();
        const comp = complement.trim();
        const ci = city.trim();
        const st = state.trim().toUpperCase().slice(0, 2);
        const postalCode = onlyDigits(cep);
        if (str) data.street = str;
        if (num) data.number = num;
        if (neigh) data.neighborhood = neigh;
        if (comp) data.complement = comp;
        if (ci) data.city = ci;
        if (st) data.state = st;
        if (postalCode.length === 8) data.postalCode = postalCode;
      }
      const user = role === 'doctor'
        ? await signUpDoctor({ ...data, crm: crm.trim().replace(/\D/g, ''), crmState: crmState.trim().toUpperCase().slice(0, 2), specialty: specialty.trim() } as any)
        : await signUp(data as any);

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
        <Logo size="medium" />
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
          required
          leftIcon="person-outline"
          placeholder="Seu nome completo"
          value={name}
          onChangeText={(t) => { setName(t); clearError('name'); }}
          error={fieldErrors.name}
          autoCapitalize="words"
        />
        <AppInput
          label="Email"
          required
          leftIcon="mail-outline"
          placeholder="seu@email.com"
          value={email}
          onChangeText={(t) => { setEmail(t); clearError('email'); }}
          error={fieldErrors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AppInput
          label="Senha"
          required
          leftIcon="lock-closed-outline"
          placeholder="Mín. 8 caracteres, 1 maiúscula, 1 número e 1 especial"
          value={password}
          onChangeText={(t) => { setPassword(t); clearError('password'); }}
          error={fieldErrors.password}
          secureTextEntry
        />
        <AppInput
          label="Confirmar senha"
          required
          leftIcon="lock-closed-outline"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
          error={fieldErrors.confirmPassword}
          secureTextEntry
        />
        <AppInput
          label="Telefone"
          required
          leftIcon="call-outline"
          placeholder="(11) 99999-9999"
          value={phone}
          onChangeText={(t) => { setPhone(t); clearError('phone'); }}
          error={fieldErrors.phone}
          keyboardType="phone-pad"
        />
        <AppInput
          label="CPF"
          required
          leftIcon="card-outline"
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={(t) => { setCpf(t); clearError('cpf'); }}
          error={fieldErrors.cpf}
          keyboardType="numeric"
        />

        {role === 'patient' && (
          <>
            <AppInput
              label="CEP"
              placeholder="00000-000"
              value={cep}
              onChangeText={handleCepChange}
              onBlur={lookupCep}
              keyboardType="numeric"
              leftIcon="location-outline"
            />
            <AppInput
              label="Rua"
              required
              placeholder="Nome da rua"
              value={street}
              onChangeText={(t) => { setStreet(t); clearError('street'); }}
              leftIcon="home-outline"
              error={fieldErrors.street}
            />
            <View style={styles.addressRow}>
              <AppInput
                label="Número"
                required
                placeholder="Nº"
                value={number}
                onChangeText={(t) => { setNumber(t); clearError('number'); }}
                keyboardType="numeric"
                containerStyle={styles.numberInput}
                error={fieldErrors.number}
              />
              <AppInput
                label="Complemento"
                placeholder="Apto, bloco..."
                value={complement}
                onChangeText={setComplement}
                containerStyle={styles.complementInput}
              />
            </View>
            <AppInput
              label="Bairro"
              required
              placeholder="Bairro"
              value={neighborhood}
              onChangeText={(t) => { setNeighborhood(t); clearError('neighborhood'); }}
              leftIcon="business-outline"
              error={fieldErrors.neighborhood}
            />
            <View style={styles.addressRow}>
              <AppInput
                label="Cidade"
                required
                placeholder="Cidade"
                value={city}
                onChangeText={(t) => { setCity(t); clearError('city'); }}
                containerStyle={styles.cityInput}
                error={fieldErrors.city}
              />
              <AppInput
                label="UF"
                required
                placeholder="UF"
                value={state}
                onChangeText={(t) => { setState(t.trim().toUpperCase().slice(0, 2)); clearError('state'); }}
                maxLength={2}
                containerStyle={styles.stateInput}
                error={fieldErrors.state}
              />
            </View>
          </>
        )}

        {role === 'doctor' && (
          <>
            <AppInput
              label="CRM"
              required
              leftIcon="shield-checkmark-outline"
              placeholder="Número do CRM (4 a 7 dígitos)"
              value={crm}
              onChangeText={(t) => { setCrm(t); clearError('crm'); }}
              error={fieldErrors.crm}
            />
            <AppInput
              label="Estado do CRM"
              required
              leftIcon="location-outline"
              placeholder="SP"
              value={crmState}
              onChangeText={(t) => { setCrmState(t); clearError('crmState'); }}
              error={fieldErrors.crmState}
            />
            <AppInput
              label="Especialidade"
              required
              leftIcon="medkit-outline"
              placeholder="Sua especialidade"
              value={specialty}
              onChangeText={(t) => { setSpecialty(t); clearError('specialty'); }}
              error={fieldErrors.specialty}
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
  addressRow: {
    flexDirection: 'row',
    gap: s.sm,
  },
  numberInput: {
    width: 100,
  },
  complementInput: {
    flex: 1,
  },
  cityInput: {
    flex: 1,
  },
  stateInput: {
    width: 80,
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
