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
import { useAuth } from '../../contexts/AuthContext';
import { DoctorCard } from '../../components/ui/DoctorCard';

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
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName}>Dr(a). {firstName}</Text>
        <Text style={styles.headerEmail}>{user?.email || ''}</Text>
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
          <DoctorCard style={styles.menuCardWrap}>
            {section.items.map((item, idx) => (
              <React.Fragment key={item.label}>
                {item.route != null ? (
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                  >
                    <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}15` }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : (
                  <View style={styles.menuItem}>
                    <View style={[styles.menuIconWrap, { backgroundColor: `${item.color}15` }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuValue} numberOfLines={1}>{(item as { value?: string }).value ?? '—'}</Text>
                  </View>
                )}
                {idx < section.items.length - 1 && <View style={styles.menuDivider} />}
              </React.Fragment>
            ))}
          </DoctorCard>
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
      <View style={{ height: 100 }} />
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
    paddingHorizontal: 20,
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
  menuCardWrap: {},
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuItemPressed: {
    backgroundColor: colors.muted,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 140,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginLeft: 62,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
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
