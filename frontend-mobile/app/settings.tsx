import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { fetchPushTokens, setPushPreference, sendTestPush } from '../lib/api';
import { colors, spacing } from '../lib/theme';
import { getMutedKeys, unmuteAll } from '../lib/triage/triagePersistence';
import { showToast } from '../components/ui/Toast';

/**
 * Tela de configurações acessada por "Editar Perfil" na aba Perfil.
 * Contém apenas opções que NÃO estão na aba Perfil (evita duplicação).
 * Alterar senha, Termos, Sobre, Ajuda, Sair etc. ficam só na aba Perfil.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [mutedCount, setMutedCount] = useState(0);

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

  const handleResetMuted = async () => {
    await unmuteAll();
    // Após reset completo da triagem, o contador zera e as mensagens podem voltar em todas as telas.
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

  const handleTestPush = async () => {
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
          <Text style={styles.sectionTitle}>Assistente Dra. Renoveja</Text>
          <SettingItem
            icon="chatbubble-ellipses-outline"
            label={`Reativar mensagens silenciadas (${mutedCount})`}
            right={
              mutedCount > 0 ? (
                <TouchableOpacity onPress={handleResetMuted}>
                  <Text style={styles.linkText}>Reativar</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.mutedText}>Nenhuma</Text>
              )
            }
          />
        </Card>

        <Card style={styles.section}>
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
              <TouchableOpacity onPress={handleTestPush}>
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
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.primaryDark },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.md },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.text },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.xs },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  mutedText: { fontSize: 14, fontWeight: '500', color: colors.textMuted },
});
