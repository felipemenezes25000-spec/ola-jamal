import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';
import { DoctorCard } from '../../ui/DoctorCard';
import { AppButton } from '../../ui/AppButton';

interface SignFormCardProps {
  certPassword: string;
  onChangeCertPassword: (v: string) => void;
  onSign: () => void;
  onCancel: () => void;
  signing: boolean;
  profileBlocked: boolean;
  onGoToProfile: () => void;
  colors: DesignColors;
  scrollRef?: React.RefObject<ScrollView | null>;
}

export const SignFormCard = React.memo(function SignFormCard({
  certPassword, onChangeCertPassword, onSign, onCancel,
  signing, profileBlocked, onGoToProfile, colors, scrollRef,
}: SignFormCardProps) {
  return (
    <DoctorCard style={styles.card}>
      {profileBlocked && (
        <View style={[styles.banner, { backgroundColor: colors.warningLight }]}>
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={[styles.bannerText, { color: colors.text }]}>
            Complete endereço e telefone profissional no seu perfil para poder assinar.
          </Text>
          <TouchableOpacity
            style={[styles.bannerBtn, { backgroundColor: colors.warning }]}
            onPress={onGoToProfile}
            activeOpacity={0.8}
          >
            <Text style={[styles.bannerBtnText, { color: colors.white }]}>IR AO MEU PERFIL</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>ASSINATURA DIGITAL</Text>
      </View>

      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        Ao assinar, você confirma que revisou todo o documento. A assinatura digital é válida conforme ITI/ICP-Brasil.
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>Senha do certificado A1:</Text>
      <TextInput
        style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
        value={certPassword}
        onChangeText={onChangeCertPassword}
        placeholder="Senha"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="done"
        onSubmitEditing={onSign}
        placeholderTextColor={colors.textMuted}
        onFocus={() => {
          setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 400);
        }}
      />

      <View style={styles.btns}>
        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: colors.border }]}
          onPress={onCancel}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancelar</Text>
        </TouchableOpacity>
        <AppButton
          title="Assinar"
          variant="doctorPrimary"
          onPress={onSign}
          loading={signing}
          style={styles.confirmBtn}
        />
      </View>
    </DoctorCard>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: 16, borderWidth: 1.5 },
  banner: { padding: 12, borderRadius: 10, marginBottom: 12 },
  bannerText: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  bannerBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, alignSelf: 'flex-start' },
  bannerBtnText: { fontSize: 12, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '700', letterSpacing: 0.8 },
  desc: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 50,
    marginBottom: 16,
  },
  btns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 1 },
});
