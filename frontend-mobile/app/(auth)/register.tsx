import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { spacing } from '../../lib/designSystem';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { Logo } from '../../components/Logo';
import { useAuth, type SignUpData, type DoctorSignUpData } from '../../contexts/AuthContext';
import { fetchAddressByCep } from '../../lib/viacep';
import { isValidCpf } from '../../lib/validation/cpf';
import { fetchSpecialties, uploadCertificate } from '../../lib/api';
import { SPECIALTIES_FALLBACK } from '../../lib/constants/specialties';
import { RegisterAddressFields } from '../../components/register/RegisterAddressFields';
import { RegisterDoctorForm } from '../../components/register/RegisterDoctorForm';
import { showToast } from '../../components/ui/Toast';

const s = spacing;

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
  const { signUp, signUpDoctor, refreshUser } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
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
  const [specialtiesList, setSpecialtiesList] = useState<string[]>([]);
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [certFile, setCertFile] = useState<{ uri: string; name: string } | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [professionalCep, setProfessionalCep] = useState('');
  const [professionalStreet, setProfessionalStreet] = useState('');
  const [professionalNumber, setProfessionalNumber] = useState('');
  const [professionalNeighborhood, setProfessionalNeighborhood] = useState('');
  const [professionalComplement, setProfessionalComplement] = useState('');
  const [professionalCity, setProfessionalCity] = useState('');
  const [professionalState, setProfessionalState] = useState('');
  const [professionalPhone, setProfessionalPhone] = useState('');
  const [university, setUniversity] = useState('');
  const [courses, setCourses] = useState('');
  const [hospitalsServices, setHospitalsServices] = useState('');

  // Lista exibida: API se disponível, senão fallback (evita "Carregando..." eterno se API falhar ou atrasar).
  const specialtiesDisplayList =
    role === 'doctor'
      ? (specialtiesList.length > 0 ? specialtiesList : SPECIALTIES_FALLBACK)
      : [];

  useEffect(() => {
    if (role === 'doctor') {
      setSpecialtiesList(SPECIALTIES_FALLBACK);
      fetchSpecialties()
        .then((list) => list?.length > 0 && setSpecialtiesList(list))
        .catch((err) => {
          if (__DEV__) {
            console.warn('[Register] fetchSpecialties falhou, usando lista local:', (err as Error)?.message ?? err);
          }
        });
    }
  }, [role]);

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      Alert.alert('CEP', msg || 'Não foi possível buscar o CEP.');
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
      }).catch(() => {
        showToast({ message: 'Não foi possível buscar o CEP', type: 'error' });
      });
    }
  };

  const lookupProfessionalCep = useCallback(async () => {
    const digits = onlyDigits(professionalCep);
    if (digits.length !== 8) return;
    try {
      const result = await fetchAddressByCep(digits);
      setProfessionalStreet((prev) => result.street || prev);
      setProfessionalNeighborhood((prev) => result.neighborhood || prev);
      setProfessionalCity((prev) => result.city || prev);
      setProfessionalState((prev) => result.state || prev);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
      Alert.alert('CEP profissional', msg || 'Não foi possível buscar o CEP.');
    }
  }, [professionalCep]);

  const handleProfessionalCepChange = (text: string) => {
    setProfessionalCep(formatCep(text));
    const d = onlyDigits(text);
    if (d.length === 8) {
      fetchAddressByCep(d).then((result) => {
        setProfessionalStreet((prev) => result.street || prev);
        setProfessionalNeighborhood((prev) => result.neighborhood || prev);
        setProfessionalCity((prev) => result.city || prev);
        setProfessionalState((prev) => result.state || prev);
      }).catch(() => {
        showToast({ message: 'Não foi possível buscar o CEP', type: 'error' });
      });
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

    const bd = birthDate.trim();
    if (!bd) err.birthDate = 'Data de nascimento é obrigatória.';
    else {
      const ddmmyy = bd.replace(/\D/g, '');
      if (ddmmyy.length !== 8) err.birthDate = 'Informe a data no formato DD/MM/AAAA.';
      else {
        const d = parseInt(ddmmyy.slice(0, 2), 10);
        const m = parseInt(ddmmyy.slice(2, 4), 10) - 1;
        const y = parseInt(ddmmyy.slice(4, 8), 10);
        const date = new Date(y, m, d);
        if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) err.birthDate = 'Data de nascimento inválida.';
        else if (date.getTime() > Date.now()) err.birthDate = 'Data não pode ser no futuro.';
      }
    }

    if (role === 'doctor') {
      const cr = crm.trim().replace(/\D/g, '');
      const cs = crmState.trim().toUpperCase().slice(0, 2);
      const sp = specialty.trim();
      if (!cr) err.crm = 'CRM é obrigatório.';
      else if (cr.length < 4 || cr.length > 7) err.crm = 'CRM deve ter de 4 a 7 dígitos.';
      if (!cs) err.crmState = 'Estado do CRM é obrigatório.';
      else if (cs.length !== 2) err.crmState = 'Informe 2 letras (ex.: SP).';
      if (!sp) err.specialty = 'Especialidade é obrigatória.';
      else if (specialtiesDisplayList.length > 0 && !specialtiesDisplayList.includes(sp)) {
        err.specialty = 'Selecione uma especialidade da lista.';
      }
    }

    // Endereço obrigatório para paciente e médico
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

    if (!acceptedTerms) {
      err.terms = 'Aceite os Termos de Uso para continuar.';
    }
    if (!acceptedPrivacy) {
      err.privacy = 'Aceite a Política de Privacidade para continuar.';
    }

    if (Object.keys(err).length > 0) {
      setFieldErrors(err);
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const comp = complement.trim();
      const postalCode = onlyDigits(cep);
      const bdTrim = birthDate.trim().replace(/\D/g, '');
      const birthDateIso = bdTrim.length === 8
        ? `${bdTrim.slice(4, 8)}-${bdTrim.slice(2, 4)}-${bdTrim.slice(0, 2)}`
        : undefined;
      const baseData: SignUpData = {
        name: n,
        email: e,
        password: p,
        confirmPassword: pc,
        phone: ph,
        cpf: cp,
        birthDate: birthDateIso,
        street: str,
        number: num,
        neighborhood: neigh,
        complement: comp,
        city: ci,
        state: st,
        ...(postalCode.length === 8 ? { postalCode } : {}),
      };
      const result = role === 'doctor'
        ? await signUpDoctor({
            ...baseData,
            crm: crm.trim().replace(/\D/g, ''),
            crmState: crmState.trim().toUpperCase().slice(0, 2),
            specialty: specialty.trim(),
            professionalPostalCode: onlyDigits(professionalCep).length === 8 ? onlyDigits(professionalCep) : undefined,
            professionalStreet: professionalStreet.trim() || undefined,
            professionalNumber: professionalNumber.trim() || undefined,
            professionalNeighborhood: professionalNeighborhood.trim() || undefined,
            professionalComplement: professionalComplement.trim() || undefined,
            professionalCity: professionalCity.trim() || undefined,
            professionalState: professionalState.trim().toUpperCase().slice(0, 2) || undefined,
            professionalPhone: professionalPhone.trim() || undefined,
            university: university.trim() || undefined,
            courses: courses.trim() || undefined,
            hospitalsServices: hospitalsServices.trim() || undefined,
          } as DoctorSignUpData)
        : { user: await signUp(baseData), requiresApproval: false };

      const user = result.user;

      if (role === 'doctor' && result.requiresApproval) {
        Alert.alert(
          'Cadastro realizado',
          'Aguarde a aprovação do administrador para acessar o app. Você receberá retorno em breve.',
          [{ text: 'OK', onPress: () => nav.replace(router, '/(auth)/login') }]
        );
        return;
      }

      if (user.role === 'doctor' && certFile && certPassword.trim()) {
        try {
          const upload = await uploadCertificate(certFile.uri, certPassword.trim());
          if (upload?.success) {
            await refreshUser();
            setTimeout(() => nav.replace(router, '/(doctor)/dashboard'), 0);
            return;
          }
        } catch {
          Alert.alert(
            'Cadastro concluído',
            'Conta criada. O certificado não pôde ser enviado. Você será direcionado para concluir o cadastro.',
            [{ text: 'OK', onPress: () => nav.replace(router, '/(auth)/complete-doctor') }]
          );
          return;
        }
      }

      const dest = (user.role === 'doctor' ? '/(auth)/complete-doctor' : '/(patient)/home') as import('../../lib/navigation').AppRoute;
      setTimeout(() => nav.replace(router, dest), 0);
    } catch (error: unknown) {
      const err = error as { message?: string; errors?: string[]; messages?: string[] };
      const msg =
        err?.message ||
        (Array.isArray(err?.errors) ? err.errors[0] : null) ||
        err?.messages?.[0] ||
        String(error) ||
        'Não foi possível criar a conta.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen variant="gradient" scroll>
      {/* ═══ Header ═══ */}
      <View style={styles.header}>
        <Logo size="medium" variant="dark" compact />
        <Text style={styles.title}>Crie sua conta</Text>
        <Text style={styles.subtitle}>
          Preencha seus dados para começar a usar o RenoveJá+
        </Text>
      </View>

      {/* ═══ Role Toggle ═══ */}
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'patient' && styles.roleBtnActive]}
          onPress={() => setRole('patient')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconWrap, role === 'patient' && styles.roleIconWrapActive]}>
            <Ionicons name="person" size={16} color={role === 'patient' ? colors.white : colors.textMuted} />
          </View>
          <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Paciente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'doctor' && styles.roleBtnActive]}
          onPress={() => setRole('doctor')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconWrap, role === 'doctor' && styles.roleIconWrapActive]}>
            <Ionicons name="medical" size={16} color={role === 'doctor' ? colors.white : colors.textMuted} />
          </View>
          <Text style={[styles.roleText, role === 'doctor' && styles.roleTextActive]}>Médico</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Form Card ═══ */}
      <View style={styles.card}>

        {/* ── Dados pessoais ── */}
        <SectionHeader icon="person-outline" title={role === 'patient' ? 'Dados para atendimento' : 'Dados pessoais'} variant="form" />
        <AppInput
          testID="register-name-input"
          label="Nome completo"
          required
          leftIcon="person-outline"
          placeholder="Ex.: Maria Silva Santos"
          value={name}
          onChangeText={(t: string) => { setName(t); clearError('name'); }}
          error={fieldErrors.name}
          autoCapitalize="words"
        />
        <AppInput
          testID="register-email-input"
          label="E-mail"
          required
          leftIcon="mail-outline"
          placeholder="seu@email.com"
          value={email}
          onChangeText={(t: string) => { setEmail(t); clearError('email'); }}
          error={fieldErrors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AppInput
          label="Telefone"
          required
          leftIcon="call-outline"
          placeholder="(11) 99999-9999"
          value={phone}
          onChangeText={(t: string) => { setPhone(t); clearError('phone'); }}
          error={fieldErrors.phone}
          keyboardType="phone-pad"
          hint="Para contato e notificações"
        />
        <AppInput
          testID="register-cpf-input"
          label="CPF"
          required
          leftIcon="card-outline"
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={(t: string) => { setCpf(t); clearError('cpf'); }}
          error={fieldErrors.cpf}
          keyboardType="numeric"
          hint="Obrigatório para receitas e pedidos de exame"
        />
        <AppInput
          label="Data de nascimento"
          required
          leftIcon="calendar-outline"
          placeholder="DD/MM/AAAA"
          value={birthDate}
          onChangeText={(t: string) => {
            const d = t.replace(/\D/g, '').slice(0, 8);
            if (d.length <= 2) setBirthDate(d);
            else if (d.length <= 4) setBirthDate(`${d.slice(0, 2)}/${d.slice(2)}`);
            else setBirthDate(`${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`);
            clearError('birthDate');
          }}
          error={fieldErrors.birthDate}
          keyboardType="numeric"
          hint="Usada nas receitas médicas"
        />

        {/* ── Segurança ── */}
        <SectionHeader icon="lock-closed-outline" title="Segurança" variant="form" />
        <AppInput
          testID="register-password-input"
          label="Senha"
          required
          leftIcon="lock-closed-outline"
          placeholder="Mín. 8 caracteres"
          value={password}
          onChangeText={(t: string) => { setPassword(t); clearError('password'); }}
          error={fieldErrors.password}
          hint="Maiúscula, minúscula, número e especial"
          secureTextEntry
        />
        <AppInput
          label="Confirmar senha"
          required
          leftIcon="lock-closed-outline"
          placeholder="Repita a senha"
          value={confirmPassword}
          onChangeText={(t: string) => { setConfirmPassword(t); clearError('confirmPassword'); }}
          error={fieldErrors.confirmPassword}
          secureTextEntry
        />

        {/* ── Endereço pessoal (obrigatório para paciente e médico) ── */}
        <RegisterAddressFields
          title={role === 'doctor' ? 'Endereço pessoal' : 'Endereço'}
          cep={cep}
          onCepChange={handleCepChange}
          onCepBlur={lookupCep}
          street={street}
          onStreetChange={(t) => { setStreet(t); clearError('street'); }}
          number={number}
          onNumberChange={(t) => { setNumber(t); clearError('number'); }}
          neighborhood={neighborhood}
          onNeighborhoodChange={(t) => { setNeighborhood(t); clearError('neighborhood'); }}
          complement={complement}
          onComplementChange={setComplement}
          city={city}
          onCityChange={(t) => { setCity(t); clearError('city'); }}
          state={state}
          onStateChange={(t) => { setState(t.trim().toUpperCase().slice(0, 2)); clearError('state'); }}
          fieldErrors={fieldErrors}
          clearError={clearError}
          required
          colors={colors}
        />

        {/* ── Dados médicos (Médico) ── */}
        {role === 'doctor' && (
          <RegisterDoctorForm
            crm={crm}
            setCrm={setCrm}
            crmState={crmState}
            setCrmState={setCrmState}
            specialty={specialty}
            setSpecialty={setSpecialty}
            specialtyOpen={specialtyOpen}
            setSpecialtyOpen={setSpecialtyOpen}
            specialtySearch={specialtySearch}
            setSpecialtySearch={setSpecialtySearch}
            specialtiesDisplayList={specialtiesDisplayList}
            professionalCep={professionalCep}
            setProfessionalCep={setProfessionalCep}
            handleProfessionalCepChange={handleProfessionalCepChange}
            lookupProfessionalCep={lookupProfessionalCep}
            professionalStreet={professionalStreet}
            setProfessionalStreet={setProfessionalStreet}
            professionalNumber={professionalNumber}
            setProfessionalNumber={setProfessionalNumber}
            professionalNeighborhood={professionalNeighborhood}
            setProfessionalNeighborhood={setProfessionalNeighborhood}
            professionalComplement={professionalComplement}
            setProfessionalComplement={setProfessionalComplement}
            professionalCity={professionalCity}
            setProfessionalCity={setProfessionalCity}
            professionalState={professionalState}
            setProfessionalState={setProfessionalState}
            professionalPhone={professionalPhone}
            setProfessionalPhone={setProfessionalPhone}
            university={university}
            setUniversity={setUniversity}
            courses={courses}
            setCourses={setCourses}
            hospitalsServices={hospitalsServices}
            setHospitalsServices={setHospitalsServices}
            certFile={certFile}
            setCertFile={setCertFile}
            certPassword={certPassword}
            setCertPassword={setCertPassword}
            fieldErrors={fieldErrors}
            clearError={clearError}
            colors={colors}
          />
        )}

        {/* ── IA Notice ── */}
        <View style={styles.aiNotice}>
          <View style={styles.aiIconWrap}>
            <Ionicons name="sparkles" size={16} color={colors.white} />
          </View>
          <Text style={styles.aiNoticeText}>
            O RenoveJá+ utiliza <Text style={styles.aiBold}>inteligência artificial</Text> para triagem, leitura de receitas e exames, e apoio às consultas — sempre sob supervisão médica. Conforme nossos Termos de Uso e Política de Privacidade.
          </Text>
        </View>

        {/* ── Termos ── */}
        <View style={styles.termsBlock}>
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => { setAcceptedTerms((v) => !v); clearError('terms'); }}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
            </View>
            <Text style={styles.termsLabel} numberOfLines={0}>
              Li e aceito os{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/terms')}>
                Termos de Uso da RenoveJá Saúde
              </Text>
              .
            </Text>
          </TouchableOpacity>
          {fieldErrors.terms ? (
            <Text style={styles.fieldErrorText}>{fieldErrors.terms}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => { setAcceptedPrivacy((v) => !v); clearError('privacy'); }}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
              {acceptedPrivacy ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
            </View>
            <Text style={styles.termsLabel} numberOfLines={0}>
              Li e aceito a{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/privacy')}>
                Política de Privacidade da RenoveJá Saúde
              </Text>
              .
            </Text>
          </TouchableOpacity>
          {fieldErrors.privacy ? (
            <Text style={styles.fieldErrorText}>{fieldErrors.privacy}</Text>
          ) : null}
        </View>

        {/* ── Submit ── */}
        <AppButton
          testID="register-button"
          title="Criar minha conta"
          onPress={handleRegister}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.submitButton}
        />
      </View>

      {/* ═══ Footer ═══ */}
      <View style={styles.footer}>
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Já tem conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.whatsappRow} activeOpacity={0.7}>
          <Ionicons name="logo-whatsapp" size={15} color={colors.secondary} />
          <Text style={styles.whatsappText}>Suporte RenoveJá: (11) 98631-8000</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

/* ══════════════════════════════════════════
   Styles
   ══════════════════════════════════════════ */
const CARD_RADIUS = 24;

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  /* ── Header ── */
  header: {
    alignItems: 'center',
    paddingTop: s.lg,
    paddingBottom: s.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.text,
    textAlign: 'center',
    marginTop: s.md,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: s.xs,
    lineHeight: 22,
    paddingHorizontal: s.md,
  },

  /* ── Role Toggle ── */
  roleContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: s.lg,
    paddingHorizontal: 2,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  roleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14 },
      android: { elevation: 6 },
      default: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14 },
    }),
  },
  roleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  roleText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  roleTextActive: {
    color: colors.white,
  },

  /* ── Card ── */
  card: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    marginBottom: s.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20 },
      android: { elevation: 3 },
      default: { shadowColor: colors.text, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20 },
    }),
  },

  /* ── Section Header ── */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 8,
    gap: 8,
  },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 4,
  },

  /* ── Layout Helpers ── */
  row: {
    flexDirection: 'row',
    gap: s.sm,
  },
  flex1: {
    flex: 1,
  },

  /* ── Submit ── */
  submitButton: {
    marginTop: s.md,
  },

  /* ── Footer ── */
  footer: {
    alignItems: 'center',
    paddingTop: s.md,
    paddingBottom: s.lg,
    gap: s.sm,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  whatsappText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },

  fieldErrorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },

  /* ── AI Notice ── */
  aiNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primarySoft,
    padding: 14,
    borderRadius: 14,
    marginTop: s.md,
    marginBottom: 4,
  },
  aiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  aiNoticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  aiBold: {
    fontWeight: '600',
    color: colors.text,
  },

  /* ── Terms ── */
  termsBlock: {
    marginTop: s.md,
    gap: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    minWidth: 22,
    borderRadius: 6,
    borderWidth: 2.5,
    borderColor: colors.border,
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  termsLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  });
}
