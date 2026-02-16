import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows } from '../lib/theme';
import { StatusBadge } from './StatusBadge';
import { RequestResponseDto } from '../types/database';

function getRequestIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'prescription': return 'document-text';
    case 'exam': return 'flask';
    case 'consultation': return 'videocam';
    default: return 'document';
  }
}

function getRequestIconColor(type: string): string {
  switch (type) {
    case 'prescription': return '#0EA5E9';
    case 'exam': return '#8B5CF6';
    case 'consultation': return '#10B981';
    default: return '#0EA5E9';
  }
}

function getRequestTitle(request: RequestResponseDto): string {
  switch (request.requestType) {
    case 'prescription': return 'Renovação de Receita';
    case 'exam': return 'Pedido de Exames';
    case 'consultation': return 'Consulta Online';
    default: return 'Solicitação';
  }
}

function getRequestSubtitle(request: RequestResponseDto, showPatientName?: boolean): string {
  if (showPatientName && request.patientName) {
    return request.patientName;
  }
  if (request.doctorName) {
    return `${request.doctorName} • ${new Date(request.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
  }
  return new Date(request.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  request: RequestResponseDto;
  onPress: () => void;
  showPatientName?: boolean;
}

export default function RequestCard({ request, onPress, showPatientName }: Props) {
  const icon = getRequestIcon(request.requestType);
  const iconColor = getRequestIconColor(request.requestType);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{getRequestTitle(request)}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{getRequestSubtitle(request, showPatientName)}</Text>
      </View>

      <View style={styles.rightSide}>
        <StatusBadge status={request.status} size="sm" />
        {request.price != null && request.price > 0 && (
          <Text style={styles.price}>R$ {request.price.toFixed(2)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rightSide: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
