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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../../lib/themeDoctor';
import { useAuth } from '../../contexts/AuthContext';

export default function DoctorProfile() {
  const router = useRouter();
  const { user, doctorProfile: doctor, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setTimeout(() => router.replace('/'), 0);
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'shield-checkmark' as const, label: 'Certificado Digital', route: '/certificate/upload', color: colors.success },
    { icon: 'lock-closed' as const, label: 'Alterar Senha', route: '/change-password', color: colors.primary },
    { icon: 'settings' as const, label: 'Configurações', route: '/settings', color: colors.textSecondary },
    { icon: 'help-circle' as const, label: 'Ajuda e FAQ', route: '/help-faq', color: colors.secondary },
    { icon: 'information-circle' as const, label: 'Sobre', route: '/about', color: colors.primary },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar + Info */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.primary} />
          </View>
          <Text style={styles.name}>Dr. {user?.name || 'Médico'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          {doctor && (
            <View style={styles.doctorBadge}>
              <Text style={styles.doctorBadgeText}>CRM {doctor.crm}/{doctor.crmState} • {doctor.specialty}</Text>
            </View>
          )}
        </View>

        {/* Menu */}
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuItemBorder]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  profileCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.card,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  name: { fontSize: 20, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text },
  email: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginTop: 2 },
  doctorBadge: {
    marginTop: spacing.sm, backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.xl,
  },
  doctorBadgeText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  menuCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    marginBottom: spacing.md, ...shadows.card, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
  },
  logoutText: { fontSize: 15, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.error },
});
