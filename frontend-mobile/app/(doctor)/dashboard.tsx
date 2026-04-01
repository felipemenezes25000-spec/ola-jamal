import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAuth } from '../../contexts/AuthContext';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
import { getActiveCertificate } from '../../lib/api';
import { useDoctorRequestsQuery, useInvalidateDoctorRequests } from '../../lib/hooks/useDoctorRequestsQuery';
import { countPendentes } from '../../lib/domain/getRequestUiState';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import { getGreeting } from '../../lib/utils/format';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { FadeIn } from '../../components/ui/FadeIn';
import { motionTokens } from '../../lib/ui/motion';

import {
  ConnectionBanner,
  DashboardHeader,
  QueueCard,
  StatsGrid,
  QuickAccess,
  CertificateAlert,
} from '../../components/doctor/dashboard';
import { useDashboardResponsive } from '../../components/doctor/dashboard/useDashboardResponsive';

// ─── Helpers ────────────────────────────────────────────────────
function sanitizeDoctorName(name: string): { displayFirst: string; greetingName: string } {
  const raw = name.trim().split(/\s+/).filter(Boolean);
  const prefixes = ['dr', 'dr.', 'dra', 'dra.'];
  const first = raw[0] ?? '';
  const isPrefix = prefixes.includes(first.toLowerCase().replace(/\.$/, ''));
  const displayFirst = isPrefix && raw.length > 1 ? raw[1] : first || 'Médico';
  const greetingName = displayFirst.toLowerCase().startsWith('dr') ? displayFirst : `Dr(a). ${displayFirst}`;
  return { displayFirst, greetingName };
}

/** Dashboard background per design spec. */
const DASHBOARD_BG = '#F8FAFC';

// ═════════════════════════════════════════════════════════════════
// DASHBOARD — Clinical Soft
// ═════════════════════════════════════════════════════════════════
export default function DoctorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const responsive = useDashboardResponsive();
  const { user } = useAuth();
  // FIX #24: Usa useAppTheme dinâmico ao invés de clinicalSoftTokens.colors estático.
  // Isso garante que loading state e render principal respeitem dark mode.
  const { colors } = useAppTheme({ role: 'doctor' });

  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);

  const { subscribe, isConnected } = useRequestsEvents();
  const invalidateDoctorRequests = useInvalidateDoctorRequests();
  const {
    data: queue = [],
    isLoading: loading,
    refetch,
  } = useDoctorRequestsQuery(isConnected);

  useEffect(() => {
    let cancelled = false;
    getActiveCertificate()
      .then((cert) => { if (!cancelled) setHasCertificate(!!cert); })
      .catch(() => { if (!cancelled) setHasCertificate(false); });
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  useEffect(() => {
    return subscribe(() => invalidateDoctorRequests());
  }, [subscribe, invalidateDoctorRequests]);

  const onRefresh = useCallback(async () => {
    haptics.light();
    setRefreshing(true);
    try {
      await refetch();
      showToast({ message: 'Painel atualizado', type: 'success' });
    } catch {
      showToast({ message: 'Erro ao atualizar', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // ─── Derived Data ──────────────────────────────────────────
  const stats = useMemo(() => {
    let pendentes = 0, done = 0, prescriptions = 0, consultations = 0;
    const doneStatuses = ['approved', 'signed', 'delivered'];
    for (const q of queue) {
      if (doneStatuses.includes(q.status)) done++;
      if (q.requestType === 'prescription') prescriptions++;
      if (q.requestType === 'consultation') consultations++;
    }
    pendentes = countPendentes(queue);
    return { pendentes, done, prescriptions, consultations };
  }, [queue]);

  const { displayFirst, greetingName } = useMemo(
    () => sanitizeDoctorName(user?.name || ''),
    [user?.name]
  );

  const dateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const queueMessage = stats.pendentes > 0
    ? `${stats.pendentes} paciente(s) aguardando.`
    : 'Nenhum paciente aguardando\nno momento.';

  const handleQueuePress = useCallback(() => {
    haptics.selection();
    router.push('/(doctor)/requests');
  }, [router]);

  const handlePedidos = useCallback(() => {
    router.push('/(doctor)/requests');
  }, [router]);

  const handleAlertas = useCallback(() => {
    router.push('/(doctor)/notifications');
  }, [router]);

  const handleProntuarios = useCallback(() => {
    router.push('/(doctor)/requests');
  }, [router]);

  const handleProfile = useCallback(() => {
    router.push('/(doctor)/profile');
  }, [router]);

  // ─── Loading State ────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: DASHBOARD_BG }]}>
        <StatusBar barStyle="dark-content" backgroundColor={DASHBOARD_BG} />
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 10,
              paddingHorizontal: responsive.paddingHorizontal,
              maxWidth: responsive.maxContentWidth,
              alignSelf: responsive.isTablet ? 'center' : 'stretch',
            },
          ]}
        >
          <View style={styles.loadingHeader}>
            <View style={{ flex: 1 }} />
            <View
              style={[
                styles.loadingAvatar,
                {
                  width: responsive.avatarSize,
                  height: responsive.avatarSize,
                  borderRadius: responsive.avatarSize / 2,
                  backgroundColor: '#E2E8F0',
                },
              ]}
            />
          </View>
          <View
            style={[
              styles.loadingCard,
              { minHeight: responsive.heights.queueCardMin, backgroundColor: '#E2E8F0' },
            ]}
          />
          <SkeletonList count={5} />
        </View>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <View style={[styles.container, { backgroundColor: DASHBOARD_BG }]}>
        <StatusBar barStyle="dark-content" backgroundColor={DASHBOARD_BG} />
        <FadeIn visible={!loading} {...motionTokens.fade.doctor}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 10,
              paddingBottom: 20 + insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <View
            style={[
              styles.contentInner,
              {
                paddingHorizontal: responsive.paddingHorizontal,
                maxWidth: responsive.maxContentWidth,
                alignSelf: responsive.isTablet ? 'center' : 'stretch',
              },
            ]}
          >
          {!isConnected && <ConnectionBanner responsive={responsive} />}
            <DashboardHeader
              greeting={getGreeting()}
              name={greetingName}
              date={dateStr}
              avatarUrl={user?.avatarUrl}
              initials={(displayFirst[0] ?? 'M').toUpperCase()}
              onAvatarPress={handleProfile}
              responsive={responsive}
            />

            <QueueCard
              message={queueMessage}
              pendingCount={stats.pendentes}
              onPress={handleQueuePress}
              responsive={responsive}
            />

            <StatsGrid
              stats={stats}
              responsive={responsive}
              onPressPedidos={handlePedidos}
              onPressConsultas={() => router.push('/(doctor)/consultations')}
            />

            <QuickAccess
              onPedidos={handlePedidos}
              onAlertas={handleAlertas}
              onProntuarios={handleProntuarios}
              responsive={responsive}
            />

            {hasCertificate === false && (
              <CertificateAlert onPress={() => router.push('/certificate/upload')} />
            )}
          </View>
        </ScrollView>
        </FadeIn>
      </View>
    </ErrorBoundary>
  );
}

// ─── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {},
  contentInner: { width: '100%' },
  loadingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  loadingAvatar: {},
  loadingCard: {
    borderRadius: 16,
    marginBottom: 20,
  },
});
