import React, { useState, useEffect } from 'react';
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
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, typography, gradients, doctorDS } from '../../lib/themeDoctor';
const pad = doctorDS.screenPaddingHorizontal;
import { useAuth } from '../../contexts/AuthContext';
import { updateDoctorProfile } from '../../lib/api';
import { showToast } from '../../components/ui/Toast';

export default function DoctorProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, doctorProfile: doctor, signOut, refreshDoctorProfile } = useAuth();
  const [professionalAddress, setProfessionalAddress] = useState('');
  const [professionalPhone, setProfessionalPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doctor) {
      setProfessionalAddress(doctor.professionalAddress ?? '');
      setProfessionalPhone(doctor.professionalPhone ?? '');
    }
  }, [doctor]);

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

  const saveRecipeData = async () => {
    setSaving(true);
    try {
      await updateDoctorProfile({
        professionalAddress: professionalAddress.trim() || null,
        professionalPhone: professionalPhone.trim() || null,
      });
      await refreshDoctorProfile();
      showToast({ message: 'Dados para receita salvos.', type: 'success' });
    } catch (e: unknown) {
      showToast({ message: (e as Error)?.message ?? 'Erro ao salvar.', type: 'error' });
    } finally {
      setSaving(false);
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
      ],
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 24 }]}
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName} numberOfLines={1} ellipsizeMode="tail">DR(A). {firstName.toUpperCase()}</Text>
        <Text style={styles.headerEmail} numberOfLines={1} ellipsizeMode="tail">{user?.email || ''}</Text>
        {doctor && (
          <View style={styles.crmBadge}>
            <Ionicons name="medical" size={12} color="#fff" />
            <Text style={styles.crmText}>CRM {doctor.crm}/{doctor.crmState} {'\u00B7'} {doctor.specialty}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Dados para assinar receitas */}
      <View style={styles.recipeDataCard}>
        <Text style={styles.recipeDataTitle}>DADOS PARA ASSINAR RECEITAS</Text>
        <Text style={styles.recipeDataHint}>
          Endereço e telefone profissional são obrigatórios para receita simples (CFM).
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Endereço profissional completo"
          placeholderTextColor={colors.textMuted}
          value={professionalAddress}
          onChangeText={setProfessionalAddress}
          editable={!saving}
        />
        <TextInput
          style={styles.input}
          placeholder="Telefone profissional"
          placeholderTextColor={colors.textMuted}
          value={professionalPhone}
          onChangeText={setProfessionalPhone}
          keyboardType="phone-pad"
          editable={!saving}
        />
        <TouchableOpacity
          style={[styles.saveRecipeDataBtn, saving && styles.saveRecipeDataBtnDisabled]}
          onPress={saveRecipeData}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveRecipeDataBtnText}>SALVAR</Text>
          )}
        </TouchableOpacity>
      </View>

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
        onPress={handleLogout}
        activeOpacity={0.8}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.error} />
        <Text style={styles.logoutText}>SAIR DA CONTA</Text>
      </TouchableOpacity>

      <Text style={styles.version}>RENOVEJA+ V1.0.0</Text>
      <View style={{ height: insets.bottom + 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    alignItems: 'center',
    paddingBottom: 32,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  headerName: {
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#fff',
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
    fontSize: 11,
    fontFamily: typography.fontFamily.semibold,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },

  recipeDataCard: {
    marginTop: 24,
    marginHorizontal: pad,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  recipeDataTitle: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  recipeDataHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  saveRecipeDataBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  saveRecipeDataBtnDisabled: {
    opacity: 0.7,
  },
  saveRecipeDataBtnText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.6,
  },

  menuSection: {
    marginTop: 24,
    paddingHorizontal: pad,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuItemsColumn: {
    gap: 8,
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
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
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 13,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 0.6,
  },

  version: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 1,
  },
});
