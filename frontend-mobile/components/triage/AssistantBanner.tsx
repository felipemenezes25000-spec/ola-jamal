/**
 * AssistantBanner — Banner compacto da Dra. Renoveja (Camada A)
 *
 * Design pixel-perfect com theme.ts. Não-invasivo, colapsável.
 * Touch targets ≥ 44dp. Leitor de tela: accessibilityRole="alert".
 * Nunca cobre CTA, tab bar, ou botões. Max 2 linhas.
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Modal } from 'react-native';
import Reanimated, {
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';
import type { DesignColors } from '../../lib/designSystem';
import { useTriageAssistant } from '../../contexts/TriageAssistantProvider';
import { showToast } from '../ui/Toast';
import type { AvatarState, CTAAction, Severity } from '../../lib/triage/triage.types';

// ── Avatar palette (aligned with medical design system) ─────



const COMPANION_TIPS = [
  'Renove receitas, peça exames ou agende consultas. Toque para tirar dúvidas.',
  'Mantenha o acompanhamento com seu médico — faz toda a diferença no tratamento.',
  'Dúvidas sobre o app? Toque em mim para ver orientações e FAQ.',
  'Receitas e exames digitais com assinatura segura. Estou aqui para ajudar.',
  'Fotos nítidas e bem iluminadas agilizam a análise do médico.',
  'Conte ao médico sintomas, há quanto tempo e quais medicamentos você usa.',
  'Pedidos pendentes? Acompanhe o status aqui mesmo.',
  'Não esqueça de levar os resultados dos exames ao seu médico.',
];

interface AssistantBannerProps {
  /** Callback quando o CTA é pressionado */
  onAction?: (action: CTAAction, message?: { requestId?: string; status?: string | null }) => void;
  /** Callback quando o usuário toca no estado companion (Tire dúvidas) */
  onCompanionPress?: () => void;
  /** Estilo extra para posicionamento */
  containerStyle?: object;
  /** Se true, esconde completamente (ex.: telas com dados privados) */
  hidden?: boolean;
  /** Modo embutido: esconde cabeçalho repetido e remove animação de entrada */
  embedded?: boolean;
}

