import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { fetchRequests } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows, gradients } from '../../constants/theme';

interface ServiceCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  price: string;
  onPress: () => void;
  gradientColors: readonly [string, string, ...string[]];
}

function ServiceCard({ icon, title, description, price, onPress, gradientColors }: ServiceCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.serviceCard}
      >
        <View style={styles.serviceIcon}>
          <Ionicons name={icon} size={28} color={colors.white} />
        </View>
        <View style={styles.serviceContent}>
          <Text style={styles.serviceTitle}>{title}</Text>
          <Text style={styles.serviceDesc}>{description}</Text>
        </View>
        <View style={styles.servicePriceBadge}>
          <Text style={styles.servicePrice}>{price}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentRequests, setRecentRequests] = useState<RequestResponseDto[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadRecentRequests(); }, []);

  const loadRecentRequests = async () => {
    try {
      const response = await fetchRequests({ page: 1, pageSize: 5 });
      setRecentRequests(response.items);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecentRequests();
    setRefreshing(false);
  };

  const getRequestIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'prescription': return 'medical';
      case 'exam': return 'flask';
      case 'consultation': return 'videocam';
      default: return 'document';
    }
  };

  const getRequestLabel = (type: string) => {
    switch (type) {
      case 'prescription': return 'Receita';
      case 'exam': return 'Exame';
      case 'consultation': return 'Consulta';
      default: return type;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá,</Text>
            <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'Usuário'} 👋</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </LinearGradient>

        {/* AI Banner */}
        <View style={styles.bannerContainer}>
          <LinearGradient
            colors={[colors.secondary, colors.secondaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiBanner}
          >
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles" size={24} color={colors.secondary} />
            </View>
            <View style={styles.aiBannerContent}>
              <Text style={styles.aiBannerTitle}>Triagem com IA</Text>
              <Text style={styles.aiBannerDesc}>Análise inteligente da sua receita em segundos</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nossos Serviços</Text>

          <ServiceCard
            icon="medical"
            title="Renovar Receita"
            description="Renove suas receitas médicas com praticidade"
            price="A partir de R$ 29,90"
            onPress={() => router.push('/new-request/prescription')}
            gradientColors={[colors.primary, colors.primaryDark]}
          />
          <ServiceCard
            icon="flask"
            title="Pedir Exame"
            description="Solicite pedidos de exames laboratoriais"
            price="A partir de R$ 19,90"
            onPress={() => router.push('/new-request/exam')}
            gradientColors={[colors.primaryLight, colors.primary]}
          />
          <ServiceCard
            icon="videocam"
            title="Consulta Online"
            description="Atendimento médico por videochamada"
            price="A partir de R$ 99,90"
            onPress={() => router.push('/new-request/consultation')}
            gradientColors={[colors.primaryDark, colors.primaryDarker]}
          />
        </View>

        {/* Recent requests */}
        {recentRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recentes</Text>
              <TouchableOpacity onPress={() => router.push('/(patient)/requests')}>
                <Text style={styles.seeAll}>Ver todas</Text>
              </TouchableOpacity>
            </View>

            {recentRequests.map((req) => (
              <TouchableOpacity key={req.id} onPress={() => router.push(`/request-detail/${req.id}`)}>
                <Card style={styles.requestCard}>
                  <View style={styles.requestRow}>
                    <View style={[styles.requestIconBg, { backgroundColor: colors.primaryPaler }]}>
                      <Ionicons name={getRequestIcon(req.requestType)} size={20} color={colors.primary} />
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestType}>{getRequestLabel(req.requestType)}</Text>
                      <Text style={styles.requestDate}>
                        {new Date(req.createdAt).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    <StatusBadge status={req.status} size="sm" />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* WhatsApp support */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.whatsappCard}>
            <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
            <View style={styles.whatsappContent}>
              <Text style={styles.whatsappTitle}>Precisa de ajuda?</Text>
              <Text style={styles.whatsappDesc}>Fale conosco pelo WhatsApp</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl + 20,
  },
  greeting: { ...typography.body, color: 'rgba(255,255,255,0.8)' },
  userName: { ...typography.h1, color: colors.white },
  settingsBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  bannerContainer: { paddingHorizontal: spacing.lg, marginTop: -spacing.xxl },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: borderRadius.xl, ...shadows.md,
  },
  aiIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  aiBannerContent: { flex: 1 },
  aiBannerTitle: { ...typography.bodySemiBold, color: colors.white },
  aiBannerDesc: { ...typography.bodySmall, color: 'rgba(255,255,255,0.85)' },
  section: { padding: spacing.lg, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.primaryDarker, marginBottom: spacing.md },
  seeAll: { ...typography.bodySmallMedium, color: colors.primary },
  serviceCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: borderRadius.xl, marginBottom: spacing.sm, ...shadows.sm,
  },
  serviceIcon: {
    width: 52, height: 52, borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  serviceContent: { flex: 1 },
  serviceTitle: { ...typography.bodySemiBold, color: colors.white, marginBottom: 2 },
  serviceDesc: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  servicePriceBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full,
  },
  servicePrice: { ...typography.captionSmall, color: colors.white },
  requestCard: { marginBottom: spacing.sm },
  requestRow: { flexDirection: 'row', alignItems: 'center' },
  requestIconBg: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  requestInfo: { flex: 1 },
  requestType: { ...typography.bodySmallMedium, color: colors.gray800 },
  requestDate: { ...typography.caption, color: colors.gray400, marginTop: 2 },
  whatsappCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.md, ...shadows.sm,
  },
  whatsappContent: { flex: 1, marginLeft: spacing.md },
  whatsappTitle: { ...typography.bodySmallMedium, color: colors.gray800 },
  whatsappDesc: { ...typography.caption, color: colors.gray500 },
});
