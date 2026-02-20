import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../lib/theme';
import { getRequests } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { getRequestUiState, needsPayment, isSignedOrDelivered } from '../../lib/domain/requestUiState';
import RequestCard from '../../components/RequestCard';
import { StatsCard } from '../../components/StatsCard';
import { ActionCard } from '../../components/ActionCard';
import { EmptyState } from '../../components/EmptyState';

const c = theme.colors;
const s = theme.spacing;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getGreetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return '☀️';
  if (h < 18) return '🌤️';
  return '🌙';
}

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
    pending: requests.filter(r => ['in_review', 'waiting_doctor'].includes(getRequestUiState(r))).length,
    toPay: requests.filter(r => needsPayment(getRequestUiState(r))).length,
    ready: requests.filter(r => isSignedOrDelivered(getRequestUiState(r))).length,
  };

  const recentRequests = requests.slice(0, 4);
  const firstName = user?.name?.split(' ')[0] || 'Paciente';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={c.primary.main} />
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
          colors={[c.primary.main]}
          tintColor={c.primary.main}
        />
      }
    >
      {/* ─── Hero Header ─── */}
      <LinearGradient
        colors={['#0284C7', '#0EA5E9', '#38BDF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greetingSmall}>{getGreeting()} {getGreetingEmoji()}</Text>
            <Text style={styles.greetingName}>{firstName}</Text>
            <Text style={styles.headerSubtitle}>Como posso te ajudar hoje?</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.avatarBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/(patient)/profile')}
          >
            <Text style={styles.avatarInitial}>{firstName[0]?.toUpperCase()}</Text>
          </Pressable>
        </View>

        {/* Stats row - floats over header/content boundary */}
        <View style={styles.statsRow}>
          <StatsCard
            icon="hourglass-outline"
            label="Em análise"
            value={stats.pending}
            iconColor="#F59E0B"
            onPress={() => router.push('/(patient)/requests')}
          />
          <StatsCard
            icon="card-outline"
            label="A pagar"
            value={stats.toPay}
            iconColor="#EF4444"
            onPress={() => router.push('/(patient)/requests')}
          />
          <StatsCard
            icon="checkmark-done-circle-outline"
            label="Prontos"
            value={stats.ready}
            iconColor="#10B981"
            onPress={() => router.push('/(patient)/requests')}
          />
        </View>
      </LinearGradient>

      {/* ─── Quick Actions ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>O que deseja fazer?</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            compact
            icon="document-text"
            iconColor="#0EA5E9"
            label="Nova Receita"
            onPress={() => router.push('/new-request/prescription')}
          />
          <ActionCard
            compact
            icon="flask"
            iconColor="#8B5CF6"
            label="Pedir Exame"
            onPress={() => router.push('/new-request/exam')}
          />
          <ActionCard
            compact
            icon="videocam"
            iconColor="#10B981"
            label="Consulta"
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
              <Ionicons name="chevron-forward" size={14} color={c.primary.main} />
            </Pressable>
          </View>
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
    backgroundColor: c.background.default,
  },
  content: {
    paddingBottom: 110,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.background.default,
  },

  // ─── Header ───
  header: {
    paddingHorizontal: 20,
    paddingBottom: 80, // extra space for stats overlay
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    marginRight: 16,
  },
  greetingSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  greetingName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
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

  // ─── Stats ───
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: -60, // overlap into content area
  },

  // ─── Sections ───
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
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
    color: c.text.primary,
    marginBottom: 14,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.primary.main,
  },

  // ─── Actions Grid ───
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
});
