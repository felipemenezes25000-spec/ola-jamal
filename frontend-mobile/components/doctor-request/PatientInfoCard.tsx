import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../lib/themeDoctor';
import { DoctorCard } from '../ui/DoctorCard';
import { RequestResponseDto } from '../../types/database';

interface PatientInfoCardProps {
  request: RequestResponseDto;
  onViewRecord: () => void;
  style?: object;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0][0] || '?').toUpperCase();
}

function formatDateTime(d: string): string {
  const dt = new Date(d);
  return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function PatientInfoCard({ request, onViewRecord, style }: PatientInfoCardProps) {
  return (
    <DoctorCard style={style}>
      <TouchableOpacity
        onPress={() => request.patientId && onViewRecord()}
        activeOpacity={0.7}
        style={s.patientRow}
      >
        <View style={s.patientAvatar}>
          <Text style={s.patientAvatarText}>{getInitials(request.patientName)}</Text>
        </View>
        <View style={s.patientInfo}>
          <Text style={s.patientName}>{request.patientName || 'Paciente'}</Text>
          <Text style={s.patientDate}>{formatDateTime(request.createdAt)}</Text>
          {request.patientId && (
            <View style={s.patientLink}>
              <Ionicons name="folder-open-outline" size={13} color={colors.primary} />
              <Text style={s.patientLinkText}>VER PRONTUÁRIO</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </DoctorCard>
  );
}

const s = StyleSheet.create({
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  patientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  patientAvatarText: { fontSize: 18, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: '#fff' },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.text },
  patientDate: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginTop: 2 },
  patientLink: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  patientLinkText: { fontSize: 11, fontFamily: typography.fontFamily.bold, color: colors.primary, fontWeight: '700', letterSpacing: 0.5 },
});
