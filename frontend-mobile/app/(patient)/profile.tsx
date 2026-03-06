import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  TouchableOpacity,
  InteractionManager,
  ActivityIndicator,
  Modal,
  Image,
  LayoutAnimation,
  UIManager,
} from 'react-native';

// Habilitar LayoutAnimation no Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { shadows } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { uiTokens } from '../../lib/ui/tokens';
import { useAuth } from '../../contexts/AuthContext';
import { useTriageEval } from '../../hooks/useTriageEval';
import { haptics } from '../../lib/haptics';
import { FadeIn } from '../../components/ui/FadeIn';
import { motionTokens } from '../../lib/ui/motion';
import { updateAvatar } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

export default function PatientProfile() {
  const router = useRouter();
  useTriageEval({ context: 'profile', step: 'entry', role: 'patient' });
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshUser } = useAuth();
  const { colors, gradients } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);

  const doLogout = () => {
    setLogoutLoading(true);
    signOut()
      .catch(() => {})
      .finally(() => {
        setLogoutLoading(false);
        if (Platform.OS === 'web') {
          router.replace('/');
        } else {
          InteractionManager.runAfterInteractions(() => {
            setTimeout(() => router.replace('/'), 150);
          });
        }
      });
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Tem certeza que deseja sair?')) {
        doLogout();
      }
    } else {
      Alert.alert('Sair', 'Tem certeza que deseja sair?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const firstName = user?.name?.split(' ')[0] || '';
  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('')
    : '?';

  const pickAvatarFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para escolher sua foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const { uri } = result.assets[0];
    setAvatarPreviewUri(uri);
  };

  const takeAvatarPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para tirar sua foto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;
    const { uri } = result.assets[0];
    setAvatarPreviewUri(uri);
  };

  const pickAvatar = async () => {
    Alert.alert('Foto de perfil', 'Como você quer atualizar sua foto?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Câmera', onPress: () => { void takeAvatarPhoto(); } },
      { text: 'Galeria', onPress: () => { void pickAvatarFromGallery(); } },
    ]);
  };

  const saveAvatar = async () => {
    if (!avatarPreviewUri) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAvatarLoading(true);
    try {
      await updateAvatar(avatarPreviewUri);
      await refreshUser();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAvatarPreviewUri(null);
      setAvatarImageError(false);
      showToast({ message: 'Foto atualizada!', type: 'success' });
    } catch (e: unknown) {
      showToast({ message: (e as Error)?.message ?? 'Erro ao atualizar foto.', type: 'error' });
    } finally {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAvatarLoading(false);
    }
  };

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
        colors={gradients.patientHeader as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Pressable
          style={({ pressed }) => [styles.avatarWrap, pressed && styles.avatarWrapPressed]}
          onPress={() => {
            haptics.selection();
            void pickAvatar();
          }}
          disabled={avatarLoading}
          accessibilityRole="button"
          accessibilityLabel="Alterar foto de perfil"
        >
          <View style={styles.avatarCircle}>
            {user?.avatarUrl && !avatarImageError ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatarImage}
                resizeMode="cover"
                onError={() => setAvatarImageError(true)}
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          {avatarLoading ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color={colors.white} />
            </View>
          ) : (
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={16} color={colors.white} />
            </View>
          )}
        </Pressable>
        <Text style={styles.userName} numberOfLines={1} ellipsizeMode="tail">{user?.name || 'Carregando...'}</Text>
        <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">{user?.email || ''}</Text>
      </LinearGradient>

      <FadeIn visible {...motionTokens.fade.patientSection} delay={40} fill={false}>
      {/* Info Card - overlapping */}
      <View style={styles.infoCard}>
        <InfoRow icon="call-outline" label="Telefone" value={user?.phone || 'Não informado'} />
        <View style={styles.divider} />
        <InfoRow
          icon="finger-print-outline"
          label="CPF"
          value={user?.cpf ? `***.***.**${String(user.cpf).replace(/\D/g, '').slice(-3).replace(/^(\d)/, '-$1')}` : 'Não informado'}
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
                onPress={() => {
                  haptics.selection();
                  item.onPress();
                }}
                accessibilityRole="button"
                accessibilityLabel={item.label}
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
        onPress={() => {
          haptics.selection();
          handleLogout();
        }}
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

      <Text style={styles.version}>RenoveJá+ v{require('expo-constants').default?.expoConfig?.version ?? '1.0.0'}</Text>

      <View style={{ height: insets.bottom + 24 }} />
      </FadeIn>

      <Modal
        visible={!!avatarPreviewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewUri(null)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Pré-visualizar foto</Text>
            <Text style={styles.previewSubtitle}>Confira como sua foto ficará no perfil.</Text>

            <View style={styles.previewAvatarCircle}>
              {avatarPreviewUri ? (
                <Image source={{ uri: avatarPreviewUri }} style={styles.previewAvatarImage} resizeMode="cover" />
              ) : null}
            </View>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[styles.previewBtn, styles.previewBtnGhost]}
                onPress={() => {
                  setAvatarPreviewUri(null);
                  void pickAvatar();
                }}
                disabled={avatarLoading}
              >
                <Text style={styles.previewBtnGhostText}>Recortar / escolher outra</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.previewBtn, styles.previewBtnPrimary, avatarLoading && { opacity: 0.7 }]}
                onPress={() => { void saveAvatar(); }}
                disabled={avatarLoading}
              >
                {avatarLoading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.previewBtnPrimaryText}>Salvar foto</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.previewInlineCamera}
              onPress={() => {
                setAvatarPreviewUri(null);
                void takeAvatarPhoto();
              }}
              disabled={avatarLoading}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={styles.previewInlineCameraText}>Tirar nova foto agora</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={{ fontSize: 13, color: colors.textMuted, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarWrapPressed: {
    opacity: 0.9,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
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
    marginTop: -18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    padding: 16,
    ...shadows.card,
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
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItemsColumn: {
    gap: 6,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorLight,
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

  // Avatar preview modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  previewCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    ...shadows.card,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  previewSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  previewAvatarCircle: {
    alignSelf: 'center',
    marginTop: 16,
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.primarySoft,
    backgroundColor: colors.background,
  },
  previewAvatarImage: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  previewBtn: {
    flex: 1,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  previewBtnGhost: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  previewBtnGhostText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  previewBtnPrimary: {
    backgroundColor: colors.primary,
  },
  previewBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  previewInlineCamera: {
    marginTop: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  previewInlineCameraText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  });
}
