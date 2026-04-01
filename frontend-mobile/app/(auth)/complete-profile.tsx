import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { spacing } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { fetchAddressByCep } from '../../lib/viacep';
import { isValidCpf } from '../../lib/validation/cpf';

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function formatCep(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function CompleteProfileScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [complement, setComplement] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { completeProfile, cancelRegistration } = useAuth();
  const router = useRouter();
  const addressRequired = true; // Endereço obrigatório para paciente e médico

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
    setCepLoading(true);
    try {
      const result = await fetchAddressByCep(digits);
      setStreet((prev) => result.street || prev);
      setNeighborhood((prev) => result.neighborhood || prev);
      setCity((prev) => result.city || prev);
      setState((prev) => result.state || prev);
    } catch (e: any) {
      Alert.alert('CEP', e?.message || 'Não foi possível buscar o CEP.');
    } finally {
      setCepLoading(false);
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

  const handleComplete = async () => {
    const ph = onlyDigits(phone);
    const cp = onlyDigits(cpf);
    const str = street.trim();
    const num = number.trim();
    const neigh = neighborhood.trim();
    const ci = city.trim();
    const st = state.trim().toUpperCase();
    const err: Record<string, string> = {};

    if (!ph) err.phone = 'Telefone é obrigatório.';
    else if (ph.length < 10 || ph.length > 11) err.phone = 'Informe 10 ou 11 dígitos.';

    if (!cp) err.cpf = 'CPF é obrigatório.';
    else if (cp.length !== 11) err.cpf = 'O CPF deve ter 11 dígitos.';
    else if (!isValidCpf(cp)) err.cpf = 'CPF inválido. Verifique os dígitos.';

    // Endereço obrigatório para paciente e médico
    if (!str) err.street = 'Rua é obrigatória.';
    if (!num) err.number = 'Número é obrigatório.';
    if (!neigh) err.neighborhood = 'Bairro é obrigatório.';
    if (!ci) err.city = 'Cidade é obrigatória.';
    if (!st) err.state = 'UF é obrigatória.';
    else if (st.length !== 2) err.state = 'Informe a sigla com 2 letras.';

    if (Object.keys(err).length > 0) {
      setFieldErrors(err);
      return;
    }

    setLoading(true);
    try {
      const postalCode = onlyDigits(cep) || undefined;
      const updatedUser = await completeProfile({
        phone: ph,
        cpf: cp,
        ...(str ? { street: str } : {}),
        ...(num ? { number: num } : {}),
        ...(neigh ? { neighborhood: neigh } : {}),
        ...(complement.trim() ? { complement: complement.trim() } : {}),
        ...(ci ? { city: ci } : {}),
        ...(st.length === 2 ? { state: st } : {}),
        ...(postalCode && postalCode.length === 8 ? { postalCode } : {}),
      });
      const dest = updatedUser.role === 'doctor' ? '/(doctor)/dashboard' : '/(patient)/home';
      setTimeout(() => nav.replace(router, dest as any), 0);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || String(error) || 'Não foi possível completar o cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert(
      'Cancelar Cadastro',
      'Deseja cancelar o cadastro? Sua conta será removida.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            await cancelRegistration();
            setTimeout(() => router.replace('/(auth)/login'), 0);
          },
        },
      ]
    );
  };

  return (
    <Screen variant="gradient" scroll contentStyle={styles.content}>
      <Text style={styles.brand}>RenoveJá+</Text>
      <Text style={styles.subtitle}>
        Você entrou com o Google. Para continuar, preencha os dados obrigatórios abaixo.
      </Text>

      <View style={styles.form}>
        <AppInput
          label="CEP"
          placeholder="00000-000"
          value={cep}
          onChangeText={handleCepChange}
          onBlur={lookupCep}
          keyboardType="numeric"
          autoComplete="postal-code"
          textContentType="postalCode"
          maxLength={9}
          returnKeyType="next"
          blurOnSubmit={false}
          leftIcon="location-outline"
          editable={!cepLoading && !loading}
        />
        <AppInput
          label="Rua"
          required={addressRequired}
          placeholder="Nome da rua"
          value={street}
          onChangeText={(t: string) => { setStreet(t); clearError('street'); }}
          leftIcon="home-outline"
          autoComplete="street-address"
          textContentType="streetAddressLine1"
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
          editable={!loading}
          error={fieldErrors.street}
        />
        <View style={styles.row}>
          <AppInput
            label="Número"
            required={addressRequired}
            placeholder="Nº"
            value={number}
            onChangeText={(t: string) => { setNumber(t); clearError('number'); }}
            keyboardType="numeric"
            maxLength={10}
            returnKeyType="next"
            blurOnSubmit={false}
            editable={!loading}
            containerStyle={styles.numberInput}
            error={fieldErrors.number}
          />
          <AppInput
            label="Complemento"
            placeholder="Apto, bloco..."
            value={complement}
            onChangeText={setComplement}
            autoCapitalize="words"
            returnKeyType="next"
            blurOnSubmit={false}
            editable={!loading}
            containerStyle={styles.complementInput}
          />
        </View>
        <AppInput
          label="Bairro"
          required={addressRequired}
          placeholder="Bairro"
          value={neighborhood}
          onChangeText={(t: string) => { setNeighborhood(t); clearError('neighborhood'); }}
          leftIcon="business-outline"
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
          editable={!loading}
          error={fieldErrors.neighborhood}
        />
        <View style={styles.row}>
          <AppInput
            label="Cidade"
            required={addressRequired}
            placeholder="Cidade"
            value={city}
            onChangeText={(t: string) => { setCity(t); clearError('city'); }}
            autoCapitalize="words"
            textContentType="addressCity"
            returnKeyType="next"
            blurOnSubmit={false}
            editable={!loading}
            containerStyle={styles.cityInput}
            error={fieldErrors.city}
          />
          <AppInput
            label="UF"
            required={addressRequired}
            placeholder="UF"
            value={state}
            onChangeText={(t: string) => { setState(t.trim().toUpperCase().slice(0, 2)); clearError('state'); }}
            maxLength={2}
            autoCapitalize="characters"
            textContentType="addressState"
            returnKeyType="next"
            blurOnSubmit={false}
            editable={!loading}
            containerStyle={styles.stateInput}
            error={fieldErrors.state}
          />
        </View>
        <AppInput
          label="Telefone"
          required
          placeholder="(11) 99999-9999"
          value={phone}
          onChangeText={(t: string) => { setPhone(t); clearError('phone'); }}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          blurOnSubmit={false}
          editable={!loading}
          leftIcon="call-outline"
          error={fieldErrors.phone}
        />
        <AppInput
          label="CPF"
          required
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={(t: string) => { setCpf(t); clearError('cpf'); }}
          keyboardType="numeric"
          maxLength={14}
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={handleComplete}
          editable={!loading}
          leftIcon="card-outline"
          error={fieldErrors.cpf}
        />
        <AppButton
          title="Finalizar Cadastro"
          onPress={handleComplete}
          loading={loading}
          fullWidth
        />
        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancelar cadastro</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  form: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  cancelBtn: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.error,
  },
  });
}
