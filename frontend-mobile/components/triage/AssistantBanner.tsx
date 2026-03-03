/**
 * AssistantBanner — Banner compacto da Dra. Renova (Camada A)
 *
 * Design pixel-perfect com theme.ts. Não-invasivo, colapsável.
 * Touch targets ≥ 44dp. Leitor de tela: accessibilityRole="alert".
 * Nunca cobre CTA, tab bar, ou botões. Max 2 linhas.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Modal } from 'react-native';
import Reanimated, {
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme, colors } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { useTriageAssistant } from '../../contexts/TriageAssistantProvider';
import { showToast } from '../ui/Toast';
import type { AvatarState, CTAAction, Severity } from '../../lib/triage/triage.types';

// ── Avatar palette (aligned with medical design system) ─────

const AVATAR: Record<AvatarState, { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  neutral:  { bg: theme.colors.primary.soft,    border: theme.colors.primary.main,    icon: 'medical',     iconColor: theme.colors.primary.dark },
  alert:    { bg: theme.colors.status.warningLight, border: theme.colors.status.warning,  icon: 'alert-circle', iconColor: '#D97706' },
  positive: { bg: theme.colors.secondary.soft,  border: theme.colors.secondary.main,  icon: 'checkmark-circle', iconColor: theme.colors.secondary.dark },
  thinking: { bg: theme.colors.accent.soft,     border: theme.colors.accent.main,     icon: 'sparkles',    iconColor: theme.colors.accent.dark },
};

const ACCENT: Record<Severity, string> = {
  info: theme.colors.primary.main,
  attention: theme.colors.status.warning,
  positive: theme.colors.secondary.main,
  neutral: theme.colors.text.tertiary,
};

interface AssistantBannerProps {
  /** Callback quando o CTA é pressionado */
  onAction?: (action: CTAAction) => void;
  /** Estilo extra para posicionamento */
  containerStyle?: object;
}

export function AssistantBanner({ onAction, containerStyle }: AssistantBannerProps) {
  const { current, dismiss, muteCurrent } = useTriageAssistant();
  const [expanded, setExpanded] = useState(false);

  const handleCTA = useCallback(() => {
    if (current?.cta) {
      onAction?.(current.cta);
      dismiss();
    }
  }, [current, onAction, dismiss]);

  const handleLongPress = useCallback(async () => {
    if (current?.canMute) {
      await muteCurrent();
      showToast({ message: 'Mensagem silenciada. Reative em Configurações.', type: 'info' });
    }
  }, [current, muteCurrent]);

  if (!current) return null;

  const av = AVATAR[current.avatarState];
  const accent = ACCENT[current.severity];

  return (
      <Reanimated.View
        entering={FadeInDown.duration(350).springify().damping(18).stiffness(140)}
        exiting={FadeOutUp.duration(200)}
        style={[styles.container, containerStyle]}
        accessibilityRole="alert"
        accessibilityLabel={`Assistente de triagem: ${current.text}`}
      >
      {/* Accent stripe */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <Pressable
        style={styles.inner}
        onPress={() => setExpanded(true)}
        onLongPress={handleLongPress}
        delayLongPress={800}
        accessibilityHint={current.canMute ? 'Segure para silenciar esta mensagem' : undefined}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: av.bg, borderColor: av.border }]}>
          <Ionicons name={av.icon} size={15} color={av.iconColor} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Dra. Renova</Text>
            {current.isPersonalized && (
              <View style={styles.personalizedBadge}>
                <Ionicons name="sparkles" size={9} color={theme.colors.accent.main} />
                <Text style={styles.personalizedText}>personalizado</Text>
              </View>
            )}
          </View>
          <Text style={styles.message} numberOfLines={2}>{current.text}</Text>
        </View>

        {/* Action */}
        {current.cta && current.ctaLabel ? (
          <Pressable
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: accent },
              pressed && styles.btnPressed,
            ]}
            onPress={handleCTA}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={current.ctaLabel}
          >
            <Text style={styles.ctaText}>{current.ctaLabel}</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={dismiss}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            style={({ pressed }) => [styles.dismissBtn, pressed && styles.btnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Fechar mensagem"
          >
            <Text style={styles.dismissText}>Entendi</Text>
          </Pressable>
        )}
      </Pressable>

      {/* Disclaimer + hint de mute */}
      <View style={styles.footer}>
        {current.canMute && (
          <Text style={styles.muteHint}>Segure para silenciar</Text>
        )}
        <Text style={styles.disclaimer}>
          Orientação geral · Não substitui avaliação médica · Decisão final é sempre do médico
        </Text>
      </View>

      {/* Modal expandido para leitura completa */}
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setExpanded(false)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.avatar, { backgroundColor: av.bg, borderColor: av.border }]}>
                <Ionicons name={av.icon} size={18} color={av.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Dra. Renova</Text>
                {current.isPersonalized && (
                  <Text style={styles.modalBadge}>Texto personalizado por IA · Médico sempre decide</Text>
                )}
              </View>
              <Pressable
                onPress={() => setExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
              </Pressable>
            </View>

            <Text style={styles.modalMessage}>{current.text}</Text>

            <Text style={styles.modalDisclaimer}>
              Orientação geral. Não substitui avaliação médica. A decisão final é sempre do médico.
            </Text>
          </View>
        </View>
      </Modal>
      </Reanimated.View>
  );
}

// ── Styles (pixel-perfect with theme.ts) ────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.paper,
    overflow: 'hidden',
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginBottom: uiTokens.cardGap,
    ...theme.shadows.card,
  },
  accentBar: {
    height: 2.5,
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  personalizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  personalizedText: {
    fontSize: 9,
    color: theme.colors.accent.main,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: theme.colors.text.secondary,
  },
  ctaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.pill,
    flexShrink: 0,
    minHeight: 32,
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  dismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
    minHeight: 32,
    justifyContent: 'center',
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: theme.colors.text.tertiary,
  },
  btnPressed: {
    opacity: theme.opacity.pressed,
    transform: [{ scale: 0.96 }],
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 2,
  },
  muteHint: {
    fontSize: 9,
    color: theme.colors.text.disabled,
    marginBottom: 2,
  },
  disclaimer: {
    fontSize: 9,
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: theme.colors.background.paper,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.text.primary,
  },
  modalBadge: {
    fontSize: 10,
    color: theme.colors.text.disabled,
    marginTop: 2,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  modalDisclaimer: {
    fontSize: 11,
    color: theme.colors.text.disabled,
  },
});
