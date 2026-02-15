import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

export default function PatientProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        await signOut();
        router.replace('/(auth)/login');
      }},
    ]);
  };

  const MenuItem = ({ icon, label, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.errorLight }]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.gray300} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.screenTitle}>Meu Perfil</Text>

        {/* Avatar + Info */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'Usuário'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.phone && <Text style={styles.phone}>{user.phone}</Text>}
        </Card>

        {/* Info cards */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CPF</Text>
            <Text style={styles.infoValue}>{user?.cpf || 'Não informado'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Data de Nascimento</Text>
            <Text style={styles.infoValue}>
              {user?.birthDate ? new Date(user.birthDate).toLocaleDateString('pt-BR') : 'Não informada'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Membro desde</Text>
            <Text style={styles.infoValue}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}
            </Text>
          </View>
        </Card>

        {/* Menu - Configurações centraliza Ajuda, Termos, Privacidade */}
        <Card style={styles.menuCard}>
          <MenuItem icon="settings-outline" label="Configurações" onPress={() => router.push('/settings')} />
        </Card>

        <Card style={styles.menuCard}>
          <MenuItem icon="log-out-outline" label="Sair da Conta" onPress={handleLogout} danger />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  screenTitle: { ...typography.h2, color: colors.primaryDarker, marginBottom: spacing.lg },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.md },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { ...typography.h1, color: colors.white },
  name: { ...typography.h4, color: colors.gray800 },
  email: { ...typography.bodySmall, color: colors.gray500, marginTop: 2 },
  phone: { ...typography.bodySmall, color: colors.gray500, marginTop: 2 },
  infoCard: { marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { ...typography.bodySmall, color: colors.gray500 },
  infoValue: { ...typography.bodySmallMedium, color: colors.gray800 },
  divider: { height: 1, backgroundColor: colors.gray100, marginVertical: spacing.sm },
  menuCard: { marginBottom: spacing.md },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
  },
  menuLabel: { flex: 1, ...typography.bodySmallMedium, color: colors.gray800 },
});
