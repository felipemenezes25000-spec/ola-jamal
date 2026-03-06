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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { typography, gradients, doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
const pad = doctorDS.screenPaddingHorizontal;
import { useAuth } from '../../contexts/AuthContext';
import { updateAvatar } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';
import { haptics } from '../../lib/haptics';
import { FadeIn } from '../../components/ui/FadeIn';
import { motionTokens } from '../../lib/ui/motion';

export default function DoctorProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, doctorProfile: doctor, signOut, refreshUser } = useAuth();
  const { colors } = useAppTheme({ role: 'doctor' });
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [avatarImageError, setAvatarImageError] = useState(false);

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
      if (window.confirm('Deseja realmente sair?')) {
        doLogout();
      }
    } else {
      Alert.alert('Sair', 'Deseja realmente sair?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Médico';
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
    setAvatarPreviewUri(result.assets[0].uri);
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
    setAvatarPreviewUri(result.assets[0].uri);
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
      title: 'PROFISSIONAL',
      items: [
        { icon: 'shield-checkmark' as const, label: 'Certificado Digital', route: '/certificate/upload' },
        { icon: 'medical' as const, label: 'Especialidade', route: undefined, value: doctor?.specialty ?? '\u2014' },
      ],
    },
    {
      title: 'CONTA',
      items: [
        { icon: 'lock-closed-outline' as const, label: 'Alterar Senha', route: '/change-password' },
        { icon: 'settings-outline' as const, label: 'Configurações', route: '/settings' },
      ],
    },
    {
      title: 'SUPORTE',
      items: [
        { icon: 'help-circle-outline' as const, label: 'Ajuda e FAQ', route: '/help-faq' },
        { icon: 'document-text-outline' as const, label: 'Termos de Uso', route: '/terms' },
        { icon: 'information-circle-outline' as const, label: 'Sobre', route: '/about' },
        ...(__DEV__ ? [{ icon: 'mic' as const, label: 'Testar transcrição IA', route: '/(doctor)/transcription-test' }] : []),
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 24 }]}
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
        <Text style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">Dr(a). {firstName}</Text>
        <Text style={styles.headerEmail} numberOfLines={1} ellipsizeMode="tail">{user?.email || ''}</Text>
        {doctor && (
          <View style={styles.crmBadge}>
            <Ionicons name="medical" size={12} color={colors.white} />
            <Text style={styles.crmText}>CRM {doctor.crm}/{doctor.crmState} {'\u00B7'} {doctor.specialty}</Text>
          </View>
        )}
      </LinearGradient>

      <FadeIn visible {...motionTokens.fade.doctorSection} delay={40} fill={false}>
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
                  onPress={() => {
                    haptics.selection();
                    router.push(item.route as Parameters<typeof router.push>[0]);
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
              ) : (
                <View key={item.label} style={styles.menuItemCard}>
                  <View style={styles.menuIconWrap}>
                    <Ionicons name={item.icon} size={20} color={colors.primary} />
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

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => {
          haptics.selection();
          handleLogout();
        }}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.logoutText}>Sair da conta</Text>
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

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    alignItems: 'center',
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarWrapPressed: {
    opacity: 0.9,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 34,
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
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 1,
  },
  headerName: {
    fontSize: 18,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },
  headerEmail: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  crmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
  },
  crmText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: colors.white,
    letterSpacing: 0.3,
  },

  menuSection: {
    marginTop: 18,
    paddingHorizontal: pad,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuItemsColumn: {
    gap: 6,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
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
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    fontWeight: '500',
    color: colors.text,
  },
  menuValue: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    minWidth: 0,
    flexShrink: 1,
    maxWidth: '50%',
    textAlign: 'right',
  },
  menuChevronWrap: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: pad,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.errorLight,
  },
  logoutText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 0.6,
  },

  version: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 1,
  },

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
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  previewSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
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
    color: colors.textMuted,
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
