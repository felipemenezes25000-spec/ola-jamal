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
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Logo size="medium" />
      </View>

      {/* Title & Subtitle */}
      <Text style={styles.title}>Vamos começar!</Text>
      <Text style={styles.subtitle}>
        Escolha se você é Paciente ou Médico, preencha os dados abaixo e toque em Cadastrar no final.
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
          label="Senha"
          required
          leftIcon="lock-closed-outline"
          placeholder="Mín. 8 caracteres, 1 maiúscula, 1 número e 1 especial"
          value={password}
          onChangeText={(t: string) => { setPassword(t); clearError('password'); }}
          error={fieldErrors.password}
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
              onChangeText={(t: string) => { setStreet(t); clearError('street'); }}
              leftIcon="home-outline"
              error={fieldErrors.street}
            />
            <View style={styles.addressRow}>
              <AppInput
                label="Número"
                required
                placeholder="Nº"
                value={number}
                onChangeText={(t: string) => { setNumber(t); clearError('number'); }}
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
              onChangeText={(t: string) => { setNeighborhood(t); clearError('neighborhood'); }}
              leftIcon="business-outline"
              error={fieldErrors.neighborhood}
            />
            <View style={styles.addressRow}>
              <AppInput
                label="Cidade"
                required
                placeholder="Cidade"
                value={city}
                onChangeText={(t: string) => { setCity(t); clearError('city'); }}
                containerStyle={styles.cityInput}
                error={fieldErrors.city}
              />
              <AppInput
                label="UF"
                required
                placeholder="UF"
                value={state}
                onChangeText={(t: string) => { setState(t.trim().toUpperCase().slice(0, 2)); clearError('state'); }}
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
              onChangeText={(t: string) => { setCrm(t); clearError('crm'); }}
              error={fieldErrors.crm}
            />
            <AppInput
              label="Estado do CRM"
              required
              leftIcon="location-outline"
              placeholder="SP"
              value={crmState}
              onChangeText={(t: string) => { setCrmState(t); clearError('crmState'); }}
              error={fieldErrors.crmState}
            />
            {specialtiesList.length > 0 ? (
              <View style={styles.specialtyBlock}>
                <Text style={styles.specialtyLabel}>Especialidade *</Text>
                <TouchableOpacity
                  style={[
                    styles.specialtyTrigger,
                    fieldErrors.specialty && styles.specialtyTriggerError,
                  ]}
                  onPress={() => setSpecialtyOpen((o) => !o)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.specialtyTriggerText,
                      !specialty.trim() && styles.specialtyTriggerPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {specialty.trim() || 'Buscar ou selecionar especialidade...'}
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
                      <Ionicons name="search-outline" size={20} color={c.text.tertiary} />
                      <TextInput
                        style={styles.specialtySearchInput}
                        placeholder="Pesquisar pelo nome"
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
                          <Ionicons name="close-circle" size={20} color={c.text.tertiary} />
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
                                <Ionicons name="checkmark" size={20} color={c.primary.main} />
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

            {/* Certificado digital (opcional na tela; sem preencher vai para complete-doctor) */}
            <View style={styles.certSection}>
              <Text style={styles.certSectionTitle}>Certificado digital</Text>
              <Text style={styles.certSectionDesc}>
                Adicione aqui para concluir o cadastro de uma vez. Se não tiver agora, você poderá
                cadastrar na próxima tela.
              </Text>
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
                <Ionicons
                  name={certFile ? 'document-attach' : 'cloud-upload-outline'}
                  size={24}
                  color={c.primary.main}
                />
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

        {/* Uso de IA - destaque para o paciente e demais */}
        <View style={styles.aiNotice}>
          <Ionicons name="sparkles" size={20} color={c.primary.main} />
          <Text style={styles.aiNoticeText}>
            Utilizamos inteligência artificial para triagem e leitura de receitas e exames, agilizando seu atendimento.
          </Text>
        </View>

        {/* Checkbox Termos de Uso */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => { setAcceptedTerms((v) => !v); clearError('terms'); }}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms ? (
              <Ionicons name="checkmark" size={18} color="#fff" />
            ) : null}
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

        {/* Checkbox Política de Privacidade */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => { setAcceptedPrivacy((v) => !v); clearError('privacy'); }}
          activeOpacity={0.8}
        >
          <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
            {acceptedPrivacy ? (
              <Ionicons name="checkmark" size={18} color="#fff" />
            ) : null}
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
    height: 52,
    borderRadius: 26,
    backgroundColor: c.background.paper,
    borderWidth: 2,
    borderColor: c.border.main,
  },
  roleBtnActive: {
    backgroundColor: c.primary.main,
    borderColor: c.primary.main,
    shadowColor: c.primary.main,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
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
  specialtyBlock: {
    marginBottom: s.md,
  },
  specialtyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text.primary,
    marginBottom: s.xs,
  },
  specialtyTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.md,
    backgroundColor: c.background.paper,
    borderWidth: 1.5,
    borderColor: c.border.main,
    minHeight: 52,
  },
  specialtyTriggerError: {
    borderColor: c.status.error,
  },
  specialtyTriggerText: {
    flex: 1,
    fontSize: 16,
    color: c.text.primary,
    marginRight: s.sm,
  },
  specialtyTriggerPlaceholder: {
    color: c.text.tertiary,
  },
  specialtyDropdown: {
    marginTop: 4,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: c.border.main,
    backgroundColor: c.background.paper,
    maxHeight: 220,
    overflow: 'hidden',
  },
  specialtySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    borderBottomWidth: 1,
    borderBottomColor: c.border.light,
    gap: s.xs,
  },
  specialtySearchInput: {
    flex: 1,
    fontSize: 16,
    color: c.text.primary,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  specialtyOptionsScroll: {
    maxHeight: 180,
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
    backgroundColor: c.primary.ghost,
  },
  specialtyOptionText: {
    flex: 1,
    fontSize: 15,
    color: c.text.primary,
    marginRight: s.sm,
  },
  specialtyOptionTextSelected: {
    fontWeight: '600',
    color: c.primary.main,
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
  },
  certSection: {
    marginTop: s.md,
    marginBottom: s.sm,
    paddingTop: s.md,
    borderTopWidth: 1,
    borderTopColor: c.border.main,
  },
  certSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text.primary,
    marginBottom: 4,
  },
  certSectionDesc: {
    fontSize: 13,
    color: c.text.secondary,
    marginBottom: s.sm,
  },
  certFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    paddingVertical: s.sm,
    paddingHorizontal: s.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: c.primary.main,
    borderStyle: 'dashed',
    backgroundColor: c.primary.ghost,
  },
  certFileBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: c.primary.main,
  },
  aiNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.sm,
    backgroundColor: c.primary.ghost ?? '#EFF6FF',
    padding: s.md,
    borderRadius: theme.borderRadius.md,
    marginTop: s.md,
    marginBottom: s.sm,
  },
  aiNoticeText: {
    flex: 1,
    fontSize: 13,
    color: c.text.secondary,
    lineHeight: 20,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: s.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.border.main,
    marginRight: s.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: c.primary.main,
    borderColor: c.primary.main,
  },
  termsLabel: {
    fontSize: 14,
    color: c.text.primary,
  },
  termsLink: {
    fontSize: 14,
    color: c.primary.main,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
