import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { updateAvatar } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-client';
import { haptics } from '../../lib/haptics';
import { motionTokens } from '../../lib/ui/motion';

const isNewArch =
  typeof (global as unknown as { __turboModuleRegistry?: unknown }).__turboModuleRegistry !==
  'undefined';
if (Platform.OS === 'android' && !isNewArch && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Design tokens ──────────────────────────────────────────────
const COLORS = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  // Header gradient
  gradient: ['#0C4A6E', '#075985', '#0369A1'] as [string, string, string],
  // Icon colors
  blue: '#0284C7',
  green: '#059669',
  yellow: '#D97706',
  gray: '#64748B',
  grayLight: '#94A3B8',
  // Icon backgrounds
  blueBg: '#E0F2FE',
  greenBg: '#D1FAE5',
  yellowBg: '#FEF3C7',
  grayBg: '#F1F5F9',
  // Accent (dev)
  accent: '#8B5CF6',
  accentBg: '#EDE9FE',
  // Logout
  redText: '#DC2626',
  redBg: '#FEF2F2',
  redBorder: '#FECACA',
} as const;

const TABLET_MAX_WIDTH = 560;

// ── Menu configuration ─────────────────────────────────────────
interface MenuItemDef {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  value?: string;
  iconColor: string;
  iconBg: string;
}

interface MenuSectionDef {
  title: string;
  trackingWidth: number;
  items: MenuItemDef[];
}

function buildMenuSections(
  doctor: { crm?: string; crmState?: string; specialty?: string } | null,
): MenuSectionDef[] {
  return [
    {
      title: 'PROFISSIONAL',
      trackingWidth: 1.2,
      items: [
        {
          icon: 'shield-checkmark',
          label: 'Certificado Digital',
          route: '/certificate/upload',
          iconColor: COLORS.blue,
          iconBg: COLORS.blueBg,
        },
        {
          icon: 'pulse',
          label: 'Especialidade',
          value: doctor?.specialty ?? '—',
          iconColor: COLORS.green,
          iconBg: COLORS.greenBg,
        },
      ],
    },
    {
      title: 'CONTA',
      trackingWidth: 1.0,
      items: [
        {
          icon: 'lock-closed',
          label: 'Alterar Senha',
          route: '/change-password',
          iconColor: COLORS.blue,
          iconBg: COLORS.blueBg,
        },
        {
          icon: 'settings-outline',
          label: 'Configurações',
          route: '/settings',
          iconColor: COLORS.gray,
          iconBg: COLORS.grayBg,
        },
      ],
    },
    {
      title: 'SUPORTE',
      trackingWidth: 0.8,
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Ajuda e FAQ',
          route: '/help-faq',
          iconColor: COLORS.yellow,
          iconBg: COLORS.yellowBg,
        },
        {
          icon: 'document-text-outline',
          label: 'Termos de Uso',
          route: '/terms',
          iconColor: COLORS.grayLight,
          iconBg: COLORS.grayBg,
        },
        {
          icon: 'information-circle-outline',
          label: 'Sobre',
          route: '/about',
          iconColor: COLORS.grayLight,
          iconBg: COLORS.grayBg,
        },
        ...(__DEV__
          ? [
              {
                icon: 'mic' as const,
                label: 'Testar transcrição IA',
                route: '/(doctor)/transcription-test',
                iconColor: COLORS.accent,
                iconBg: COLORS.accentBg,
              },
            ]
          : []),
      ],
    },
  ];
}

