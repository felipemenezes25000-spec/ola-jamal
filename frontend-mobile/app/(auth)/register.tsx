import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../lib/theme';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { Logo } from '../../components/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAddressByCep } from '../../lib/viacep';
import { isValidCpf } from '../../lib/validation/cpf';
import { fetchSpecialties, uploadCertificate } from '../../lib/api';

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

/* ────────── Section Header ────────── */
function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={16} color={c.primary.main} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

export default function Register() {
  const router = useRouter();
  const { signUp, signUpDoctor, refreshUser } = useAuth();
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
  const [certFile, setCertFile] = useState<any>(null);
  const [certPassword, setCertPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  useEffect(() => {
    if (role === 'doctor') {
      fetchSpecialties()
        .then(setSpecialtiesList)
        .catch(() => setSpecialtiesList([]));
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
      else if (specialtiesList.length > 0 && !specialtiesList.includes(sp)) {
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
      const str = street.trim();
      const num = number.trim();
      const neigh = neighborhood.trim();
      const comp = complement.trim();
      const ci = city.trim();
      const st = state.trim().toUpperCase().slice(0, 2);
      const postalCode = onlyDigits(cep);
      const bdTrim = birthDate.trim().replace(/\D/g, '');
      const birthDateIso = bdTrim.length === 8
        ? `${bdTrim.slice(4, 8)}-${bdTrim.slice(2, 4)}-${bdTrim.slice(0, 2)}`
        : undefined;
      const data: Record<string, unknown> = {
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
      const user = role === 'doctor'
        ? await signUpDoctor({ ...data, crm: crm.trim().replace(/\D/g, ''), crmState: crmState.trim().toUpperCase().slice(0, 2), specialty: specialty.trim() } as any)
        : await signUp(data as any);

      if (user.role === 'doctor' && certFile && certPassword.trim()) {
        try {
          const upload = await uploadCertificate(certFile.uri, certPassword.trim());
          if (upload?.success) {
            await refreshUser();
            setTimeout(() => router.replace('/(doctor)/dashboard' as any), 0);
            return;
          }
        } catch (uploadErr: any) {
          Alert.alert(
            'Cadastro concluído',
            'Conta criada. O certificado não pôde ser enviado. Você será direcionado para concluir o cadastro.',
            [{ text: 'OK', onPress: () => router.replace('/(auth)/complete-doctor' as any) }]
          );
          return;
        }
      }

      const dest = user.role === 'doctor' ? '/(auth)/complete-doctor' : '/(patient)/home';
      setTimeout(() => router.replace(dest as any), 0);
    } catch (error: any) {
      const msg =
        error?.message ||
        (Array.isArray(error?.errors) ? error.errors[0] : null) ||
        (error?.messages?.[0]) ||
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
          Preencha seus dados para começar a usar o RenoveJá
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
            <Ionicons name="person" size={16} color={role === 'patient' ? '#FFF' : c.text.tertiary} />
          </View>
          <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Paciente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleBtn, role === 'doctor' && styles.roleBtnActive]}
          onPress={() => setRole('doctor')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconWrap, role === 'doctor' && styles.roleIconWrapActive]}>
            <Ionicons name="medical" size={16} color={role === 'doctor' ? '#FFF' : c.text.tertiary} />
          </View>
          <Text style={[styles.roleText, role === 'doctor' && styles.roleTextActive]}>Médico</Text>
        </TouchableOpacity>
      </View>

      {/* ═══ Form Card ═══ */}
      <View style={styles.card}>

        {/* ── Dados pessoais ── */}
        <SectionHeader icon="person-outline" title="Dados pessoais" />
        <AppInput
          label="Nome completo"
          required
          leftIcon="person-outline"
          placeholder="Seu nome completo"
          value={name}
          onChangeText={(t: string) => { setName(t); clearError('name'); }}
          error={fieldErrors.name}
          autoCapitalize="words"
        />
        <AppInput
          label="Email"
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
        />
        <AppInput
          label="CPF"
          required
          leftIcon="card-outline"
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={(t: string) => { setCpf(t); clearError('cpf'); }}
          error={fieldErrors.cpf}
          keyboardType="numeric"
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
        <SectionHeader icon="lock-closed-outline" title="Segurança" />
        <AppInput
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

        {/* ── Endereço (obrigatório para paciente e médico) ── */}
        <>
          <SectionHeader icon="location-outline" title="Endereço" />
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
            onChangeText={(t: string) => { setStreet(t); clearError('street'); }}
            leftIcon="home-outline"
            error={fieldErrors.street}
          />
          <View style={styles.row}>
            <AppInput
              label="Número"
              required
              placeholder="Nº"
              value={number}
              onChangeText={(t: string) => { setNumber(t); clearError('number'); }}
              keyboardType="numeric"
              containerStyle={{ width: 100 }}
              error={fieldErrors.number}
            />
            <AppInput
              label="Complemento"
              placeholder="Apto, bloco..."
              value={complement}
              onChangeText={setComplement}
              containerStyle={styles.flex1}
            />
          </View>
          <AppInput
            label="Bairro"
            required
            placeholder="Bairro"
            value={neighborhood}
            onChangeText={(t: string) => { setNeighborhood(t); clearError('neighborhood'); }}
            leftIcon="business-outline"
            error={fieldErrors.neighborhood}
          />
          <View style={styles.row}>
            <AppInput
              label="Cidade"
              required
              placeholder="Cidade"
              value={city}
              onChangeText={(t: string) => { setCity(t); clearError('city'); }}
              containerStyle={styles.flex1}
              error={fieldErrors.city}
            />
            <AppInput
              label="UF"
              required
              placeholder="UF"
              value={state}
              onChangeText={(t: string) => { setState(t.trim().toUpperCase().slice(0, 2)); clearError('state'); }}
              maxLength={2}
              containerStyle={{ width: 96 }}
              error={fieldErrors.state}
            />
          </View>
        </>

        {/* ── Dados médicos (Médico) ── */}
        {role === 'doctor' && (
          <>
            <SectionHeader icon="medkit-outline" title="Dados profissionais" />
            <View style={styles.row}>
              <AppInput
                label="CRM"
                required
                leftIcon="shield-checkmark-outline"
                placeholder="Nº do CRM"
                value={crm}
                onChangeText={(t: string) => { setCrm(t); clearError('crm'); }}
                error={fieldErrors.crm}
                containerStyle={styles.flex1}
              />
              <AppInput
                label="Estado do CRM"
                required
                leftIcon="location-outline"
                placeholder="SP"
                value={crmState}
                onChangeText={(t: string) => { setCrmState(t); clearError('crmState'); }}
                error={fieldErrors.crmState}
                containerStyle={{ width: 120 }}
              />
            </View>
            {specialtiesList.length > 0 ? (
              <View style={styles.specialtyBlock}>
                <Text style={styles.specialtyLabel}>
                  Especialidade <Text style={{ color: c.status.error }}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.specialtyTrigger,
                    fieldErrors.specialty && styles.specialtyTriggerError,
                  ]}
                  onPress={() => setSpecialtyOpen((o) => !o)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="medkit-outline" size={18} color={c.text.tertiary} style={{ marginRight: 8 }} />
                  <Text
                    style={[
                      styles.specialtyTriggerText,
                      !specialty.trim() && styles.specialtyTriggerPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {specialty.trim() || 'Selecionar especialidade...'}
                  </Text>
                  <Ionicons
                    name={specialtyOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={c.text.tertiary}
                  />
                </TouchableOpacity>
                {specialtyOpen && (
                  <View style={styles.specialtyDropdown}>
                    <View style={styles.specialtySearchWrap}>
                      <Ionicons name="search-outline" size={18} color={c.text.tertiary} />
                      <TextInput
                        style={styles.specialtySearchInput}
                        placeholder="Pesquisar especialidade..."
                        placeholderTextColor={c.text.tertiary}
                        value={specialtySearch}
                        onChangeText={setSpecialtySearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {specialtySearch.length > 0 ? (
                        <TouchableOpacity
                          onPress={() => setSpecialtySearch('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={18} color={c.text.tertiary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <ScrollView
                      style={styles.specialtyOptionsScroll}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                    >
                      {(() => {
                        const filtered = specialtiesList.filter((s) =>
                          s.toLowerCase().includes(specialtySearch.trim().toLowerCase())
                        );
                        if (filtered.length === 0) {
                          return (
                            <View style={styles.specialtyOption}>
                              <Text style={styles.specialtyOptionEmpty}>
                                Nenhuma especialidade encontrada
                              </Text>
                            </View>
                          );
                        }
                        return filtered.map((s) => {
                          const isSelected = specialty.trim() === s;
                          return (
                            <TouchableOpacity
                              key={s}
                              style={[
                                styles.specialtyOption,
                                isSelected && styles.specialtyOptionSelected,
                              ]}
                              onPress={() => {
                                setSpecialty(s);
                                setSpecialtySearch('');
                                setSpecialtyOpen(false);
                                clearError('specialty');
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.specialtyOptionText,
                                  isSelected && styles.specialtyOptionTextSelected,
                                ]}
                                numberOfLines={1}
                              >
                                {s}
                              </Text>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color={c.primary.main} />
                              ) : null}
                            </TouchableOpacity>
                          );
                        });
                      })()}
                    </ScrollView>
                  </View>
                )}
                {fieldErrors.specialty ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.specialty}</Text>
                ) : null}
              </View>
            ) : (
              <AppInput
                label="Especialidade"
                required
                leftIcon="medkit-outline"
                placeholder="Carregando..."
                value={specialty}
                onChangeText={(t: string) => { setSpecialty(t); clearError('specialty'); }}
                error={fieldErrors.specialty}
                editable={false}
              />
            )}

            {/* Certificado digital */}
            <View style={styles.certSection}>
              <View style={styles.certHeader}>
                <View style={styles.certIconWrap}>
                  <Ionicons name="shield-checkmark" size={16} color={c.primary.main} />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.certSectionTitle}>Certificado digital</Text>
                  <Text style={styles.certSectionDesc}>
                    Opcional agora — você pode adicionar depois.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.certFileBtn}
                onPress={async () => {
                  try {
                    const result = await DocumentPicker.getDocumentAsync({
                      type: ['application/x-pkcs12', 'application/octet-stream'],
                      copyToCacheDirectory: true,
                    });
                    if (!result.canceled && result.assets?.[0]) setCertFile(result.assets[0]);
                  } catch {
                    Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
                  }
                }}
                activeOpacity={0.8}
              >
                <View style={styles.certUploadIcon}>
                  <Ionicons
                    name={certFile ? 'document-attach' : 'cloud-upload-outline'}
                    size={22}
                    color={c.primary.main}
                  />
                </View>
                <Text style={styles.certFileBtnText}>
                  {certFile ? certFile.name : 'Selecionar arquivo .PFX'}
                </Text>
              </TouchableOpacity>
              {certFile ? (
                <AppInput
                  label="Senha do certificado"
                  placeholder="Senha do PFX"
                  value={certPassword}
                  onChangeText={setCertPassword}
                  secureTextEntry
                />
              ) : null}
            </View>
          </>
        )}

        {/* ── IA Notice ── */}
        <View style={styles.aiNotice}>
          <View style={styles.aiIconWrap}>
            <Ionicons name="sparkles" size={16} color="#FFF" />
          </View>
          <Text style={styles.aiNoticeText}>
            Utilizamos <Text style={styles.aiBold}>inteligência artificial</Text> para triagem e leitura de receitas e exames, agilizando seu atendimento.
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
              {acceptedTerms ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={styles.termsLabel}>Li e aceito os </Text>
            <TouchableOpacity
              onPress={() => router.push('/terms' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={styles.termsLink}>Termos de Uso</Text>
            </TouchableOpacity>
            <Text style={styles.termsLabel}>.</Text>
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
              {acceptedPrivacy ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
            </View>
            <Text style={styles.termsLabel}>Li e aceito a </Text>
            <TouchableOpacity
              onPress={() => router.push('/privacy' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={styles.termsLink}>Política de Privacidade</Text>
            </TouchableOpacity>
            <Text style={styles.termsLabel}>.</Text>
          </TouchableOpacity>
          {fieldErrors.privacy ? (
            <Text style={styles.fieldErrorText}>{fieldErrors.privacy}</Text>
          ) : null}
        </View>

        {/* ── Submit ── */}
        <AppButton
          title="Criar minha conta"
          onPress={handleRegister}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.submitButton}
        />
      </View>

      {/* ═══ Social Login ═══ */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou cadastre-se com</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
          <Ionicons name="logo-google" size={20} color="#4285F4" />
          <Text style={styles.socialBtnText}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
          <Ionicons name="logo-apple" size={20} color="#000" />
          <Text style={styles.socialBtnText}>Apple</Text>
        </TouchableOpacity>
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
          <Ionicons name="logo-whatsapp" size={15} color={c.secondary.main} />
          <Text style={styles.whatsappText}>Suporte: (11) 98631-8000</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

/* ══════════════════════════════════════════
   Styles
   ══════════════════════════════════════════ */
const CARD_RADIUS = 24;

const styles = StyleSheet.create({
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
    color: c.text.primary,
    textAlign: 'center',
    marginTop: s.md,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: c.text.secondary,
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
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: c.border.main,
  },
  roleBtnActive: {
    backgroundColor: c.primary.main,
    borderColor: c.primary.main,
    ...Platform.select({
      ios: { shadowColor: c.primary.main, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14 },
      android: { elevation: 6 },
      default: { shadowColor: c.primary.main, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14 },
    }),
  },
  roleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: c.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  roleText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text.tertiary,
  },
  roleTextActive: {
    color: '#FFFFFF',
  },

  /* ── Card ── */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    marginBottom: s.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20 },
      android: { elevation: 3 },
      default: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 20 },
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
    backgroundColor: c.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.border.light,
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

  /* ── Divider ── */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s.md,
    paddingHorizontal: s.sm,
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
    fontWeight: '500',
  },

  /* ── Social ── */
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: s.lg,
    paddingHorizontal: s.sm,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: c.border.main,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text.secondary,
  },

  /* ── Footer ── */
  footer: {
    alignItems: 'center',
    paddingBottom: s.lg,
    gap: s.sm,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 15,
    color: c.text.secondary,
  },
  loginLink: {
    fontSize: 15,
    color: c.primary.main,
    fontWeight: '700',
  },
  whatsappRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  whatsappText: {
    fontSize: 13,
    color: c.text.tertiary,
    fontWeight: '500',
  },

  /* ── Specialty ── */
  specialtyBlock: {
    marginBottom: s.md,
  },
  specialtyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text.primary,
    marginBottom: 6,
  },
  specialtyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: c.background.secondary,
    borderWidth: 1.5,
    borderColor: c.border.main,
    minHeight: 52,
  },
  specialtyTriggerError: {
    borderColor: c.status.error,
  },
  specialtyTriggerText: {
    flex: 1,
    fontSize: 15,
    color: c.text.primary,
    marginRight: s.sm,
  },
  specialtyTriggerPlaceholder: {
    color: c.text.tertiary,
  },
  specialtyDropdown: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.border.main,
    backgroundColor: '#FFF',
    maxHeight: 240,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 4 },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    }),
  },
  specialtySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border.light,
    gap: 8,
  },
  specialtySearchInput: {
    flex: 1,
    fontSize: 15,
    color: c.text.primary,
    paddingVertical: 8,
  },
  specialtyOptionsScroll: {
    maxHeight: 190,
  },
  specialtyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border.light,
  },
  specialtyOptionSelected: {
    backgroundColor: c.primary.soft,
  },
  specialtyOptionText: {
    flex: 1,
    fontSize: 15,
    color: c.text.primary,
    marginRight: s.sm,
  },
  specialtyOptionTextSelected: {
    fontWeight: '600',
    color: c.primary.dark,
  },
  specialtyOptionEmpty: {
    fontSize: 14,
    color: c.text.tertiary,
    fontStyle: 'italic',
  },
  fieldErrorText: {
    fontSize: 12,
    color: c.status.error,
    marginTop: 4,
    marginLeft: 4,
  },

  /* ── Certificate ── */
  certSection: {
    marginTop: s.md,
    padding: s.md,
    borderRadius: 16,
    backgroundColor: c.background.secondary,
    gap: 12,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  certIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: c.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  certSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text.primary,
  },
  certSectionDesc: {
    fontSize: 13,
    color: c.text.tertiary,
    lineHeight: 18,
    marginTop: 2,
  },
  certFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: c.primary.light,
    borderStyle: 'dashed',
    backgroundColor: '#FFF',
  },
  certUploadIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certFileBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: c.primary.dark,
  },

  /* ── AI Notice ── */
  aiNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: c.primary.soft,
    padding: 14,
    borderRadius: 14,
    marginTop: s.md,
    marginBottom: 4,
  },
  aiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: c.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  aiNoticeText: {
    flex: 1,
    fontSize: 13,
    color: c.text.secondary,
    lineHeight: 20,
  },
  aiBold: {
    fontWeight: '600',
    color: c.text.primary,
  },

  /* ── Terms ── */
  termsBlock: {
    marginTop: s.md,
    gap: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: c.border.dark,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkboxChecked: {
    backgroundColor: c.primary.main,
    borderColor: c.primary.main,
  },
  termsLabel: {
    fontSize: 14,
    color: c.text.secondary,
  },
  termsLink: {
    fontSize: 14,
    color: c.primary.main,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
