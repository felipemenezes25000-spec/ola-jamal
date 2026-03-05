/**
 * Banner de atualização de pedido em tempo real — alinhado à Dra. Renoveja.
 * Mesmo design system (theme, rótulo "Dra. Renoveja", accent bar, avatar, disclaimer).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRequestsEvents } from '../contexts/RequestsEventsContext';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../lib/theme';
import { uiTokens } from '../lib/ui/tokens';

export function RequestUpdateBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pendingUpdate, setPendingUpdate } = useRequestsEvents();
  const { user } = useAuth();

  if (!pendingUpdate || !user) return null;

  const isDoctor = user.role === 'doctor';
  const path = pendingUpdate.requestId
    ? isDoctor
      ? `/doctor-request/${pendingUpdate.requestId}`
      : `/request-detail/${pendingUpdate.requestId}`
    : null;

  const handleVerPedido = () => {
    setPendingUpdate(null);
    if (path) router.push(path as any);
  };

  const handleDismiss = () => {
    setPendingUpdate(null);
  };

  const accent = theme.colors.secondary.main; // verde positivo, igual Dra. Renoveja "positive"

  return (
    <View style={[styles.outer, { paddingTop: Math.max(insets.top, 8) + 4, paddingBottom: 8 }]}>
      <View style={styles.container}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.inner}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.secondary.soft, borderColor: theme.colors.secondary.main }]}>
            <Ionicons name="checkmark-circle" size={15} color={theme.colors.secondary.dark} />
          </View>
          <View style={styles.content}>
            <Text style={styles.label}>Dra. Renoveja</Text>
            <Text style={styles.message} numberOfLines={2}>
              {pendingUpdate.message}
            </Text>
          </View>
          <View style={styles.actions}>
            {path ? (
              <Pressable
                style={({ pressed }) => [styles.ctaBtn, pressed && styles.btnPressed]}
                onPress={handleVerPedido}
              >
                <Text style={styles.ctaText}>Ver pedido</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </Pressable>
            ) : null}
            <TouchableOpacity onPress={handleDismiss} style={styles.dismissBtn} hitSlop={12}>
              <Ionicons name="close" size={20} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={styles.disclaimer}>
            Atualização em tempo real · Toque em "Ver pedido" para abrir
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: uiTokens.cardGap,
    zIndex: 100,
  },
  container: {
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.paper,
    overflow: 'hidden',
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
  label: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: theme.colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: theme.colors.text.secondary,
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
    backgroundColor: theme.colors.secondary.main,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.pill,
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
    padding: 4,
  },
  btnPressed: {
    opacity: theme.opacity?.pressed ?? 0.85,
    transform: [{ scale: 0.96 }],
  },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 2,
  },
  disclaimer: {
    fontSize: 9,
    color: theme.colors.text.disabled,
    fontStyle: 'italic',
  },
});
