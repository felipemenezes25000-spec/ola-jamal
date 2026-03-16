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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn } from '../../components/ui/FadeIn';
import { showToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { updateAvatar } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/api-client';
import type { DesignColors } from '../../lib/designSystem';
import { haptics } from '../../lib/haptics';
import { doctorDS } from '../../lib/themeDoctor';
import { motionTokens } from '../../lib/ui/motion';
import { useAppTheme } from '../../lib/ui/useAppTheme';

const isNewArch =
  typeof (global as unknown as { __turboModuleRegistry?: unknown }).__turboModuleRegistry !==
  'undefined';
if (Platform.OS === 'android' && !isNewArch && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const pad = doctorDS.screenPaddingHorizontal;

// ── Configuração de menu com cor por categoria ─────────────────
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
  items: MenuItemDef[];
}

function buildMenuSections(
  colors: DesignColors,
  doctor: { crm?: string; crmState?: string; specialty?: string } | null,
): MenuSectionDef[] {
  return [
    {
      title: 'PROFISSIONAL',
      items: [
        {
          icon: 'shield-checkmark',
          label: 'Certificado Digital',
          route: '/certificate/upload',
          iconColor: colors.info,
          iconBg: colors.infoLight,
        },
        {
          icon: 'medical',
          label: 'Especialidade',
          value: doctor?.specialty ?? '—',
          iconColor: colors.success,
          iconBg: colors.successLight,
        },
      ],
    },
    {
      title: 'CONTA',
      items: [
        {
          icon: 'lock-closed-outline',
          label: 'Alterar Senha',
          route: '/change-password',
          iconColor: colors.primary,
          iconBg: colors.primarySoft,
        },
        {
          icon: 'settings-outline',
          label: 'Configurações',
          route: '/settings',
          iconColor: colors.textSecondary,
          iconBg: colors.surfaceSecondary,
        },
      ],
    },
    {
      title: 'SUPORTE',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Ajuda e FAQ',
          route: '/help-faq',
          iconColor: colors.warning,
          iconBg: colors.warningLight,
        },
        {
          icon: 'document-text-outline',
          label: 'Termos de Uso',
          route: '/terms',
          iconColor: colors.textMuted,
          iconBg: colors.surfaceSecondary,
        },
        {
          icon: 'information-circle-outline',
          label: 'Sobre',
          route: '/about',
          iconColor: colors.textMuted,
          iconBg: colors.surfaceSecondary,
        },
        ...(__DEV__
          ? [
              {
                icon: 'mic' as const,
                label: 'Testar transcrição IA',
                route: '/(doctor)/transcription-test',
                iconColor: colors.accent,
                iconBg: colors.accentSoft,
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
  const { user, doctorProfile: doctor, signOut, refreshUser } = useAuth();
  const { colors, gradients, scheme } = useAppTheme({ role: 'doctor' });
  const isDark = scheme === 'dark';
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);

  const menuSections = useMemo(() => buildMenuSections(colors, doctor ?? null), [colors, doctor]);

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
    <ScrollView style={[styles.container]} showsVerticalScrollIndicator={false}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* ── HEADER GRADIENTE ── */}
      <LinearGradient
        colors={gradients.doctorHeader as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 28 }]}
      >
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
                <Text style={[styles.avatarText, { color: colors.headerOverlayText }]}>
                  {initials}
                </Text>
              )}
            </View>
          </View>
          {avatarLoading ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color={colors.headerOverlayText} />
            </View>
          ) : (
            <View
              style={[
                styles.cameraBtn,
                { backgroundColor: colors.primary, borderColor: colors.headerOverlayText },
              ]}
            >
              <Ionicons name="camera" size={14} color={colors.headerOverlayText} />
            </View>
          )}
        </Pressable>

        {/* Nome + email */}
        <Text style={[styles.headerName, { color: colors.headerOverlayText }]} numberOfLines={1}>
          Dr(a). {firstName}
        </Text>
        <Text
          style={[styles.headerEmail, { color: colors.headerOverlayTextMuted }]}
          numberOfLines={1}
        >
          {user?.email || ''}
        </Text>

        {/* Card de identidade profissional */}
        {doctor && (
          <View
            style={[
              styles.identityCard,
              {
                backgroundColor: colors.headerOverlaySurface,
                borderColor: colors.headerOverlayBorder,
              },
            ]}
          >
            <View style={styles.identityItem}>
              <Ionicons name="card-outline" size={14} color={colors.headerOverlayTextMuted} />
              <Text style={[styles.identityLabel, { color: colors.headerOverlayTextMuted }]}>
                CRM
              </Text>
              <Text style={[styles.identityValue, { color: colors.headerOverlayText }]}>
                {doctor.crm}/{doctor.crmState}
              </Text>
            </View>
            <View
              style={[styles.identityDivider, { backgroundColor: colors.headerOverlayDivider }]}
            />
            <View style={styles.identityItem}>
              <Ionicons name="medical-outline" size={14} color={colors.headerOverlayTextMuted} />
              <Text style={[styles.identityLabel, { color: colors.headerOverlayTextMuted }]}>
                Especialidade
              </Text>
              <Text
                style={[styles.identityValue, { color: colors.headerOverlayText }]}
                numberOfLines={1}
              >
                {doctor.specialty}
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* ── MENU ── */}
      <FadeIn visible {...motionTokens.fade.doctorSection} delay={50} fill={false}>
        {menuSections.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
            <View
              style={[
                styles.menuGroup,
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
              ]}
            >
              {section.items.map((item, idx) => (
                <React.Fragment key={item.label}>
                  {idx > 0 && (
                    <View style={[styles.itemDivider, { backgroundColor: colors.borderLight }]} />
                  )}
                  {item.route != null ? (
                    <Pressable
                      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
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
                      <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                    </Pressable>
                  ) : (
                    <View style={styles.menuItem}>
                      <View style={[styles.menuIconWrap, { backgroundColor: item.iconBg }]}>
                        <Ionicons name={item.icon} size={19} color={item.iconColor} />
                      </View>
                      <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                      <Text
                        style={[styles.menuValue, { color: colors.textMuted }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
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
            style={[
              styles.logoutBtn,
              { backgroundColor: colors.errorLight, borderColor: colors.error + '30' },
            ]}
            onPress={() => {
              haptics.selection();
              handleLogout();
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Sair da conta</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>
          RenoveJá+ v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
        <View style={{ height: insets.bottom + 28 }} />
      </FadeIn>

      {/* ── MODAL PREVIEW AVATAR ── */}
      <Modal
        visible={!!avatarPreviewUri}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewUri(null)}
      >
        <View style={styles.previewOverlay}>
          <View style={[styles.previewCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.previewTitle, { color: colors.text }]}>Pré-visualizar foto</Text>
            <Text style={[styles.previewSubtitle, { color: colors.textMuted }]}>
              Confira como sua foto ficará no perfil.
            </Text>

            <View
              style={[
                styles.previewAvatarCircle,
                { borderColor: colors.primarySoft, backgroundColor: colors.background },
              ]}
            >
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
                style={[
                  styles.previewBtn,
                  styles.previewBtnGhost,
                  { borderColor: colors.borderLight, backgroundColor: colors.background },
                ]}
                onPress={() => {
                  setAvatarPreviewUri(null);
                  void pickAvatar();
                }}
                disabled={avatarLoading}
              >
                <Text style={[styles.previewBtnText, { color: colors.textMuted }]}>
                  Escolher outra
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.previewBtn,
                  { backgroundColor: colors.primary, opacity: avatarLoading ? 0.7 : 1 },
                ]}
                onPress={() => {
                  void saveAvatar();
                }}
                disabled={avatarLoading}
              >
                {avatarLoading ? (
                  <ActivityIndicator size="small" color={colors.headerOverlayText} />
                ) : (
                  <Text style={[styles.previewBtnText, { color: colors.headerOverlayText }]}>
                    Salvar foto
                  </Text>
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
              <Ionicons name="camera-outline" size={15} color={colors.primary} />
              <Text style={[styles.previewCameraText, { color: colors.primary }]}>
                Tirar nova foto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function makeStyles(colors: DesignColors, _isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
      alignItems: 'center',
      paddingBottom: 28,
      paddingHorizontal: pad,
      borderBottomLeftRadius: 36,
      borderBottomRightRadius: 36,
    },

    // Avatar
    avatarWrap: { position: 'relative', marginBottom: 14 },
    avatarRing: {
      width: 92,
      height: 92,
      borderRadius: 46,
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
    avatarImage: { width: '100%', height: '100%' },
    avatarText: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 1,
    },
    avatarOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.38)',
      borderRadius: 44,
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
      borderWidth: 2,
    },

    headerName: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    headerEmail: {
      fontSize: 13,
      fontWeight: '500',
      marginTop: 3,
      marginBottom: 16,
    },

    // Identity card
    identityCard: {
      flexDirection: 'row',
      borderRadius: 16,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignSelf: 'stretch',
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
    },
    identityValue: {
      fontSize: 12,
      fontWeight: '700',
    },
    identityDivider: {
      width: 1,
      alignSelf: 'stretch',
      marginHorizontal: 12,
    },

    // Menu
    menuSection: {
      marginTop: 28,
      paddingHorizontal: pad,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 10,
      marginLeft: 2,
    },
    menuGroup: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
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
    },
    menuValue: {
      fontSize: 13,
      maxWidth: '45%',
      textAlign: 'right',
      flexShrink: 1,
    },
    itemDivider: {
      height: 1,
      marginLeft: 14 + 38 + 13,
    },

    // Logout
    logoutSection: {
      paddingHorizontal: pad,
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
    },
    logoutText: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.4,
    },

    version: {
      fontSize: 11,
      textAlign: 'center',
      marginTop: 16,
      letterSpacing: 0.8,
    },

    // Modal
    previewOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    previewCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 16,
      padding: 20,
    },
    previewTitle: {
      fontSize: 18,
      fontWeight: '700',
    },
    previewSubtitle: {
      marginTop: 4,
      fontSize: 13,
    },
    previewAvatarCircle: {
      alignSelf: 'center',
      marginTop: 16,
      width: 120,
      height: 120,
      borderRadius: 60,
      overflow: 'hidden',
      borderWidth: 3,
    },
    previewAvatarImage: { width: '100%', height: '100%' },
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
}
