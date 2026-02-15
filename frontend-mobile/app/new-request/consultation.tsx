import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { createConsultationRequest } from '../../lib/api';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function ConsultationScreen() {
  const router = useRouter();
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!symptoms.trim()) { Alert.alert('Atenção', 'Descreva seus sintomas'); return; }
    setLoading(true);
    try {
      const result = await createConsultationRequest({ symptoms });
      if (result.payment) router.replace(`/payment/${result.payment.id}`);
      else Alert.alert('Sucesso', 'Consulta solicitada!', [{ text: 'OK', onPress: () => router.replace('/(patient)/requests') }]);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar solicitação');
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Consulta</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoBanner}>
          <Ionicons name="videocam" size={32} color={colors.primary} />
          <Text style={styles.bannerTitle}>Consulta por Videochamada</Text>
          <Text style={styles.bannerDesc}>Um médico atenderá você em poucos minutos após o pagamento.</Text>
        </View>

        <Input label="Descreva seus sintomas" placeholder="O que você está sentindo? Desde quando? Há quanto tempo?..." value={symptoms} onChangeText={setSymptoms} multiline numberOfLines={6} style={{ minHeight: 140, textAlignVertical: 'top' }} />

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Valor da consulta</Text>
          <Text style={styles.priceValue}>R$ 99,90</Text>
        </View>

        <Button title="Solicitar Consulta" onPress={handleSubmit} loading={loading} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  infoBanner: { alignItems: 'center', backgroundColor: colors.primaryPaler, borderRadius: borderRadius.xl, padding: spacing.xl, marginBottom: spacing.lg },
  bannerTitle: { ...typography.h4, color: colors.primaryDark, marginTop: spacing.sm },
  bannerDesc: { ...typography.bodySmall, color: colors.gray600, textAlign: 'center', marginTop: spacing.xs },
  priceCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.lg, ...shadows.sm },
  priceLabel: { ...typography.bodySmall, color: colors.gray600 },
  priceValue: { ...typography.h3, color: colors.primary },
});
