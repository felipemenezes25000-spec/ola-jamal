import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, AppCard } from '../components/ui';
import { fetchPushTokens, setPushPreference, sendTestPush } from '../lib/api';
import { getPushPreferences, updatePushPreferences, type PushPreferencesDto } from '../lib/api-push-preferences';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { uiTokens } from '../lib/ui/tokens';
import { getMutedKeys, unmuteAll } from '../lib/triage/triagePersistence';
import { showToast } from '../components/ui/Toast';
import { humanizeError } from '../lib/errors/humanizeError';
import { useColorSchemeContext } from '../contexts/ColorSchemeContext';
import { haptics } from '../lib/haptics';
import { isExpoGo } from '../lib/expo-go';
import { useRequireAuth } from '../hooks/useRequireAuth';

/**
 * Tela de configurações acessada por "Configurações" na aba Perfil.
 * Contém opções de assistente, aparência, notificações e categorias de push.
 */
export default function SettingsScreen() {
  useRequireAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  // null = ainda carregando, false = sem token, true = token registrado
  const [hasToken, setHasToken] = useState<boolean | null>(null);
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
    let cancelled = false;
    getMutedKeys()
      .then(keys => { if (!cancelled) setMutedCount(keys.length); })
      .catch(() => { if (!cancelled) showToast({ message: 'Não foi possível carregar triagem silenciada', type: 'error' }); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPushTokens()
      .then(tokens => {
        if (cancelled) return;
        const hasRegistered = tokens.length > 0;
        setHasToken(hasRegistered);
        // Só mostra toggle ativo se há token registrado E pelo menos um ativo
        setPushEnabled(hasRegistered && tokens.some((t: { active: boolean }) => t.active));
      })
      .catch(() => {
        if (cancelled) return;
        setHasToken(false);
        showToast({ message: 'Não foi possível carregar status de push', type: 'error' });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPushPreferences()
      .then(data => { if (!cancelled) setCategoryPrefs(data); })
      .catch(() => { if (!cancelled) showToast({ message: 'Não foi possível carregar preferências de notificação', type: 'error' }); });
    return () => { cancelled = true; };
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
      const rawMsg = (e as { message?: string })?.message ?? 'Falha ao enviar. Verifique se há token registrado.';
      const isGeneric500 = (e as { status?: number })?.status === 500 || rawMsg.includes('Ocorreu um erro ao processar sua solicitação');
      const msg = isGeneric500 ? humanizeError(e, 'generic') : rawMsg;
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

          {/* Banner: app rodando no Expo Go — push não suportado */}
          {isExpoGo && (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={[styles.bannerText, { color: colors.textMuted }]}>
                Push não disponível no Expo Go. Use uma build EAS.
              </Text>
            </View>
          )}

          {/* Banner: sem token registrado (build real, mas permissão negada ou falha no registro) */}
          {!isExpoGo && hasToken === false && (
            <TouchableOpacity
              style={styles.warningBanner}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.75}
            >
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={styles.warningBannerText}>
                Push não registrado. Verifique as permissões do app.
              </Text>
              <Text style={[styles.linkText, { fontSize: 12 }]}>Abrir</Text>
            </TouchableOpacity>
          )}

          <SettingItem
            icon="notifications-outline"
            label="Notificações Push"
            right={
              <Switch
                value={pushEnabled}
                onValueChange={handlePushToggle}
                disabled={!hasToken}
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
              <TouchableOpacity
                onPress={handleTestPush}
                disabled={!hasToken}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.linkText, !hasToken && styles.linkTextDisabled]}>Enviar</Text>
              </TouchableOpacity>
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
    linkTextDisabled: {
      opacity: 0.35,
    },
    mutedText: {
      fontSize: 14,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: colors.textMuted,
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceSecondary ?? 'rgba(0,0,0,0.04)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: uiTokens.spacing.md,
    },
    warningBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: uiTokens.spacing.md,
    },
    warningBannerText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
      color: '#F59E0B',
    },
    bannerText: {
      flex: 1,
      fontSize: 12,
      fontFamily: 'PlusJakartaSans_500Medium',
      fontWeight: '500',
    },
    bottomSpacer: {
      height: uiTokens.sectionGap * 2,
    },
  });
}
