import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { fetchPushTokens, setPushPreference } from '../lib/api';
import { colors, spacing, typography } from '../constants/theme';

/**
 * Tela de configurações acessada por "Editar Perfil" na aba Perfil.
 * Contém apenas opções que NÃO estão na aba Perfil (evita duplicação).
 * Alterar senha, Termos, Sobre, Ajuda, Sair etc. ficam só na aba Perfil.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  useEffect(() => {
    fetchPushTokens()
      .then(tokens => {
        if (tokens.length === 0) setPushEnabled(true);
        else setPushEnabled(tokens.some((t: { active: boolean }) => t.active));
      })
      .catch(() => {});
  }, []);

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);
    try {
      await setPushPreference(value);
    } catch {
      setPushEnabled(!value);
    }
  };

  const SettingItem = ({ icon, label, right }: { icon: keyof typeof Ionicons.glyphMap; label: string; right: React.ReactNode }) => (
    <View style={styles.item}>
      <View style={styles.itemIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={styles.itemLabel}>{label}</Text>
      {right}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Notificações</Text>
          <SettingItem
            icon="notifications-outline"
            label="Notificações Push"
            right={
              <Switch
                value={pushEnabled}
                onValueChange={handlePushToggle}
                trackColor={{ true: colors.success, false: colors.gray300 }}
                thumbColor={colors.white}
              />
            }
          />
          <View style={styles.divider} />
          <SettingItem
            icon="mail-outline"
            label="Notificações por E-mail"
            right={
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ true: colors.success, false: colors.gray300 }}
                thumbColor={colors.white}
              />
            }
          />
        </Card>
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
  section: { marginBottom: spacing.md },
  sectionTitle: {
    ...typography.captionSmall,
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryPaler,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemLabel: { flex: 1, ...typography.bodySmallMedium, color: colors.gray800 },
  divider: { height: 1, backgroundColor: colors.gray100, marginVertical: spacing.xs },
});
