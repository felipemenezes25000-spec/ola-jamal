import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TouchableOpacity,
  InteractionManager,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, shadows, doctorDS } from '../../lib/themeDoctor';
import { uiTokens } from '../../lib/ui/tokens';
import { useAuth } from '../../contexts/AuthContext';

export default function PatientProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          setLogoutLoading(true);
          signOut()
            .catch(() => {})
            .finally(() => {
              setLogoutLoading(false);
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => router.replace('/'), 150);
              });
            });
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
        { icon: 'settings-outline' as const, label: 'Configurações', onPress: () => router.push('/settings') },
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
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{user?.name || 'Carregando...'}</Text>
        <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">{user?.email || ''}</Text>
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
          <View style={styles.menuItemsColumn}>
            {section.items.map((item) => (
              <Pressable
                key={item.label}
                style={({ pressed }) => [styles.menuItemCard, pressed && styles.menuItemPressed]}
                onPress={item.onPress}
                accessibilityRole="button"
              >
                <View style={styles.menuIconWrap}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <View style={styles.menuChevronWrap}>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={logoutLoading}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        {logoutLoading ? (
          <ActivityIndicator size="small" color={colors.error} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.version}>RenoveJá+ v1.0.0</Text>

      <View style={{ height: insets.bottom + 24 }} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
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
    backgroundColor: colors.surface,
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: -30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    padding: 16,
    ...shadows.cardLg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },

  // Menu
  menuSection: {
    marginTop: 20,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  sectionTitle: {
    fontSize: 11,
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
    ...shadows.card,
  },
  menuItemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  menuChevronWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 26,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
  },

  // Version
  version: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
});
