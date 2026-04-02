import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppInput } from '../ui/AppInput';
import { SectionHeader } from '../ui/SectionHeader';
import { spacing } from '../../lib/designSystem';
import type { DesignColors } from '../../lib/designSystem';

const s = spacing;

export interface RegisterAddressFieldsProps {
  title: string;
  cep: string;
  onCepChange: (text: string) => void;
  onCepBlur?: () => void;
  street: string;
  onStreetChange: (text: string) => void;
  number: string;
  onNumberChange: (text: string) => void;
  neighborhood: string;
  onNeighborhoodChange: (text: string) => void;
  complement: string;
  onComplementChange: (text: string) => void;
  city: string;
  onCityChange: (text: string) => void;
  state: string;
  onStateChange: (text: string) => void;
  fieldErrors: Record<string, string>;
  clearError: (field: string) => void;
  required?: boolean;
  colors: DesignColors;
}

export function RegisterAddressFields({
  title,
  cep,
  onCepChange,
  onCepBlur,
  street,
  onStreetChange,
  number,
  onNumberChange,
  neighborhood,
  onNeighborhoodChange,
  complement,
  onComplementChange,
  city,
  onCityChange,
  state,
  onStateChange,
  fieldErrors,
  clearError,
  required = true,
}: RegisterAddressFieldsProps) {
  const styles = React.useMemo(() => makeStyles(), []);

  return (
    <>
      {title ? <SectionHeader icon="location-outline" title={title} variant="form" /> : null}
      <AppInput
        label="CEP"
        placeholder="00000-000"
        value={cep}
        onChangeText={onCepChange}
        onBlur={onCepBlur}
        keyboardType="numeric"
        autoComplete="postal-code"
        textContentType="postalCode"
        maxLength={9}
        returnKeyType="next"
        leftIcon="location-outline"
        hint="Digite o CEP para preencher automaticamente"
      />
      <AppInput
        label="Rua"
        required={required}
        placeholder="Nome da rua"
        value={street}
        onChangeText={(t) => { onStreetChange(t); clearError('street'); }}
        leftIcon="home-outline"
        autoCapitalize="words"
        autoComplete="street-address"
        textContentType="streetAddressLine1"
        returnKeyType="next"
        error={fieldErrors.street}
      />
      <View style={styles.row}>
        <AppInput
          label="Número"
          required={required}
          placeholder="Nº"
          value={number}
          onChangeText={(t) => { onNumberChange(t); clearError('number'); }}
          keyboardType="numeric"
          maxLength={10}
          returnKeyType="next"
          blurOnSubmit={false}
          containerStyle={{ width: 100 }}
          error={fieldErrors.number}
        />
        <AppInput
          label="Complemento"
          placeholder="Apto, bloco..."
          value={complement}
          onChangeText={onComplementChange}
          autoCapitalize="words"
          textContentType="streetAddressLine2"
          returnKeyType="next"
          blurOnSubmit={false}
          containerStyle={styles.flex1}
        />
      </View>
      <AppInput
        label="Bairro"
        required={required}
        placeholder="Bairro"
        value={neighborhood}
        onChangeText={(t) => { onNeighborhoodChange(t); clearError('neighborhood'); }}
        leftIcon="business-outline"
        autoCapitalize="words"
        returnKeyType="next"
        error={fieldErrors.neighborhood}
      />
      <View style={styles.row}>
        <AppInput
          label="Cidade"
          required={required}
          placeholder="Cidade"
          value={city}
          onChangeText={(t) => { onCityChange(t); clearError('city'); }}
          autoCapitalize="words"
          textContentType="addressCity"
          returnKeyType="next"
          blurOnSubmit={false}
          containerStyle={styles.flex1}
          error={fieldErrors.city}
        />
        <AppInput
          label="UF"
          required={required}
          placeholder="UF"
          value={state}
          onChangeText={(t) => { onStateChange(t); clearError('state'); }}
          maxLength={2}
          autoCapitalize="characters"
          textContentType="addressState"
          returnKeyType="next"
          blurOnSubmit={false}
          containerStyle={{ width: 96 }}
          error={fieldErrors.state}
        />
      </View>
    </>
  );
}

function makeStyles() {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: s.sm },
    flex1: { flex: 1 },
  });
}
