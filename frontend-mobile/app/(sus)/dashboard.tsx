import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import type { AppRoute } from '../../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { layout as dsLayout } from '../../lib/designSystem';
import { StatsCard } from '../../components/StatsCard';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { AppCard } from '../../components/ui/AppCard';
import { AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { FadeIn } from '../../components/ui/FadeIn';
import { haptics } from '../../lib/haptics';
import { getGreeting } from '../../lib/utils/format';
import { SUS_INTEGRATIONS, INTEGRATION_STATUS_MAP } from '../../lib/sus-references';

const SUS_GREEN = '#16A34A';
const SUS_GRADIENT: [string, string, string] = ['#047857', '#059669', '#16A34A'];

const MOCK_QUEUE = [
  { id: '1', name: 'Maria da Silva', time: '08:00', status: 'aguardando', type: 'Consulta', prof: 'Dr. Carlos Mendes' },
  { id: '2', name: 'João Santos', time: '08:20', status: 'agendado', type: 'Retorno', prof: 'Dr. Carlos Mendes' },
  { id: '3', name: 'Ana Costa', time: '08:40', status: 'agendado', type: 'Pré-natal', prof: 'Dra. Fernanda Lima' },
  { id: '4', name: 'Pedro Lima', time: '09:00', status: 'agendado', type: 'Hipertensão', prof: 'Dr. Carlos Mendes' },
  { id: '5', name: 'Francisca Oliveira', time: '09:20', status: 'agendado', type: 'Diabetes', prof: 'Dra. Fernanda Lima' },
];

export default function SusDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listPadding = useListBottomPadding();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.selection();
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header verde SUS ── */}
      <LinearGradient colors={SUS_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name ?? 'Profissional'}</Text>
            <View style={styles.ubsBadge}>
              <Ionicons name="business-outline" size={11} color="rgba(255,255,255,0.9)" />
              <Text style={styles.ubsName}>UBS Central — Jundiaí</Text>
            </View>
          </View>
          <Pressable style={styles.headerAvatar} onPress={() => haptics.selection()}>
            <Ionicons name="medical" size={24} color="#fff" />
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: listPadding }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SUS_GREEN} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats Row — overlaid on header ── */}
        {loading ? (
          <View style={[styles.statsRow, { marginTop: -36 }]}>
            <SkeletonList count={1} />
          </View>
        ) : (
          <FadeIn visible delay={0}>
            <View style={styles.statsRow}>
              <StatsCard icon="medkit" label="Hoje" value={47} iconColor={SUS_GREEN} iconBgColor={SUS_GREEN + '18'} />
              <StatsCard icon="people" label="Na Fila" value={12} iconColor="#F59E0B" iconBgColor="#FEF3C7" />
              <StatsCard icon="calendar" label="Agendados" value={85} iconColor="#3B82F6" iconBgColor="#E0F2FE" />
              <StatsCard icon="cloud-upload" label="e-SUS" value={23} iconColor="#8B5CF6" iconBgColor="#EDE9FE" />
            </View>
          </FadeIn>
        )}

        {/* ── Ações rápidas — compact 2x2 grid ── */}
        <FadeIn visible delay={150}>
          <SectionHeader title="Ações rápidas" />
          <View style={styles.actionsGrid}>
            {[
              { label: 'Novo Cidadão', desc: 'Cadastrar paciente SUS', icon: 'person-add-outline' as const, route: '/(sus)/cidadaos' as AppRoute, color: SUS_GREEN },
              { label: 'Agenda', desc: 'Fila do dia', icon: 'calendar-outline' as const, route: '/(sus)/agenda' as AppRoute, color: '#3B82F6' },
              { label: 'Atendimento', desc: 'Consulta SOAP', icon: 'medkit-outline' as const, route: '/(sus)/atendimento' as AppRoute, color: '#059669' },
              { label: 'Exportar', desc: 'Enviar ao e-SUS', icon: 'cloud-upload-outline' as const, route: '/(sus)/exportacao' as AppRoute, color: '#8B5CF6' },
            ].map((action, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}
                onPress={() => { haptics.selection(); nav.push(router, action.route); }}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + '14' }]}>
                  <Ionicons name={action.icon} size={20} color={action.color} />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>{action.label}</Text>
                <Text style={styles.actionDesc} numberOfLines={1}>{action.desc}</Text>
              </Pressable>
            ))}
          </View>
        </FadeIn>

        {/* ── Fila de atendimento ── */}
        <FadeIn visible delay={250}>
          <SectionHeader
            title="Fila de atendimento"
            count={MOCK_QUEUE.length}
            actionText="Ver agenda"
            onAction={() => { haptics.selection(); router.push('/(sus)/agenda'); }}
          />

          {loading ? (
            <View style={{ paddingHorizontal: dsLayout.screenPaddingHorizontal }}>
              <SkeletonList count={3} />
            </View>
          ) : MOCK_QUEUE.length === 0 ? (
            <AppEmptyState icon="calendar-outline" title="Nenhum paciente na fila" subtitle="A agenda do dia está vazia" />
          ) : (
            MOCK_QUEUE.map((item, i) => (
              <FadeIn visible key={item.id} delay={300 + i * 50}>
                <AppCard
                  variant="outlined"
                  onPress={() => { haptics.selection(); router.push('/(sus)/atendimento'); }}
                  style={{ marginBottom: 8, marginHorizontal: dsLayout.screenPaddingHorizontal }}
                >
                  <View style={styles.queueRow}>
                    <View style={[styles.queueTimeBadge, {
                      backgroundColor: item.status === 'aguardando' ? '#FEF3C7' : '#F0FDF4',
                    }]}>
                      <Text style={[styles.queueTime, {
                        color: item.status === 'aguardando' ? '#92400E' : SUS_GREEN,
                      }]}>{item.time}</Text>
                    </View>
                    <View style={styles.queueInfo}>
                      <Text style={styles.queueName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.queueProf} numberOfLines={1}>{item.prof}</Text>
                    </View>
                    <View style={styles.queueRight}>
                      <View style={[styles.queueTypeBadge, { backgroundColor: SUS_GREEN + '12' }]}>
                        <Text style={[styles.queueTypeText, { color: SUS_GREEN }]}>{item.type}</Text>
                      </View>
                      <View style={[styles.queueDot, {
                        backgroundColor: item.status === 'aguardando' ? '#F59E0B' : '#CBD5E1',
                      }]} />
                    </View>
                  </View>
                </AppCard>
              </FadeIn>
            ))
          )}
        </FadeIn>

        {/* ── Integrações SUS ── */}
        <FadeIn visible delay={400}>
          <SectionHeader title="Integrações SUS" />
          <View style={styles.integrationsCard}>
            {SUS_INTEGRATIONS.map((intg, i) => {
              const st = INTEGRATION_STATUS_MAP[intg.status];
              return (
                <View key={intg.id} style={[styles.integrationRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.borderLight }]}>
                  <View style={[styles.integrationIcon, { backgroundColor: st.bg }]}>
                    <Ionicons name={intg.icone as any} size={16} color={st.color} />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationName} numberOfLines={1}>{intg.nome}</Text>
                    <Text style={styles.integrationDesc} numberOfLines={1}>{intg.descricao}</Text>
                  </View>
                  <View style={[styles.integrationBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.integrationBadgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: DesignColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // ── Header ──
    header: {
      paddingHorizontal: dsLayout.screenPaddingHorizontal,
      paddingTop: 16,
      paddingBottom: 56, // extra space for overlapping stats
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerLeft: { flex: 1 },
    greeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
    userName: { fontSize: 22, color: '#fff', fontWeight: '800', marginTop: 2, letterSpacing: -0.3 },
    ubsBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(255,255,255,0.15)',
      paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 6, marginTop: 8, alignSelf: 'flex-start',
    },
    ubsName: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    headerAvatar: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    },

    // ── Stats — overlay pattern from patient home ──
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: -36,
      marginBottom: 8,
      paddingHorizontal: dsLayout.screenPaddingHorizontal,
      zIndex: 10,
      position: 'relative',
    },

    // ── Actions — compact 2x2 grid ──
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: dsLayout.screenPaddingHorizontal,
    },
    actionCard: {
      width: '47.5%' as any,
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
        android: { elevation: 1 },
      }),
    },
    actionIcon: {
      width: 36, height: 36, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 8,
    },
    actionLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    actionDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

    // ── Queue items ──
    scroll: { flex: 1 },
    queueRow: { flexDirection: 'row', alignItems: 'center' },
    queueTimeBadge: {
      paddingHorizontal: 8, paddingVertical: 5,
      borderRadius: 8, minWidth: 48, alignItems: 'center',
      marginRight: 10,
    },
    queueTime: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
    queueInfo: { flex: 1, marginRight: 8 },
    queueName: { fontSize: 14, fontWeight: '700', color: colors.text },
    queueProf: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    queueRight: { alignItems: 'flex-end', gap: 4 },
    queueTypeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    queueTypeText: { fontSize: 10, fontWeight: '700' },
    queueDot: { width: 7, height: 7, borderRadius: 4 },

    // ── Integrações SUS ──
    integrationsCard: {
      marginHorizontal: dsLayout.screenPaddingHorizontal,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
    },
    integrationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    integrationIcon: {
      width: 32, height: 32, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    integrationInfo: { flex: 1 },
    integrationName: { fontSize: 13, fontWeight: '600', color: colors.text },
    integrationDesc: { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
    integrationBadge: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    integrationBadgeText: { fontSize: 9, fontWeight: '700' },
  });
