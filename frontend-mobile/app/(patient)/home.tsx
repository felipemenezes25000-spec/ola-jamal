import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, gradients } from '../../lib/themeDoctor';
import { uiTokens } from '../../lib/ui/tokens';
import { getRequests } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { getRequestUiState, needsPayment, isSignedOrDelivered } from '../../lib/domain/getRequestUiState';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
import { LargeActionCard } from '../../components/ui/LargeActionCard';
import { EmptyState } from '../../components/EmptyState';

export default function PatientHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [requests, setRequests] = useState<RequestResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await getRequests({ page: 1, pageSize: 50 });
      setRequests(response.items || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const stats = {
    pending: requests.filter(r => getRequestUiState(r).uiState === 'needs_action').length,
    toPay: requests.filter(r => needsPayment(r)).length,
    ready: requests.filter(r => isSignedOrDelivered(r)).length,
  };

  const recentRequests = requests.slice(0, 2);
  const firstName = user?.name?.split(' ')[0] || 'Paciente';
  const initial = firstName[0]?.toUpperCase() || 'P';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header: só saudação + avatar (igual ao web) */}
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerGreeting}>
            <Text style={styles.headerGreetingLabel}>Olá,</Text>
            <Text style={styles.headerGreetingName}>{firstName}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/(patient)/profile')}
          >
            <Text style={styles.avatarInitial}>{initial}</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {/* Stats: três cards brancos flutuando sobre o fundo cinza */}
      <View style={styles.statsRow}>
        <StatsCard
          icon="hourglass-outline"
          label="Em análise"
          value={stats.pending}
          iconColor={colors.warning}
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="card-outline"
          label="A pagar"
          value={stats.toPay}
          iconColor={colors.error}
          onPress={() => router.push('/(patient)/requests')}
        />
        <StatsCard
          icon="checkmark-done-circle-outline"
          label="Prontos"
          value={stats.ready}
          iconColor={colors.success}
          onPress={() => router.push('/(patient)/requests')}
        />
      </View>

      {/* ─── Destaque: Triagem com IA (tag no canto superior direito, igual ao web) ─── */}
      <View style={styles.aiBannerWrap}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiBanner}
        >
          <View style={styles.aiBannerIconWrap}>
            <MaterialCommunityIcons name="robot-happy-outline" size={36} color="#fff" />
          </View>
          <View style={styles.aiBannerTextWrap}>
            <Text style={styles.aiBannerTitle}>Triagem feita com IA</Text>
            <Text style={styles.aiBannerDesc}>
              Leitura inteligente de receitas e exames para agilizar seu atendimento.
            </Text>
          </View>
          <View style={styles.aiBannerBadge}>
            <Text style={styles.aiBannerBadgeText}>Tecnologia RenoveJá+</Text>
          </View>
        </LinearGradient>
      </View>

      {/* ─── Quick Actions (largura total, menos margem) ─── */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>O que deseja fazer?</Text>
        <Text style={styles.sectionHint}>Toque em uma opção abaixo para começar: renovar receita, pedir exame ou falar com um profissional.</Text>
        <View style={styles.actionsColumn}>
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="document-text" size={24} color={colors.primary} />
              </View>
            }
            title="Renovar Receita"
            description="Solicitar renovação de receita médica"
            variant="primary"
            onPress={() => router.push('/new-request/prescription')}
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="flask" size={24} color={colors.info} />
              </View>
            }
            title="Pedir Exame"
            description="Solicitar exames e laudos"
            variant="exam"
            onPress={() => router.push('/new-request/exam')}
          />
          <LargeActionCard
            icon={
              <View style={[styles.actionIconBox, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="videocam" size={24} color={colors.primary} />
              </View>
            }
            title="Consulta Breve +"
            description="Atendimento por vídeo com o médico"
            variant="consultation"
            onPress={() => router.push('/new-request/consultation')}
          />
        </View>
      </View>

      {/* ─── Recent Requests ─── */}
      {recentRequests.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pedidos recentes</Text>
            <Pressable
              onPress={() => router.push('/(patient)/requests')}
              style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.seeAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sectionHint}>Toque em um pedido para ver os detalhes. Use "Ver todos" para ver a lista completa.</Text>
          {recentRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onPress={() => router.push(`/request-detail/${req.id}`)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.section}>
          <EmptyState
            icon="document-text-outline"
            emoji="📋"
            title="Nenhum pedido ainda"
            subtitle="Crie sua primeira solicitação usando as opções acima"
          />
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerGreeting: {
    flex: 1,
  },
  headerGreetingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  headerGreetingName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  avatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },

  // ─── Destaque IA ───
  aiBannerWrap: {
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    marginTop: 24,
  },
  aiBanner: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 100,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)' },
      default: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  aiBannerIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  aiBannerTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 80,
  },
  aiBannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  aiBannerDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  aiBannerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  aiBannerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // ─── Stats (flutuando sobre o cinza, igual ao web) ───
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -44,
    marginBottom: 0,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },

  // ─── Sections ───
  section: {
    marginTop: 24,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
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
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 20,
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

  // ─── Actions Section ───
  actionsSection: {
    marginTop: 24,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  actionsColumn: {
    flexDirection: 'column',
    gap: 16,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
