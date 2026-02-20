import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, borderRadius, gradients, typography } from '../../lib/themeDoctor';
import { getRequests, getActiveCertificate } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { StatsCard } from '../../components/StatsCard';
import RequestCard from '../../components/RequestCard';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonList } from '../../components/ui/SkeletonLoader';

export default function DoctorDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [queue, setQueue] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [cert, res] = await Promise.allSettled([
        getActiveCertificate(),
        getRequests({ page: 1, pageSize: 100 }),
      ]);
      setHasCertificate(cert.status === 'fulfilled' && !!cert.value);
      setQueue(res.status === 'fulfilled' ? (res.value?.items ?? []) : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => {
    loadData();
    const interval = setInterval(loadData, 25000);
    return () => clearInterval(interval);
  }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const stats = {
    queue: queue.filter(r => r.status === 'submitted').length,
    inReview: queue.filter(r => r.status === 'in_review').length,
    signed: queue.filter(r => ['signed', 'delivered'].includes(r.status)).length,
    consultations: queue.filter(r => r.requestType === 'consultation').length,
  };

  const queuePreview = queue
    .filter(r => ['submitted', 'in_review', 'paid'].includes(r.status))
    .slice(0, 5);

  const firstName = user?.name?.split(' ')[0] || 'Médico';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Header ─── */}
      <LinearGradient
        colors={['#004E7C', '#0077B6', '#0096D6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greetingSmall}>Painel Médico 🩺</Text>
            <Text style={styles.greetingName}>Dr(a). {firstName}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/(doctor)/profile')}
          >
            <Text style={styles.avatarInitial}>{firstName[0]?.toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatsCard
            icon="time-outline"
            label="Fila"
            value={stats.queue}
            iconColor="#F59E0B"
            onPress={() => router.push('/(doctor)/requests')}
          />
          <StatsCard
            icon="eye-outline"
            label="Analisando"
            value={stats.inReview}
            iconColor="#3B82F6"
            onPress={() => router.push('/(doctor)/requests')}
          />
          <StatsCard
            icon="shield-checkmark-outline"
            label="Assinados"
            value={stats.signed}
            iconColor="#7C3AED"
            onPress={() => router.push('/(doctor)/requests')}
          />
          <StatsCard
            icon="videocam-outline"
            label="Consultas"
            value={stats.consultations}
            iconColor="#0096D6"
            onPress={() => router.push('/(doctor)/requests')}
          />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* ─── Certificate Alert ─── */}
        {hasCertificate === false && (
          <Pressable
            style={({ pressed }) => [styles.alertBanner, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/certificate/upload')}
          >
            <View style={styles.alertIconWrap}>
              <Ionicons name="warning" size={20} color="#B45309" />
            </View>
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertTitle}>Certificado digital necessário</Text>
              <Text style={styles.alertDesc}>Faça upload para assinar documentos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        {/* ─── Queue Preview ─── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Fila de Atendimento</Text>
          <Pressable
            onPress={() => router.push('/(doctor)/requests')}
            style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.seeAllText}>Ver tudo</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>

        {loading ? (
          <SkeletonList count={3} />
        ) : queuePreview.length > 0 ? (
          queuePreview.map(req => (
            <RequestCard
              key={req.id}
              request={req}
              showPatientName
              onPress={() => router.push(`/doctor-request/${req.id}`)}
            />
          ))
        ) : (
          <EmptyState
            icon="medical-outline"
            emoji="🏥"
            title="Fila vazia"
            subtitle="Nenhum pedido aguardando no momento. Novos pedidos aparecerão aqui automaticamente."
            actionLabel="Ver todos os pedidos"
            onAction={() => router.push('/(doctor)/requests')}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 110,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 16,
  },
  greetingSmall: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  greetingName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: -55,
  },

  // ─── Body ───
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTextWrap: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  alertDesc: { fontSize: 12, color: '#B45309', marginTop: 1 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
