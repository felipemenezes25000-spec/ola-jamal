import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, AppCard } from '../components/ui';
import { fetchPushTokens, setPushPreference, sendTestPush } from '../lib/api';
import { getPushPreferences, updatePushPreferences, type PushPreferencesDto } from '../lib/api-push-preferences';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { getMutedKeys, unmuteAll } from '../lib/triage/triagePersistence';
import { showToast } from '../components/ui/Toast';
import { useColorSchemeContext } from '../contexts/ColorSchemeContext';
import { haptics } from '../lib/haptics';

/**
 * Tela de configurações acessada por "Configurações" na aba Perfil.
 * Contém opções de assistente, aparência, notificações e categorias de push.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [mutedCount, setMutedCount] = useState(0);
  const [categoryPrefs, setCategoryPrefs] = useState<PushPreferencesDto>({
    requestsEnabled: true,
    paymentsEnabled: true,
    consultationsEnabled: true,
    remindersEnabled: true,
    timezone: 'America/Sao_Paulo',
  });
  const { preference, setPreference, isDark } = useColorSchemeContext();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    getMutedKeys().then(keys => setMutedCount(keys.length));
  }, []);

  useEffect(() => {
    fetchPushTokens()
      .then(tokens => {
        if (tokens.length === 0) setPushEnabled(true);
        else setPushEnabled(tokens.some((t: { active: boolean }) => t.active));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getPushPreferences()
      .then(data => setCategoryPrefs(data))
      .catch(() => {});
  }, []);

  const handleResetMuted = async () => {
    haptics.selection();
    await unmuteAll();
    setMutedCount(0);
  };

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);
    try {
      await setPushPreference(value);
    } catch {
      setPushEnabled(!value);
    }
  };

  const handleCategoryToggle = async (key: keyof PushPreferencesDto, value: boolean) => {
    const prev = { ...categoryPrefs };
    setCategoryPrefs(p => ({ ...p, [key]: value }));
    try {
      await updatePushPreferences({ [key]: value });
    } catch {
      setCategoryPrefs(prev);
    }
  };

  const handleTestPush = async () => {
    haptics.selection();
    try {
      await sendTestPush();
      showToast({ message: 'Push de teste enviado. Verifique seu dispositivo.', type: 'success' });
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Falha ao enviar. Verifique se há token registrado.';
      showToast({ message: msg, type: 'error' });
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
    <View style={styles.container}>
      <ScreenHeader title="Configurações" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.section}>
          <Text style={styles.sectionTitle}>Assistente Dra. Renoveja</Text>
          <SettingItem
            icon="chatbubble-ellipses-outline"
            label={`Reativar mensagens silenciadas (${mutedCount})`}
            right={
              mutedCount > 0 ? (
                <TouchableOpacity onPress={handleResetMuted} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={styles.linkText}>Reativar</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.mutedText}>Nenhuma</Text>
              )
            }
          />
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionTitle}>Aparência</Text>
          <SettingItem
            icon={isDark ? 'moon' : 'sunny-outline'}
            label="Modo escuro"
            right={
              <Switch
                value={isDark}
                onValueChange={(val) => {
                  haptics.selection();
                  setPreference(val ? 'dark' : 'light');
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
                accessibilityLabel="Ativar modo escuro"
              />
            }
          />
          <View style={styles.divider} />
          <SettingItem
            icon="phone-portrait-outline"
            label="Seguir sistema"
            right={
              <Switch
                value={preference === 'system'}
                onValueChange={(val) => {
                  haptics.selection();
                  setPreference(val ? 'system' : isDark ? 'dark' : 'light');
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.white}
                accessibilityLabel="Seguir preferência do sistema"
              />
            }
          />
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionTitle}>Notificações</Text>
          <SettingItem
            icon="notifications-outline"
            label="Notificações Push"
            right={
              <Switch
                value={pushEnabled}
                onValueChange={handlePushToggle}
                trackColor={{ true: colors.success, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
          <View style={styles.divider} />
          <SettingItem
            icon="send-outline"
            label="Testar push"
            right={
              <TouchableOpacity onPress={handleTestPush} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.linkText}>Enviar</Text>
              </TouchableOpacity>
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
                trackColor={{ true: colors.success, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
        </AppCard>

        <AppCard style={styles.section}>
          <Text style={styles.sectionTitle}>Categorias de Push</Text>
          <SettingItem
            icon="document-text-outline"
            label="Pedidos"
            right={
              <Switch
                value={categoryPrefs.requestsEnabled}
                onValueChange={(v) => handleCategoryToggle('requestsEnabled', v)}
                trackColor={{ true: colors.success, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
          <View style={styles.divider} />
          <SettingItem
            icon="card-outline"
            label="Pagamentos"
            right={
              <Switch
                value={categoryPrefs.paymentsEnabled}
                onValueChange={(v) => handleCategoryToggle('paymentsEnabled', v)}
                trackColor={{ true: colors.success, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
          <View style={styles.divider} />
          <SettingItem
            icon="videocam-outline"
            label="Consultas"
            right={
              <Switch
                value={categoryPrefs.consultationsEnabled}
                onValueChange={(v) => handleCategoryToggle('consultationsEnabled', v)}
                trackColor={{ true: colors.success, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
          <View style={styles.divider} />
          <SettingItem
            icon="time-outline"
            label="Lembretes"
            right={
              <Switch
                value={categoryPrefs.remindersEnabled}
                onValueChange={(v) => handleCategoryToggle('remindersEnabled', v)}
                trackColor={{ true: colors.success, false: colors.border }}
                thumbColor={colors.white}
              />
            }
          />
        </AppCard>

        <View style={styles.bottomSpacer} />
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
    section: { marginBottom: uiTokens.sectionGap },
    sectionTitle: {
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: uiTokens.spacing.lg,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: uiTokens.spacing.sm,
    },
    itemIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: uiTokens.spacing.lg,
    },
    itemLabel: {
      flex: 1,
      fontSize: 15,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginVertical: uiTokens.spacing.xs,
      marginLeft: 52,
    },
    linkText: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_600SemiBold',
      fontWeight: '600',
      color: colors.primary,
    },
    mutedText: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: colors.textMuted,
    },
    bottomSpacer: {
      height: uiTokens.sectionGap * 2,
    },
  });
}
