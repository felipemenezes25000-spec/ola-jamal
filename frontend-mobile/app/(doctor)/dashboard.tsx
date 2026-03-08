import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuth } from '../../contexts/AuthContext';
import { useRequestsEvents } from '../../contexts/RequestsEventsContext';
// Use dynamic theme hook
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { cacheRequest } from '../doctor-request/[id]';

import { AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';

import {
  countPendentes,
  getPendingForPanel,
  getRequestUiState,
} from '../../lib/domain/getRequestUiState';
import { haptics } from '../../lib/haptics';
import { showToast } from '../../components/ui/Toast';
import type { DesignColors } from '../../lib/designSystem';

// -----------------------------------------------------------------------------
// Doctor Queue Item Component
// -----------------------------------------------------------------------------
const QueueItem = ({ request, onPress, colors }: { request: RequestResponseDto; onPress: () => void; colors: DesignColors }) => {
  const { label, colorKey } = getRequestUiState(request);
  
  // Dynamic status color (DesignColors: flat tokens)
  const statusColorMap: Record<string, string> = {
    waiting: colors.warning,
    info: colors.info,
    success: colors.success,
    error: colors.error
  };
  
  const statusColor = statusColorMap[colorKey === 'waiting' ? 'waiting' : 'info'] || colors.primary;
  const isHighRisk = request.aiRiskLevel === 'high';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.queueItem, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
      accessibilityRole="button"
      accessibilityLabel={`Atender ${request.patientName}`}
    >
      <View style={[styles.queueLeftStrip, { backgroundColor: isHighRisk ? colors.error : colors.primary }]} />
      
      <View style={styles.queueContent}>
        <View style={styles.queueHeader}>
          <Text style={[styles.queueType, { color: colors.textSecondary }]}>
            {request.requestType === 'prescription' ? 'Receita' : request.requestType === 'exam' ? 'Exame' : 'Consulta'}
          </Text>
          {isHighRisk && (
            <View style={[styles.riskBadge, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="alert-circle" size={12} color={colors.error} />
              <Text style={[styles.riskText, { color: colors.error }]}>Risco Alto</Text>
            </View>
          )}
        </View>

        <Text style={[styles.queuePatient, { color: colors.text }]} numberOfLines={1}>
          {request.patientName || 'Paciente não identificado'}
        </Text>
        
        <View style={styles.queueFooter}>
          <Text style={[styles.queueStatus, { color: statusColor }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.queueAction}>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

export default function DoctorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, gradients, shadows, scheme } = useAppTheme();
  const isDark = scheme === 'dark';
  
  const [queue, setQueue] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);

  const loadData = useCallback(async (withFeedback = false) => {
    try {
      const [cert, res] = await Promise.allSettled([
        getActiveCertificate(),
        getRequests({ page: 1, pageSize: 500 }),
      ]);
      setHasCertificate(cert.status === 'fulfilled' && !!cert.value);
      const items = res.status === 'fulfilled' ? (res.value?.items ?? []) : [];
      setQueue(items);
      if (withFeedback) showToast({ message: 'Painel atualizado', type: 'success' });
    } catch (e) {
      console.error(e);
      if (withFeedback) showToast({ message: 'Erro ao atualizar', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const { subscribe, isConnected } = useRequestsEvents();

  useFocusEffect(
    useCallback(() => {
      loadData();
      if (!isConnected) {
        const interval = setInterval(loadData, 10000); // Polling fallback
        return () => clearInterval(interval);
      }
    }, [loadData, isConnected])
  );

  useEffect(() => {
    return subscribe(() => loadData());
  }, [subscribe, loadData]);

  const onRefresh = () => {
    haptics.light();
    setRefreshing(true);
    loadData(true);
  };

  const pendingList = useMemo(() => getPendingForPanel(queue, 10), [queue]);
  const pendentesCount = countPendentes(queue);
  
  // Sanitização do nome: evita "Dr(a). Dr" quando nome começa com Dr/Dr./Dra
  const rawNames = (user?.name || '').trim().split(/\s+/).filter(Boolean);
  const titlePrefixes = ['dr', 'dr.', 'dra', 'dra.'];
  const firstPart = rawNames[0] ?? '';
  const isTitle = titlePrefixes.includes(firstPart.toLowerCase().replace(/\.$/, ''));
  const displayFirst = isTitle && rawNames.length > 1 ? rawNames[1] : firstPart || 'Médico';
  const greetingName = displayFirst.toLowerCase().startsWith('dr') ? displayFirst : `Dr(a). ${displayFirst}`;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={[styles.headerSkeleton, { backgroundColor: colors.primary, paddingTop: insets.top + 20 }]} />
        <View style={{ padding: 20 }}>
          <SkeletonList count={3} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.white} />}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <LinearGradient
          colors={gradients.doctorHeader as [string, string, ...string[]]}
          style={[styles.header, { paddingTop: insets.top + 24 }]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={[styles.greeting, { color: colors.white }]}>Olá, {greetingName}</Text>
              <Text style={[styles.date, { color: 'rgba(255,255,255,0.85)' }]}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(doctor)/profile')}>
               <Text style={styles.profileInitials}>{(displayFirst[0] ?? user?.name?.[0] ?? 'M').toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* STATS SUMMARY (Clean) */}
          <View style={[
            styles.statsContainer, 
            { backgroundColor: colors.surface },
            shadows.card
          ]}>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{pendentesCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pendentes</Text>
            </View>
            <View style={[styles.dividerVertical, { backgroundColor: colors.borderLight }]} />
             <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: colors.success }]}>
                {queue.filter(q => q.status === 'approved' || q.status === 'signed').length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Hoje</Text>
            </View>
          </View>

          {/* ACTION NEEDED: Certificate */}
          {hasCertificate === false && (
            <FadeIn visible={true}>
              <TouchableOpacity
                style={[
                  styles.alertBox,
                  { backgroundColor: colors.warningLight, borderColor: colors.warning + '40' }
                ]}
                onPress={() => router.push('/certificate/upload')}
              >
                <Ionicons name="shield-checkmark" size={24} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: colors.warning }]}>
                    Certificado Digital pendente
                  </Text>
                  <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>
                    Configure para assinar receitas.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.warning} />
              </TouchableOpacity>
            </FadeIn>
          )}

          {/* QUEUE LIST */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Fila de Atendimento</Text>
            <TouchableOpacity onPress={() => router.push('/(doctor)/requests')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {pendingList.length > 0 ? (
            pendingList.map(req => (
              <QueueItem 
                key={req.id} 
                request={req} 
                colors={colors}
                onPress={() => {
                  haptics.selection();
                  cacheRequest(req);
                  router.push(`/doctor-request/${req.id}`);
                }} 
              />
            ))
          ) : (
            <AppEmptyState
              icon="checkmark-done-circle" 
              title="Fila limpa!" 
              subtitle="Não há pacientes aguardando no momento."
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerSkeleton: {
    height: 160,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
  },
  date: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitials: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 18,
  },
  
  // Body overlaps Header
  body: {
    marginTop: -30,
    paddingHorizontal: 20,
  },
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  dividerVertical: {
    width: 1,
    height: 40,
  },

  // Alerts
  alertBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertDesc: {
    fontSize: 13,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Queue Item - Clean Design
  queueItem: {
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
  },
  queueLeftStrip: {
    width: 6,
    height: '100%',
  },
  queueContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 12, 
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  queueType: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    gap: 4,
  },
  riskText: {
    fontSize: 11,
    fontWeight: '700',
  },
  queuePatient: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  queueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  queueAction: {
    justifyContent: 'center',
    paddingRight: 16,
  },
});
