import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { haptics } from '../../../lib/haptics';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius } = clinicalSoftTokens;

interface QueueCardProps {
  message: string;
  pendingCount: number;
  onPress: () => void;
  responsive: DashboardResponsive;
}

function QueueCard_Fn({ message, pendingCount, onPress, responsive }: QueueCardProps) {
  const { typography, heights } = responsive;
  return (
    <View style={styles.queueCard}>
      <LinearGradient
        colors={colors.queueGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative semi-transparent circles */}
      <View style={styles.queueShapeOne} />
      <View style={styles.queueShapeTwo} />

      <View style={styles.queueContent}>
        <Text style={[styles.queueLabel, { fontSize: typography.queueTitle }]}>
          FILA DE ATENDIMENTO
        </Text>

        <Text
          style={[
            styles.queueCount,
            { fontSize: typography.queueText, lineHeight: typography.queueText * 1.15 },
          ]}
          numberOfLines={2}
        >
          {pendingCount > 0
            ? `${pendingCount} paciente${pendingCount > 1 ? 's' : ''}`
            : 'Nenhum paciente'}
        </Text>

        <Text style={styles.queueSubtext}>
          {pendingCount > 0 ? 'aguardando atendimento' : 'aguardando no momento'}
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.queueButton, { height: heights.queueButton }]}
          onPress={() => {
            haptics.selection();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel="Ver fila de atendimento"
        >
          <Text style={[styles.queueButtonText, { fontSize: typography.queueButton }]} numberOfLines={1}>
            Ver fila
          </Text>
          <Feather name="arrow-right" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  queueCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.hero,
    padding: 20,
    marginBottom: 20,
    minHeight: 140,
  },
  queueShapeOne: {
    position: 'absolute',
    right: -30,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  queueShapeTwo: {
    position: 'absolute',
    right: 40,
    bottom: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  queueContent: {
    zIndex: 1,
  },
  queueLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  queueCount: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  queueSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  queueButton: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
  },
  queueButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginRight: 6,
  },
});

export const QueueCard = React.memo(QueueCard_Fn);
