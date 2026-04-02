/**
 * Banner de atualização de pedido em tempo real.
 * Design limpo sem branding de assistente — é um alerta de status, não IA.
 * Role-aware: médico vê "Solicitação atualizada" etc, paciente vê "Médico na sala" etc.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { nav } from '../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRequestsEvents } from '../contexts/RequestsEventsContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../lib/ui/useAppTheme';
import { uiTokens } from '../lib/ui/tokens';
import { shadows } from '../lib/designSystem';

export function RequestUpdateBanner() {
  const _insets = useSafeAreaInsets(); // reservado para futura margem segura (prefix _ = unused)
  const router = useRouter();
  const { pendingUpdate, setPendingUpdate } = useRequestsEvents();
  const { user } = useAuth();
  const { colors } = useAppTheme();

  if (!pendingUpdate || !user) return null;

  const isDoctor = user.role === 'doctor';
  const path = pendingUpdate.requestId
    ? isDoctor
      ? `/doctor-request/${pendingUpdate.requestId}`
      : `/request-detail/${pendingUpdate.requestId}`
    : null;

  const handleVerPedido = () => {
    setPendingUpdate(null);
    if (path) nav.push(router, path as any);
  };

  const handleDismiss = () => {
    setPendingUpdate(null);
  };

  return (
    <View style={[styles.outer, { paddingBottom: 8 }]}>
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <View style={[styles.accentBar, { backgroundColor: colors.success }]} />
        <View style={styles.inner}>
          <View style={[styles.iconWrap, { backgroundColor: colors.successLight }]}>
            <Ionicons name="sync-circle" size={18} color={colors.success} />
          </View>
          <View style={styles.content}>
            <Text style={[styles.label, { color: colors.success }]}>
              {isDoctor ? 'Atualização' : 'Novidade'}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
              {pendingUpdate.message}
            </Text>
          </View>
          <View style={styles.actions}>
            {path ? (
              <Pressable
                style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary }, pressed && styles.btnPressed]}
                onPress={handleVerPedido}
              >
                <Text style={[styles.ctaText, { color: colors.white }]}>Ver pedido</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.white} />
              </Pressable>
            ) : null}
            <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn} hitSlop={12}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    zIndex: 100,
  },
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: shadows.card.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  accentBar: {
    height: 3,
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    minHeight: 32,
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dismissBtn: {
    padding: 4,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