export function AssistantBanner({ onAction, onCompanionPress, containerStyle, hidden, embedded = false }: AssistantBannerProps) {
  const { current, dismiss, muteCurrent } = useTriageAssistant();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Dynamic AVATAR palette (adapts to dark mode)
  const AVATAR: Record<AvatarState, { bg: string; border: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
    neutral:  { bg: colors.primarySoft, border: colors.primary, icon: 'medical', iconColor: colors.primaryDark },
    alert:    { bg: colors.warningLight, border: colors.warning, icon: 'alert-circle', iconColor: colors.warning },
    positive: { bg: colors.successLight, border: colors.success, icon: 'checkmark-circle', iconColor: colors.success },
    thinking: { bg: colors.accentSoft, border: colors.accent, icon: 'sparkles', iconColor: colors.accent },
  };
  const ACCENT: Record<Severity, string> = {
    info: colors.primary,
    attention: colors.warning,
    positive: colors.success,
    neutral: colors.textMuted,
  };
  const [expanded, setExpanded] = useState(false);

  const handleCTA = useCallback(() => {
    if (current?.cta) {
      onAction?.(current.cta, { requestId: current.requestId, status: current.status });
      dismiss();
    }
  }, [current, onAction, dismiss]);

  const handleLongPress = useCallback(async () => {
    if (current?.canMute) {
      await muteCurrent();
      showToast({ message: 'Mensagem silenciada. Reative em Configurações.', type: 'info' });
    }
  }, [current, muteCurrent]);

  // Estado companion: Dra. Renoveja sempre visível — dicas rotativas para manter interação
  const isCompanion = !current;
  const [companionTipIndex, setCompanionTipIndex] = useState(0);
  useEffect(() => {
    if (!isCompanion) return;
    const t = setInterval(() => {
      setCompanionTipIndex((i) => (i + 1) % COMPANION_TIPS.length);
    }, 6000); // Rotaciona a cada 6s
    return () => clearInterval(t);
  }, [isCompanion]);

  if (hidden) return null;

  const av = current ? AVATAR[current.avatarState] : AVATAR.neutral;
  const accent = current ? ACCENT[current.severity] : colors.primary;

  // Render content logic
  const content = (
    <Pressable
        style={[styles.inner, embedded && styles.innerEmbedded]}
        onPress={() => isCompanion ? onCompanionPress?.() : (!embedded && setExpanded(true))}
        onLongPress={isCompanion ? undefined : handleLongPress}
        delayLongPress={800}
        accessibilityHint={current?.canMute ? 'Segure para silenciar esta mensagem' : undefined}
        accessibilityLabel={isCompanion ? 'Dra. Renoveja, sua assistente' : `Assistente de triagem: ${current?.text}`}
      >
        {/* Avatar - Hide if embedded (container has its own header) */}
        {!embedded && (
          <View style={[styles.avatar, { backgroundColor: av.bg, borderColor: av.border }]}>
            <Ionicons name={av.icon} size={15} color={av.iconColor} />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {!embedded && (
            <View style={styles.labelRow}>
              <Text style={styles.label}>Dra. Renoveja</Text>
              {current?.isPersonalized && (
                <View style={styles.personalizedBadge}>
                  <Ionicons name="sparkles" size={9} color={colors.accent} />
                  <Text style={styles.personalizedText} numberOfLines={1}>personalizado</Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.message} numberOfLines={embedded ? 0 : 2} adjustsFontSizeToFit={embedded}>
            {isCompanion ? COMPANION_TIPS[companionTipIndex] : current!.text}
          </Text>

          {/* Action — sempre abaixo do texto */}
          {!isCompanion && (
            <View style={styles.actionRow}>
              {current?.cta && current.ctaLabel ? (
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
                  <Text style={styles.ctaText} numberOfLines={1}>{current.ctaLabel}</Text>
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
            </View>
          )}
        </View>
      </Pressable>
  );

  if (embedded) {
    return (
      <View style={[styles.containerEmbedded, containerStyle]}>
        {content}
      </View>
    );
  }

  return (
      <Reanimated.View
        entering={FadeInDown.duration(280).springify().damping(20).stiffness(180)}
        style={[styles.container, containerStyle]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={isCompanion ? 'Dra. Renoveja, sua assistente' : `Assistente de triagem: ${current?.text}`}
      >
      {/* Accent stripe */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      {content}

      {/* Disclaimer + hint de mute — só quando há mensagem ativa */}
      {!isCompanion && (
        <View style={styles.footer}>
          {current?.canMute && (
            <Text style={styles.muteHint}>Segure para silenciar</Text>
          )}
          <Text style={styles.disclaimer}>
            Orientação geral · Não substitui avaliação médica · Decisão final é sempre do médico
          </Text>
        </View>
      )}

      {/* Modal expandido para leitura completa */}
      {!isCompanion && current && (
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setExpanded(false)} />
          <View style={styles.modalCard} accessibilityViewIsModal accessibilityRole="none">
            <View style={styles.modalHeader}>
              <View style={[styles.avatar, { backgroundColor: av.bg, borderColor: av.border }]}>
                <Ionicons name={av.icon} size={18} color={av.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalLabel}>Dra. Renoveja</Text>
                {current.isPersonalized && (
                  <Text style={styles.modalBadge}>Texto personalizado por IA · Médico sempre decide</Text>
                )}
              </View>
              <Pressable
                onPress={() => setExpanded(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Fechar mensagem expandida"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} importantForAccessibility="no" />
              </Pressable>
            </View>

            <Text style={styles.modalMessage}>{current.text}</Text>

            <Text style={styles.modalDisclaimer}>
              Orientação geral. Não substitui avaliação médica. A decisão final é sempre do médico.
            </Text>
          </View>
        </View>
      </Modal>
      )}
      </Reanimated.View>
  );
}

// ── Dynamic styles using useAppTheme() colors ────────────────

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    marginHorizontal: uiTokens.screenPaddingHorizontal,
    marginBottom: uiTokens.cardGap,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  containerEmbedded: {
    backgroundColor: 'transparent',
    padding: 0,
    margin: 0,
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
  innerEmbedded: {
    paddingTop: 0,
    paddingHorizontal: 12,
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
    flexWrap: 'wrap',
    columnGap: 6,
    rowGap: 2,
    marginBottom: 2,
  },
  personalizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    flexShrink: 1,
  },
  personalizedText: {
    fontSize: 12,
    color: colors.accent,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.textSecondary,
  },
  actionRow: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  ctaBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    flexShrink: 1,
    minHeight: 32,
    maxWidth: '100%',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: colors.white,
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
    color: colors.textMuted,
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 2,
  },
  muteHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayBackground,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
    color: colors.text,
  },
  modalBadge: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: colors.text,
    marginBottom: 12,
  },
  modalDisclaimer: {
    fontSize: 12,
    color: colors.textMuted,
  },
  });
}
