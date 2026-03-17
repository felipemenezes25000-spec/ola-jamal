/**
 * Tela de Emissão de Documentos Pós-Consulta.
 * Rota: /post-consultation-emit/[requestId]
 *
 * Usa o PostConsultationScreen (design aprovado) para:
 * - Receita pré-preenchida pela IA
 * - Exames com pacotes rápidos
 * - Atestado médico
 * - Assinatura em lote ICP-Brasil
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import { useAuth } from '../../contexts/AuthContext';
import { fetchRequestById } from '../../lib/api';
import type { RequestResponseDto } from '../../types/database';
import PostConsultationScreen from '../../components/post-consultation/PostConsultationScreen';

export default function PostConsultationEmitRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useAppTheme();

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestResponseDto | null>(null);

  // Redirect patients
  const isPatient = user != null && user.role !== 'doctor';
  useEffect(() => {
    if (isPatient && rid) router.replace(`/request-detail/${rid}`);
  }, [isPatient, rid, router]);

  // Load request
  useEffect(() => {
    if (!rid) return;
    fetchRequestById(rid)
      .then(setRequest)
      .catch(() => {
        Alert.alert('Erro', 'Não foi possível carregar a consulta.');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [rid, router]);

  if (loading || !request) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
        <Text style={{ color: colors.textMuted, marginTop: 12, textAlign: 'center' }}>
          Carregando pós-consulta...
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: '#0F2942' }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,.6)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Pós-consulta</Text>
      </View>

      {/* Patient info bar */}
      <View style={[s.patientBar, { backgroundColor: '#1B2D45' }]}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(request.patientName ?? 'P').substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.patientName}>{request.patientName ?? 'Paciente'}</Text>
          <Text style={s.patientMeta}>
            {request.birthDate
              ? `${Math.floor((Date.now() - new Date(request.birthDate).getTime()) / 31557600000)} anos`
              : ''
            }
          </Text>
        </View>
        <View style={s.badge}>
          <Text style={s.badgeText}>Finalizada</Text>
        </View>
      </View>

      {/* Main content */}
      <PostConsultationScreen
        request={request}
        onComplete={() => {
          router.replace(`/request-detail/${rid}`);
        }}
        onBack={() => router.back()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F5F7' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: '#fff', letterSpacing: -0.5 },
  patientBar: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 14,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,.7)', letterSpacing: 0.5 },
  patientName: { fontSize: 15, fontWeight: '500', color: '#fff' },
  patientMeta: { fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 3 },
  badge: {
    backgroundColor: 'rgba(52,211,153,.15)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '500', color: '#6EE7B7', letterSpacing: 0.3 },
});
