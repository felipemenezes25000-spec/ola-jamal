import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius, shadows } from '../../lib/theme';
import { getRequests, updateDoctorAvailability, getCertificateStatus } from '../../lib/api';
import { RequestResponseDto, UserDto, DoctorProfileDto } from '../../types/database';
import { StatsCard } from '../../components/StatsCard';
import RequestCard from '../../components/RequestCard';

export default function DoctorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserDto | null>(null);
  const [doctor, setDoctor] = useState<DoctorProfileDto | null>(null);
  const [queue, setQueue] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(false);
  const [hasCertificate, setHasCertificate] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const userData = await AsyncStorage.getItem('@renoveja:user');
      const doctorData = await AsyncStorage.getItem('@renoveja:doctor');
      if (userData) setUser(JSON.parse(userData));
      if (doctorData) {
        const doc = JSON.parse(doctorData);
        setDoctor(doc);
        setAvailable(doc.available);
      }
      try {
        const certStatus = await getCertificateStatus();
        setHasCertificate(certStatus.hasValidCertificate);
      } catch { setHasCertificate(false); }
      try {
        const queueData = await getRequests({ page: 1, pageSize: 100 });
        setQueue(queueData?.items || []);
      } catch {}
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const toggleAvailability = async (val: boolean) => {
    setAvailable(val);
    try {
      if (doctor) await updateDoctorAvailability(doctor.id, val);
    } catch {
      setAvailable(!val);
    }
  };

  const stats = {
    queue: queue.filter(r => r.status === 'submitted').length,
    inReview: queue.filter(r => r.status === 'in_review').length,
    signed: queue.filter(r => ['signed', 'delivered'].includes(r.status)).length,
    consultations: queue.filter(r => r.requestType === 'consultation').length,
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.secondary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.secondary]} />}
    >
      {/* Header */}
      <LinearGradient colors={['#10B981', '#34D399', '#6EE7B7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Dr. {user?.name?.split(' ')[0] || 'Médico'} 👋</Text>
            <Text style={styles.subtitle}>Painel do médico</Text>
          </View>
          <View style={styles.avatar}>
            <Ionicons name="medkit" size={24} color={colors.secondary} />
          </View>
        </View>
      </LinearGradient>

      {/* Certificate Alert */}
      {!hasCertificate && (
        <TouchableOpacity style={styles.alertBanner} onPress={() => router.push('/certificate/upload')} activeOpacity={0.8}>
          <Ionicons name="warning" size={24} color="#F59E0B" />
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>Certificado digital não encontrado</Text>
            <Text style={styles.alertDesc}>Faça o upload para poder assinar documentos</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatsCard icon="list" iconColor="#F59E0B" label="FILA" value={stats.queue} />
        <StatsCard icon="search" iconColor="#3B82F6" label="EM ANÁLISE" value={stats.inReview} />
        <StatsCard icon="checkmark-circle" iconColor="#10B981" label="ASSINADOS" value={stats.signed} />
        <StatsCard icon="videocam" iconColor="#0EA5E9" label="CONSULTAS" value={stats.consultations} />
      </View>

      {/* Availability */}
      <View style={styles.availCard}>
        <View style={styles.availInfo}>
          <View style={[styles.availDot, { backgroundColor: available ? colors.success : colors.textMuted }]} />
          <Text style={styles.availText}>{available ? 'Disponível para atendimento' : 'Indisponível'}</Text>
        </View>
        <Switch
          value={available}
          onValueChange={toggleAvailability}
          trackColor={{ false: colors.border, true: '#86EFAC' }}
          thumbColor={available ? colors.success : '#f4f3f4'}
        />
      </View>

      {/* Recent Queue */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Fila de Atendimento</Text>
        <TouchableOpacity onPress={() => router.push('/(doctor)/requests')}>
          <Text style={styles.seeAll}>Ver todas</Text>
        </TouchableOpacity>
      </View>

      {queue.length > 0 ? (
        queue.slice(0, 5).map(req => (
          <RequestCard
            key={req.id}
            request={req}
            onPress={() => router.push(`/doctor-request/${req.id}`)}
          />
        ))
      ) : (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-circle" size={48} color={colors.border} />
          <Text style={styles.emptyText}>Nenhum pedido na fila</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: {
    paddingTop: 60, paddingBottom: spacing.lg, paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { flex: 1 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5',
    marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.md,
    padding: spacing.md, gap: spacing.sm,
  },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  alertDesc: { fontSize: 12, color: colors.textSecondary },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: spacing.md,
    marginTop: spacing.md, gap: spacing.sm,
  },
  availCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.md,
    borderRadius: borderRadius.md, padding: spacing.md, ...shadows.card,
  },
  availInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  availDot: { width: 10, height: 10, borderRadius: 5 },
  availText: { fontSize: 14, fontWeight: '500', color: colors.text },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  seeAll: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl * 2, gap: spacing.sm },
  emptyText: { fontSize: 15, color: colors.textMuted },
});
