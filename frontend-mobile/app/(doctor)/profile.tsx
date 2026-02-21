import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TouchableOpacity,
  InteractionManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, gradients, doctorDS } from '../../lib/themeDoctor';
const pad = doctorDS.screenPaddingHorizontal;
import { useAuth } from '../../contexts/AuthContext';
export default function DoctorProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, doctorProfile: doctor, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          signOut()
            .catch(() => {})
            .finally(() => {
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => router.replace('/'), 150);
              });
            });
        },
      },
    ]);
  };

  const firstName = user?.name?.split(' ')[0] || 'Médico';
  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('')
    : '?';

  const menuSections = [
    {
      title: 'Profissional',
      items: [
        { icon: 'shield-checkmark' as const, label: 'Certificado Digital', route: '/certificate/upload', color: colors.success },
        { icon: 'medical' as const, label: 'Especialidade', route: undefined, color: colors.primary, value: doctor?.specialty ?? '—' },
      ],
    },
    {
      title: 'Conta',
      items: [
        { icon: 'lock-closed-outline' as const, label: 'Alterar Senha', route: '/change-password', color: colors.primary },
        { icon: 'settings-outline' as const, label: 'Configurações', route: '/settings', color: colors.textSecondary },
      ],
    },
    {
      title: 'Suporte',
      items: [
        { icon: 'help-circle-outline' as const, label: 'Ajuda e FAQ', route: '/help-faq', color: colors.secondary },
        { icon: 'document-text-outline' as const, label: 'Termos de Uso', route: '/terms', color: colors.textMuted },
        { icon: 'information-circle-outline' as const, label: 'Sobre', route: '/about', color: colors.primary },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header: gradiente oficial */}
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">Dr(a). {firstName}</Text>
        <Text style={styles.headerEmail} numberOfLines={1} ellipsizeMode="tail">{user?.email || ''}</Text>
        {doctor && (
          <View style={styles.crmBadge}>
            <Ionicons name="medical" size={12} color="#fff" />
            <Text style={styles.crmText}>CRM {doctor.crm}/{doctor.crmState} • {doctor.specialty}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Menu Sections */}
      {menuSections.map((section) => (
        <View key={section.title} style={styles.menuSection}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuItemsColumn}>
            {section.items.map((item) =>
              item.route != null ? (
                <Pressable
                  key={item.label}
                  style={({ pressed }) => [styles.menuItemCard, pressed && styles.menuItemPressed]}
                  onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                  accessibilityRole="button"
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <View style={styles.menuChevronWrap}>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
              ) : (
                <View key={item.label} style={styles.menuItemCard}>
                  <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuValue} numberOfLines={1} ellipsizeMode="tail">
                    {(item as { value?: string }).value ?? '—'}
                  </Text>
                </View>
              )
            )}
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      <Text style={styles.version}>RenoveJá+ v1.0.0</Text>
      <View style={{ height: insets.bottom + 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    alignItems: 'center',
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  headerName: {
    fontSize: 22,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#fff',
  },
  headerEmail: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  crmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  crmText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: '#fff',
  },

  // Menu
  menuSection: {
    marginTop: 20,
    paddingHorizontal: pad,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItemsColumn: {
    gap: 8,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.fontFamily.medium,
    fontWeight: '500',
    color: colors.text,
  },
  menuValue: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    minWidth: 0,
  },
  menuChevronWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: pad,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 15,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '700',
    color: colors.error,
  },

  version: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
});
