import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader, AppCard, AppInput, AppButton } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { useRequireAuth } from '../hooks/useRequireAuth';

export default function AddressScreen() {
  useRequireAuth();
  const router = useRouter();
  const { user, completeProfile, refreshUser } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [postalCode, setPostalCode] = useState(user?.postalCode ?? '');
  const [street, setStreet] = useState(user?.street ?? '');
  const [number, setNumber] = useState(user?.number ?? '');
  const [complement, setComplement] = useState(user?.complement ?? '');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [state, setState] = useState(user?.state ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const orig = {
    postalCode: user?.postalCode ?? '',
    street: user?.street ?? '',
    number: user?.number ?? '',
    complement: user?.complement ?? '',
    neighborhood: user?.neighborhood ?? '',
    city: user?.city ?? '',
    state: user?.state ?? '',
  };

  const hasChanges =
    postalCode !== orig.postalCode ||
    street !== orig.street ||
    number !== orig.number ||
    complement !== orig.complement ||
    neighborhood !== orig.neighborhood ||
    city !== orig.city ||
    state !== orig.state;

  const handleSave = async () => {
    if (!hasChanges) return;
    setError('');
    setLoading(true);
    try {
      await completeProfile({
        postalCode: postalCode || undefined,
        street: street || undefined,
        number: number || undefined,
        complement: complement || undefined,
        neighborhood: neighborhood || undefined,
        city: city || undefined,
        state: state || undefined,
      });
      await refreshUser();
      Alert.alert('Sucesso', 'Endereço atualizado com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      setError(e?.message || 'Erro ao atualizar endereço.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Endereço" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.card}>
          <AppInput
            label="CEP"
            value={postalCode}
            onChangeText={setPostalCode}
            keyboardType="numeric"
            placeholder="00000-000"
            leftIcon="location-outline"
            editable={!loading}
          />
          <AppInput
            label="Rua"
            value={street}
            onChangeText={setStreet}
            placeholder="Nome da rua"
            leftIcon="map-outline"
            editable={!loading}
          />
          <View style={styles.row}>
            <View style={styles.rowSmall}>
              <AppInput
                label="Número"
                value={number}
                onChangeText={setNumber}
                keyboardType="numeric"
                placeholder="Nº"
                editable={!loading}
              />
            </View>
            <View style={styles.rowLarge}>
              <AppInput
                label="Complemento"
                value={complement}
                onChangeText={setComplement}
                placeholder="Apto, bloco..."
                editable={!loading}
              />
            </View>
          </View>
          <AppInput
            label="Bairro"
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Bairro"
            editable={!loading}
          />
          <View style={styles.row}>
            <View style={styles.rowLarge}>
              <AppInput
                label="Cidade"
                value={city}
                onChangeText={setCity}
                placeholder="Cidade"
                editable={!loading}
              />
            </View>
            <View style={styles.rowSmall}>
              <AppInput
                label="UF"
                value={state}
                onChangeText={setState}
                placeholder="UF"
                maxLength={2}
                autoCapitalize="characters"
                editable={!loading}
              />
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {hasChanges && (
            <AppButton title="Salvar endereço" onPress={handleSave} loading={loading} fullWidth />
          )}
        </AppCard>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
      paddingBottom: uiTokens.sectionGap * 3,
    },
    card: { padding: uiTokens.spacing.lg },
    row: { flexDirection: 'row', gap: uiTokens.spacing.sm },
    rowSmall: { flex: 1 },
    rowLarge: { flex: 2 },
    errorText: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: colors.error,
      marginBottom: uiTokens.spacing.md,
    },
  });
}
