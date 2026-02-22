import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, spacing, typography } from '../constants/theme';
import { Logo } from '../components/Logo';
import { COMPANY } from '../lib/company';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'SOBRE O ' + COMPANY.name.toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.logoSection}>
          <View style={styles.logoImage}>
            <Logo size="medium" variant="dark" />
          </View>
        </View>

        <Text style={styles.tagline}>TELEMEDICINA PARA SUA SAÚDE</Text>
        <Text style={styles.version}>VERSÃO {APP_VERSION}</Text>

        <View style={styles.divider} />

        <Text style={styles.paragraph}>
          O {COMPANY.name} é uma plataforma de telemedicina que facilita a renovação de receitas, solicitação de exames e consultas online com médicos qualificados.
        </Text>
        <Text style={styles.paragraph}>
          Oferecemos um fluxo seguro, rápido e acessível para cuidar da sua saúde com praticidade.
        </Text>

        <View style={styles.divider} />

        <View style={styles.contactSection}>
          <Text style={styles.contactLabel}>ENDEREÇO</Text>
          <Text style={styles.contactText}>{COMPANY.address}</Text>
          <Text style={styles.contactLabel}>CONTATO</Text>
          <Text style={styles.contactText}>{COMPANY.phone} {'\u00B7'} {COMPANY.website}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDarker,
    letterSpacing: 0.5,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 140,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray600,
    textAlign: 'center',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  version: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray400,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: spacing.lg,
  },
  paragraph: {
    fontSize: 14,
    color: '#475569',
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  contactSection: {
    gap: 4,
  },
  contactLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 2,
  },
  contactText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
});