export default function DoctorProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { user, doctorProfile: doctor, signOut, refreshUser } = useAuth();

  const isTablet = screenWidth >= 768;
  const contentMaxWidth = isTablet ? TABLET_MAX_WIDTH : screenWidth;
  const horizontalPad = isTablet
    ? Math.max((screenWidth - TABLET_MAX_WIDTH) / 2, 20)
    : Math.max(screenWidth * 0.05, 16);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);

  const menuSections = useMemo(() => buildMenuSections(doctor ?? null), [doctor]);

  const doLogout = () => {
    signOut()
      .catch(() => {})
      .finally(() => {
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
      if (window.confirm('Deseja realmente sair?')) doLogout();
    } else {
      Alert.alert('Sair', 'Deseja realmente sair?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Médico';
  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join('')
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
    setAvatarPreviewUri(result.assets[0].uri);
  };

  const takeAvatarPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarPreviewUri(result.assets[0].uri);
  };

  const pickAvatar = async () => {
    Alert.alert('Foto de perfil', 'Como você quer atualizar sua foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Câmera',
        onPress: () => {
          void takeAvatarPhoto();
        },
      },
      {
        text: 'Galeria',
        onPress: () => {
          void pickAvatarFromGallery();
        },
      },
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
      showToast({ message: getApiErrorMessage(e) || 'Erro ao atualizar foto.', type: 'error' });
    } finally {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAvatarLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── HEADER GRADIENT ── */}
      <LinearGradient
        colors={COLORS.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 28 }]}
      >
        <View style={[styles.headerContent, { maxWidth: contentMaxWidth }]}>
          {/* Avatar */}
          <Pressable
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.85 }]}
            onPress={() => {
              haptics.selection();
              void pickAvatar();
            }}
            disabled={avatarLoading}
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
          >
            <View style={styles.avatarRing}>
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
            </View>
            {avatarLoading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View style={styles.cameraBtn}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          {/* Name + email */}
          <Text style={styles.headerName} numberOfLines={1}>
            Dr(a). {firstName}
          </Text>
          <Text style={styles.headerEmail} numberOfLines={1}>
            {user?.email || ''}
          </Text>

          {/* Professional identity card */}
          {doctor && (
            <View style={styles.identityCard}>
              <View style={styles.identityItem}>
                <Ionicons name="card-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.identityLabel}>CRM</Text>
                <Text style={styles.identityValue}>
                  {doctor.crm}/{doctor.crmState}
                </Text>
              </View>
              <View style={styles.identityDivider} />
              <View style={styles.identityItem}>
                <Ionicons name="medical-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.identityLabel}>Especialidade</Text>
                <Text style={styles.identityValue} numberOfLines={1}>
                  {doctor.specialty}
                </Text>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ── MENU SECTIONS ── */}
      <FadeIn visible {...motionTokens.fade.doctorSection} delay={50} fill={false}>
        <View style={[styles.menuContainer, { paddingHorizontal: horizontalPad }]}>
          {menuSections.map((section) => (
            <View key={section.title} style={styles.menuSection}>
              <Text
                style={[
                  styles.sectionTitle,
                  { letterSpacing: section.trackingWidth },
                ]}
              >
                {section.title}
              </Text>
              <View style={styles.menuGroup}>
                {section.items.map((item, idx) => (
                  <React.Fragment key={item.label}>
                    {idx > 0 && <View style={styles.itemDivider} />}
                    {item.route != null ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.menuItem,
                          pressed && styles.menuItemPressed,
                        ]}
                        onPress={() => {
                          haptics.selection();
                          router.push(item.route as Parameters<typeof router.push>[0]);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={item.label}
                      >
                        <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.icon} size={19} color={item.iconColor} />
                        </View>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
                      </Pressable>
                    ) : (
                      <View style={styles.menuItem}>
                        <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.icon} size={19} color={item.iconColor} />
                        </View>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        <Text style={styles.menuValue} numberOfLines={1} ellipsizeMode="tail">
                          {item.value ?? '—'}
                        </Text>
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}

          {/* Logout */}
          <View style={styles.logoutSection}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                haptics.selection();
                handleLogout();
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Sair da conta"
            >
              <Ionicons name="log-out-outline" size={18} color={COLORS.redText} />
              <Text style={styles.logoutText}>Sair da conta</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.version}>
            RenoveJá+ v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
          <View style={{ height: insets.bottom + 28 }} />
        </View>
      </FadeIn>

      {/* ── MODAL PREVIEW AVATAR ── */}
      <Modal
        visible={!!avatarPreviewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewUri(null)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Pré-visualizar foto</Text>
            <Text style={styles.previewSubtitle}>
              Confira como sua foto ficará no perfil.
            </Text>

            <View style={styles.previewAvatarCircle}>
              {avatarPreviewUri ? (
                <Image
                  source={{ uri: avatarPreviewUri }}
                  style={styles.previewAvatarImage}
                  resizeMode="cover"
                />
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
                <Text style={[styles.previewBtnText, { color: COLORS.textSecondary }]}>
                  Escolher outra
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.previewBtn,
                  styles.previewBtnPrimary,
                  { opacity: avatarLoading ? 0.7 : 1 },
                ]}
                onPress={() => {
                  void saveAvatar();
                }}
                disabled={avatarLoading}
              >
                {avatarLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.previewBtnText, { color: '#FFFFFF' }]}>Salvar foto</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.previewCameraLink}
              onPress={() => {
                setAvatarPreviewUri(null);
                void takeAvatarPhoto();
              }}
              disabled={avatarLoading}
            >
              <Ionicons name="camera-outline" size={15} color={COLORS.blue} />
              <Text style={[styles.previewCameraText, { color: COLORS.blue }]}>
                Tirar nova foto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // ── Header ──
  header: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  headerContent: {
    width: '100%',
    alignItems: 'center',
  },

  // ── Avatar (88px) ──
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  avatarCircle: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    fontWeight: '700',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    backgroundColor: '#0284C7',
  },

  // ── Header text ──
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#FFFFFF',
  },
  headerEmail: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
    marginBottom: 16,
    color: 'rgba(255,255,255,0.6)',
  },

  // ── Identity card ──
  identityCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  identityItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  identityLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.6)',
  },
  identityValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  identityDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ── Menu ──
  menuContainer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: TABLET_MAX_WIDTH,
  },
  menuSection: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10,
    marginLeft: 2,
    color: COLORS.textTertiary,
  },
  menuGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 14,
  },
  menuItemPressed: {
    opacity: 0.8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    flexShrink: 0,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  menuValue: {
    fontSize: 13,
    maxWidth: '45%',
    textAlign: 'right',
    flexShrink: 1,
    color: COLORS.textSecondary,
  },
  itemDivider: {
    height: 1,
    marginLeft: 14 + 40 + 13,
    backgroundColor: COLORS.borderLight,
  },

  // ── Logout ──
  logoutSection: {
    marginTop: 24,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: COLORS.redBg,
    borderColor: COLORS.redBorder,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: COLORS.redText,
  },

  // ── Version ──
  version: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 0.8,
    color: COLORS.textTertiary,
  },

  // ── Modal ──
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  previewCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    padding: 20,
    backgroundColor: COLORS.surface,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  previewAvatarCircle: {
    alignSelf: 'center',
    marginTop: 16,
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.blueBg,
    backgroundColor: COLORS.bg,
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
    borderRadius: 14,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnGhost: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  previewBtnPrimary: {
    backgroundColor: COLORS.blue,
  },
  previewBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewCameraLink: {
    marginTop: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  previewCameraText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
