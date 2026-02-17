import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../lib/theme';
import { useAuth } from '../../contexts/AuthContext';

export default function PatientProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setTimeout(() => router.replace('/(auth)/login'), 0);
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'person-outline' as const, label: 'Editar Perfil', onPress: () => router.push('/settings') },
    { icon: 'lock-closed-outline' as const, label: 'Alterar Senha', onPress: () => router.push('/change-password') },
    { icon: 'help-circle-outline' as const, label: 'Ajuda e FAQ', onPress: () => router.push('/help-faq') },
    { icon: 'document-text-outline' as const, label: 'Termos de Uso', onPress: () => router.push('/terms') },
    { icon: 'shield-outline' as const, label: 'Política de Privacidade', onPress: () => router.push('/privacy') },
    { icon: 'information-circle-outline' as const, label: 'Sobre', onPress: () => router.push('/about') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarLarge}>
          <Ionicons name="person" size={48} color={colors.primary} />
        </View>
        <Text style={styles.userName}>{user?.name || 'Carregando...'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Telefone</Text>
          <Text style={styles.infoValue}>{user?.phone || 'Não informado'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>CPF</Text>
          <Text style={styles.infoValue}>{user?.cpf ? `***.***.${String(user.cpf).replace(/\D/g, '').slice(-6)}` : 'Não informado'}</Text>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuCard}>
        {menuItems.map((item, index) => (
          <React.Fragment key={item.label}>
            <TouchableOpacity style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
              <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {index < menuItems.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={22} color={colors.error} />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  menuCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.error + '08',
    borderWidth: 1,
    borderColor: colors.error + '40',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },
});
