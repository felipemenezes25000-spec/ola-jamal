import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Screen } from '../../components/ui/Screen';
import { AppInput } from '../../components/ui/AppInput';
import { AppButton } from '../../components/ui/AppButton';
import { colors, spacing } from '../../lib/theme';
import { fetchAddressByCep } from '../../lib/viacep';

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '');
}

function formatCep(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export default function CompleteProfileScreen() {
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
  const { user, completeProfile, signOut } = useAuth();
  const router = useRouter();
  const isPatient = user?.role === 'patient';

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

    if (isPatient) {
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
      setTimeout(() => router.replace(dest as any), 0);
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
            try {
              const { apiClient } = require('../../lib/api-client');
              await apiClient.post('/api/auth/cancel-registration', {});
            } catch { /* ignore */ }
            await signOut();
            setTimeout(() => router.replace('/(auth)/login'), 0);
          },
        },
      ]
    );
  };

  return (
    <Screen variant="gradient" scroll contentStyle={styles.content}>
      <Text style={styles.brand}>RenoveJá+</Text>

      <View style={styles.form}>
        <AppInput
          label="CEP"
          placeholder="00000-000"
          value={cep}
          onChangeText={handleCepChange}
          onBlur={lookupCep}
          keyboardType="numeric"
          leftIcon="location-outline"
          editable={!cepLoading}
        />
        <AppInput
          label="Rua"
          required={isPatient}
          placeholder="Nome da rua"
          value={street}
          onChangeText={(t) => { setStreet(t); clearError('street'); }}
          leftIcon="home-outline"
          error={fieldErrors.street}
        />
        <View style={styles.row}>
          <AppInput
            label="Número"
            required={isPatient}
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
          required={isPatient}
          placeholder="Bairro"
          value={neighborhood}
          onChangeText={(t) => { setNeighborhood(t); clearError('neighborhood'); }}
          leftIcon="business-outline"
          error={fieldErrors.neighborhood}
        />
        <View style={styles.row}>
          <AppInput
            label="Cidade"
            required={isPatient}
            placeholder="Cidade"
            value={city}
            onChangeText={(t) => { setCity(t); clearError('city'); }}
            containerStyle={styles.cityInput}
            error={fieldErrors.city}
          />
          <AppInput
            label="UF"
            required={isPatient}
            placeholder="UF"
            value={state}
            onChangeText={(t) => { setState(t.trim().toUpperCase().slice(0, 2)); clearError('state'); }}
            maxLength={2}
            containerStyle={styles.stateInput}
            error={fieldErrors.state}
          />
        </View>
        <AppInput
          label="Telefone"
          required
          placeholder="(11) 99999-9999"
          value={phone}
          onChangeText={(t) => { setPhone(t); clearError('phone'); }}
          keyboardType="phone-pad"
          leftIcon="call-outline"
          error={fieldErrors.phone}
        />
        <AppInput
          label="CPF"
          required
          placeholder="000.000.000-00"
          value={cpf}
          onChangeText={(t) => { setCpf(t); clearError('cpf'); }}
          keyboardType="numeric"
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

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
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
