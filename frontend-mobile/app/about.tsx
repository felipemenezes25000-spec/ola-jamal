import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ScreenHeader, AppCard } from '../components/ui';
import { Logo } from '../components/Logo';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { COMPANY } from '../lib/company';
import { haptics } from '../lib/haptics';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const openWhatsApp = () => {
    haptics.selection();
    Linking.openURL(COMPANY.whatsapp).catch(() => {});
  };

  const openWebsite = () => {
    haptics.selection();
    Linking.openURL(`https://${COMPANY.website}`).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title={`Sobre o ${COMPANY.name}`} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Logo size="medium" variant="dark" compact />
        </View>
        <Text style={styles.tagline}>Telemedicina para sua saúde</Text>
        <Text style={styles.taglineSub}>
          Renove sua receita e pedido de exames. Rápido e sem burocracia.
        </Text>
        <Text style={styles.version}>Versão {APP_VERSION}</Text>

        <AppCard style={styles.aboutCard}>
          <Text style={styles.paragraph}>
            O {COMPANY.name} é uma plataforma de telemedicina que facilita a renovação de receitas,
            solicitação de exames e consultas online com médicos qualificados.
          </Text>
          <Text style={[styles.paragraph, styles.paragraphSpaced]}>
            Oferecemos um fluxo seguro, rápido e acessível para cuidar da sua saúde com praticidade.
          </Text>
        </AppCard>

        <Text style={styles.sectionLabel}>Contato</Text>
        <AppCard style={styles.contactCard}>
          <View style={styles.contactRow}>
            <View style={[styles.contactIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="location" size={20} color={colors.primary} />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactLabel}>Endereço</Text>
              <Text style={styles.contactValue}>{COMPANY.address}</Text>
            </View>
          </View>
          <View style={styles.contactDivider} />
          <Pressable
            style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.8 }]}
            onPress={openWhatsApp}
          >
            <View style={[styles.contactIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactLabel}>WhatsApp / Telefone</Text>
              <Text style={styles.contactValue}>{COMPANY.phone}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
          <View style={styles.contactDivider} />
          <Pressable
            style={({ pressed }) => [styles.contactRow, pressed && { opacity: 0.8 }]}
            onPress={openWebsite}
          >
            <View style={[styles.contactIconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="globe-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.contactTextWrap}>
              <Text style={styles.contactLabel}>Site</Text>
              <Text style={styles.contactValue}>{COMPANY.website}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </AppCard>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
      paddingBottom: uiTokens.sectionGap * 3,
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: uiTokens.spacing.lg,
    },
    tagline: {
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    taglineSub: {
      fontSize: 13,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 4,
    },
    version: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      letterSpacing: 0.5,
      marginBottom: uiTokens.sectionGap,
    },
    aboutCard: {
      marginBottom: uiTokens.cardGap,
    },
    paragraph: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.textSecondary,
      lineHeight: 22,
    },
    paragraphSpaced: {
      marginTop: 12,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: uiTokens.sectionGap,
      marginBottom: uiTokens.cardGap,
      marginLeft: 4,
    },
    contactCard: {
      marginBottom: 0,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    contactIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    contactTextWrap: { flex: 1 },
    contactLabel: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    contactValue: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_400Regular',
      color: colors.text,
      lineHeight: 20,
    },
    contactDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: 12,
      marginLeft: 56,
    },
    bottomSpacer: {
      height: uiTokens.sectionGap * 2,
    },
  });
}
