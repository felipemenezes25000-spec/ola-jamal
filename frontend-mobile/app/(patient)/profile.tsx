import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../lib/theme';
import { useAuth } from '../../contexts/AuthContext';

const c = theme.colors;
const s = theme.spacing;

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

  const firstName = user?.name?.split(' ')[0] || '';
  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('')
    : '?';

  const menuSections = [
    {
      title: 'Conta',
      items: [
        { icon: 'person-outline' as const, label: 'Editar Perfil', onPress: () => router.push('/settings') },
        { icon: 'lock-closed-outline' as const, label: 'Alterar Senha', onPress: () => router.push('/change-password') },
      ],
    },
    {
      title: 'Suporte',
      items: [
        { icon: 'help-circle-outline' as const, label: 'Ajuda e FAQ', onPress: () => router.push('/help-faq') },
        { icon: 'chatbubble-outline' as const, label: 'Fale Conosco', onPress: () => router.push('/help-faq') },
      ],
    },
    {
      title: 'Legal',
      items: [
        { icon: 'document-text-outline' as const, label: 'Termos de Uso', onPress: () => router.push('/terms') },
        { icon: 'shield-outline' as const, label: 'Política de Privacidade', onPress: () => router.push('/privacy') },
        { icon: 'information-circle-outline' as const, label: 'Sobre', onPress: () => router.push('/about') },
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with gradient */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Carregando...'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </LinearGradient>

      {/* Info Card - overlapping */}
      <View style={styles.infoCard}>
        <InfoRow icon="call-outline" label="Telefone" value={user?.phone || 'Não informado'} />
        <View style={styles.divider} />
        <InfoRow
          icon="finger-print-outline"
          label="CPF"
          value={user?.cpf ? `***.***.${String(user.cpf).replace(/\D/g, '').slice(-6)}` : 'Não informado'}
        />
        {user?.city && (
          <>
            <View style={styles.divider} />
            <InfoRow icon="location-outline" label="Cidade" value={`${user.city}${user.state ? `, ${user.state}` : ''}`} />
          </>
        )}
      </View>

      {/* Menu Sections */}
      {menuSections.map((section) => (
        <View key={section.title} style={styles.menuSection}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item, idx) => (
              <React.Fragment key={item.label}>
                <Pressable
                  style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                  onPress={item.onPress}
                >
                  <View style={styles.menuIconWrap}>
                    <Ionicons name={item.icon} size={20} color={c.primary.main} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={c.text.tertiary} />
                </Pressable>
                {idx < section.items.length - 1 && <View style={styles.menuDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <Pressable
        style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.8 }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color={c.status.error} />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </Pressable>

      <Text style={styles.version}>RenoveJá+ v1.0.0</Text>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={c.text.tertiary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background.default,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingBottom: 50,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Info Card
  infoCard: {
    backgroundColor: c.background.paper,
    marginHorizontal: 20,
    marginTop: -30,
    borderRadius: 18,
    padding: 16,
    ...theme.shadows.elevated,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: c.text.tertiary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: c.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: c.border.light,
  },

  // Menu
  menuSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: c.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: c.background.paper,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuItemPressed: {
    backgroundColor: c.background.secondary,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: c.text.primary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: c.border.light,
    marginLeft: 62,
  },

  // Logout
  logoutButton: {
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
    fontWeight: '700',
    color: c.status.error,
  },

  // Version
  version: {
    fontSize: 12,
    color: c.text.tertiary,
    textAlign: 'center',
    marginTop: 16,
  },
});
