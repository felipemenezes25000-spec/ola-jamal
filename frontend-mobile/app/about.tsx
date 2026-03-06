import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { spacing } from '../lib/theme';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { Logo } from '../components/Logo';
import { COMPANY } from '../lib/company';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{'SOBRE O ' + (COMPANY.name ?? '').toUpperCase()}</Text>
        <View style={{ width: 44 }} />
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

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
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
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  version: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  paragraph: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  contactSection: {
    gap: 4,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 2,
  },
  contactText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  });
}
