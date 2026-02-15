import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Switch, AppState, AppStateStatus } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { usePushNotification } from '../../contexts/PushNotificationContext';
import { fetchRequests, updateDoctorAvailability, getCertificateStatus } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

function StatCard({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; color: string }) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIconBg, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export default function DoctorDashboardScreen() {
  const { user, doctorProfile } = useAuth();
  const router = useRouter();
  const [available, setAvailable] = useState(doctorProfile?.available ?? false);
  const [stats, setStats] = useState({ pending: 0, inReview: 0, signed: 0, completed: 0 });
  const [recentRequests, setRecentRequests] = useState<RequestResponseDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);
  const { lastNotificationAt } = usePushNotification();

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (lastNotificationAt > 0) loadData(); }, [lastNotificationAt]);

  // Auto-refresh ao voltar para a tela, ao retornar o app ao primeiro plano e a cada 5s (polling)
  useFocusEffect(useCallback(() => {
    loadData();
    const interval = setInterval(() => loadData(), 5000);
    return () => clearInterval(interval);
  }, []));
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        loadData();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  const loadData = async () => {
    try {
      const [reqRes, certStatus] = await Promise.all([
        fetchRequests({ page: 1, pageSize: 100 }),
        getCertificateStatus().catch(() => ({ hasValidCertificate: false })),
      ]);
      const items = reqRes.items;
      setStats({
        pending: items.filter(r => ['submitted', 'paid'].includes(r.status) && !r.doctorId).length,
        inReview: items.filter(r => r.doctorId && ['in_review', 'approved'].includes(r.status)).length,
        signed: items.filter(r => r.doctorId && r.status === 'signed').length,
        completed: items.filter(r => r.doctorId && ['completed', 'delivered', 'consultation_finished'].includes(r.status)).length,
      });
      const uniqueById = items.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i);
      setRecentRequests(uniqueById.filter(r => r.doctorId).slice(0, 5));
      setHasCertificate((certStatus as any).hasValidCertificate ?? false);
    } catch (e) { console.error(e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const toggleAvailability = async (val: boolean) => {
    setAvailable(val);
    try {
      if (doctorProfile) await updateDoctorAvailability(doctorProfile.id, val);
    } catch { setAvailable(!val); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Bem-vindo, Dr(a).</Text>
              <Text style={styles.name}>{user?.name?.split(' ')[0] || 'Médico'}</Text>
            </View>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={28} color={colors.white} />
            </View>
          </View>
          <View style={styles.availRow}>
            <View style={styles.availInfo}>
              <View style={[styles.availDot, { backgroundColor: available ? '#10B981' : colors.gray400 }]} />
              <Text style={styles.availText}>{available ? 'Disponível' : 'Indisponível'}</Text>
            </View>
            <Switch value={available} onValueChange={toggleAvailability} trackColor={{ true: '#10B981', false: colors.gray300 }} thumbColor={colors.white} />
          </View>
        </LinearGradient>

        {hasCertificate === false && (
          <TouchableOpacity style={styles.certAlert} onPress={() => router.push('/certificate/upload')}>
            <Ionicons name="warning" size={20} color={colors.warning} />
            <Text style={styles.certAlertText}>Certificado digital não cadastrado. Toque para configurar.</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
          </TouchableOpacity>
        )}

        <View style={styles.statsGrid}>
          <StatCard icon="hourglass-outline" label="Na Fila" value={stats.pending} color={colors.primary} />
          <StatCard icon="eye-outline" label="Em Análise" value={stats.inReview} color="#8B5CF6" />
          <StatCard icon="create-outline" label="Assinados" value={stats.signed} color={colors.secondary} />
          <StatCard icon="checkmark-circle-outline" label="Concluídos" value={stats.completed} color={colors.success} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Atividade Recente</Text>
            <TouchableOpacity onPress={() => router.push('/(doctor)/requests')}>
              <Text style={styles.seeAll}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {recentRequests.length === 0 ? (
            <Card><View style={styles.empty}><Ionicons name="document-outline" size={40} color={colors.gray300} /><Text style={styles.emptyText}>Nenhuma solicitação</Text></View></Card>
          ) : recentRequests.map((req, idx) => (
            <TouchableOpacity key={`${req.id}-${idx}`} onPress={() => router.push(`/doctor-request/${req.id}`)}>
              <Card style={styles.reqCard}>
                <View style={styles.reqRow}>
                  <View style={styles.reqIcon}>
                    <Ionicons name={req.requestType === 'prescription' ? 'medical' : req.requestType === 'exam' ? 'flask' : 'videocam'} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.reqInfo}>
                    <Text style={styles.reqName}>{req.patientName || 'Paciente'}</Text>
                    <Text style={styles.reqDate}>{new Date(req.createdAt).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <StatusBadge status={req.status} size="sm" />
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.quickAction} onPress={() => router.push('/(doctor)/requests')}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.qaGradient}>
              <Ionicons name="list" size={24} color={colors.white} />
              <Text style={styles.qaText}>Ver Fila de Solicitações</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl + 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  greeting: { ...typography.body, color: 'rgba(255,255,255,0.8)' },
  name: { ...typography.h1, color: colors.white },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: borderRadius.lg, padding: spacing.md },
  availInfo: { flexDirection: 'row', alignItems: 'center' },
  availDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  availText: { ...typography.bodySemiBold, color: colors.white },
  certAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningLight, marginHorizontal: spacing.lg, marginTop: -spacing.lg, borderRadius: borderRadius.lg, padding: spacing.md, gap: 8 },
  certAlertText: { flex: 1, ...typography.bodySmall, color: colors.gray700 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, marginTop: -spacing.lg, gap: spacing.sm },
  statCard: { flex: 1, minWidth: '45%', alignItems: 'center', padding: spacing.md },
  statIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  statValue: { ...typography.h2, marginBottom: 2 },
  statLabel: { ...typography.caption, color: colors.gray500, textAlign: 'center' },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h4, color: colors.primaryDarker },
  seeAll: { ...typography.bodySmallMedium, color: colors.primary },
  empty: { alignItems: 'center', padding: spacing.xl },
  emptyText: { ...typography.bodySmall, color: colors.gray400, marginTop: spacing.sm },
  reqCard: { marginBottom: spacing.sm },
  reqRow: { flexDirection: 'row', alignItems: 'center' },
  reqIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryPaler, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  reqInfo: { flex: 1 },
  reqName: { ...typography.bodySmallMedium, color: colors.gray800 },
  reqDate: { ...typography.caption, color: colors.gray400, marginTop: 1 },
  quickAction: { marginTop: spacing.sm },
  qaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: borderRadius.xl, gap: spacing.sm },
  qaText: { ...typography.bodySemiBold, color: colors.white },
});
