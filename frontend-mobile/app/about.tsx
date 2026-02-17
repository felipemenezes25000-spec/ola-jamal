import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, spacing, typography } from '../constants/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sobre o RenoveJá</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoSection}>
          <Image source={require('../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.tagline}>Telemedicina para sua saúde</Text>
          <Text style={styles.version}>Versão {APP_VERSION}</Text>
        </View>
        <Text style={styles.paragraph}>
          O RenoveJá é uma plataforma de telemedicina que facilita a renovação de receitas, solicitação de exames e consultas online com médicos qualificados.
        </Text>
        <Text style={styles.paragraph}>
          Oferecemos um fluxo seguro, rápido e acessível para cuidar da sua saúde com praticidade.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  logoSection: { alignItems: 'center', marginBottom: spacing.xl },
  logoImage: { width: 180, height: 100, marginBottom: spacing.sm },
  tagline: { ...typography.bodySmall, color: colors.gray600, marginBottom: spacing.sm },
  version: { ...typography.caption, color: colors.gray400 },
  paragraph: { ...typography.bodySmall, color: colors.gray700, marginBottom: spacing.md, lineHeight: 22 },
});
