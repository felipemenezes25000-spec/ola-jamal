import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { fetchPushTokens, setPushPreference } from '../lib/api';
import { colors, spacing, typography, borderRadius } from '../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
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

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  const SettingItem = ({ icon, label, right, onPress, danger }: any) => (
    <TouchableOpacity style={styles.item} onPress={onPress} disabled={!onPress}>
      <View style={[styles.itemIcon, danger && { backgroundColor: colors.errorLight }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.itemLabel, danger && { color: colors.error }]}>{label}</Text>
      {right || (onPress && <Ionicons name="chevron-forward" size={16} color={colors.gray300} />)}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Configurações</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Notificações</Text>
          <SettingItem icon="notifications-outline" label="Notificações Push" right={
            <Switch value={pushEnabled} onValueChange={handlePushToggle} trackColor={{ true: colors.success, false: colors.gray300 }} thumbColor={colors.white} />
          } />
          <View style={styles.divider} />
          <SettingItem icon="mail-outline" label="Notificações por E-mail" right={
            <Switch value={emailEnabled} onValueChange={setEmailEnabled} trackColor={{ true: colors.success, false: colors.gray300 }} thumbColor={colors.white} />
          } />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Segurança</Text>
          <SettingItem icon="key-outline" label="Alterar Senha" onPress={() => router.push('/change-password')} />
          <View style={styles.divider} />
          <SettingItem icon="shield-outline" label="Privacidade (LGPD)" onPress={() => router.push('/privacy')} />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre</Text>
          <SettingItem icon="document-text-outline" label="Termos de Uso" onPress={() => router.push('/terms')} />
          <View style={styles.divider} />
          <SettingItem icon="information-circle-outline" label="Sobre o RenoveJá+" onPress={() => router.push('/about')} />
          <View style={styles.divider} />
          <SettingItem icon="help-circle-outline" label="Ajuda e FAQ" onPress={() => router.push('/help-faq')} />
          <View style={styles.divider} />
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Versão</Text>
            <Text style={styles.versionValue}>1.0.0</Text>
          </View>
        </Card>

        <Card style={styles.section}>
          <SettingItem icon="log-out-outline" label="Sair da Conta" onPress={handleLogout} danger />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.captionSmall, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  itemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  itemLabel: { flex: 1, ...typography.bodySmallMedium, color: colors.gray800 },
  divider: { height: 1, backgroundColor: colors.gray100, marginVertical: spacing.xs },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  versionLabel: { ...typography.bodySmall, color: colors.gray500 },
  versionValue: { ...typography.bodySmallMedium, color: colors.gray400 },
});
