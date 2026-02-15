import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { updateDoctorAvailability, getActiveCertificate } from '../../lib/api';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function DoctorProfileScreen() {
  const { user, doctorProfile, signOut } = useAuth();
  const router = useRouter();
  const [available, setAvailable] = useState(doctorProfile?.available ?? false);
  const [certInfo, setCertInfo] = useState<any>(null);

  useEffect(() => {
    getActiveCertificate().then(c => setCertInfo(c)).catch(() => {});
  }, []);

  const toggleAvail = async (val: boolean) => {
    setAvailable(val);
    try { if (doctorProfile) await updateDoctorAvailability(doctorProfile.id, val); } catch { setAvailable(!val); }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  const MenuItem = ({ icon, label, onPress, danger, right }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.errorLight }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
      {right || <Ionicons name="chevron-forward" size={16} color={colors.gray300} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.screenTitle}>Meu Perfil</Text>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.name}>Dr(a). {user?.name}</Text>
          <Text style={styles.detail}>{doctorProfile?.specialty || 'Especialidade'}</Text>
          <Text style={styles.detail}>CRM {doctorProfile?.crm}/{doctorProfile?.crmState}</Text>
        </Card>

        <Card style={styles.section}>
          <MenuItem icon="toggle-outline" label="Disponibilidade" onPress={() => {}} right={
            <Switch value={available} onValueChange={toggleAvail} trackColor={{ true: colors.success, false: colors.gray300 }} thumbColor={colors.white} />
          } />
          <View style={styles.divider} />
          <MenuItem icon="shield-checkmark-outline" label="Certificado Digital" onPress={() => router.push('/certificate/upload')} right={
            <View style={styles.certBadge}><Text style={styles.certBadgeText}>{certInfo ? 'Ativo' : 'Pendente'}</Text></View>
          } />
        </Card>

        <Card style={styles.section}>
          <MenuItem icon="person-outline" label="Dados Pessoais" onPress={() => {}} />
          <View style={styles.divider} />
          <MenuItem icon="settings-outline" label="Configurações" onPress={() => router.push('/settings')} />
          <View style={styles.divider} />
          <MenuItem icon="help-circle-outline" label="Ajuda" onPress={() => {}} />
        </Card>

        <Card style={styles.section}>
          <MenuItem icon="log-out-outline" label="Sair" onPress={handleLogout} danger />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  screenTitle: { ...typography.h2, color: colors.primaryDarker, marginBottom: spacing.lg },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarText: { ...typography.h1, color: colors.white },
  name: { ...typography.h4, color: colors.gray800, marginBottom: 4 },
  detail: { ...typography.bodySmall, color: colors.gray500 },
  section: { marginBottom: spacing.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  menuLabel: { flex: 1, ...typography.bodySmallMedium, color: colors.gray800 },
  divider: { height: 1, backgroundColor: colors.gray100, marginVertical: spacing.xs },
  certBadge: { backgroundColor: colors.warningLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  certBadgeText: { ...typography.captionSmall, color: colors.warning },
});
