import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EmergencyCategory } from '../../lib/domain/assistantIntelligence';

interface EmergencyAlertProps {
  category: EmergencyCategory | null;
  guidance: string;
  matchedSignals: string[];
  onDismiss: () => void;
  onContinue: () => void;
}

function callNumber(number: string) {
  const url = Platform.OS === 'android' ? `tel:${number}` : `telprompt:${number}`;
  Linking.openURL(url).catch(() => {});
}

export function EmergencyAlert({ category, guidance, matchedSignals, onDismiss, onContinue }: EmergencyAlertProps) {
  const isPsych = category === 'psychological';

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {/* Icon */}
        <View style={[styles.iconCircle, isPsych ? styles.iconCirclePsych : styles.iconCirclePhysical]}>
          <Ionicons
            name={isPsych ? 'heart' : 'warning'}
            size={32}
            color="#FFFFFF"
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isPsych ? 'Precisamos conversar' : 'Alerta de emergência'}
        </Text>

        {/* Guidance message */}
        <Text style={styles.guidance}>{guidance}</Text>

        {/* Matched signals */}
        {matchedSignals.length > 0 && (
          <View style={styles.signalsWrap}>
            <Text style={styles.signalsLabel}>Sinais identificados:</Text>
            <Text style={styles.signalsText}>{matchedSignals.join(', ')}</Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {isPsych ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnCvv]}
              onPress={() => callNumber('188')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ligar para o CVV, 188"
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <View>
                <Text style={styles.actionBtnLabel}>Ligar para o CVV</Text>
                <Text style={styles.actionBtnNumber}>188 - 24h, gratuito</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSamu]}
              onPress={() => callNumber('192')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ligar para o SAMU, 192"
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
              <View>
                <Text style={styles.actionBtnLabel}>Ligar SAMU</Text>
                <Text style={styles.actionBtnNumber}>192 - Emergência</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Secondary: continue anyway */}
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onContinue}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Continuar mesmo assim"
          >
            <Text style={styles.continueBtnText}>Continuar mesmo assim</Text>
          </TouchableOpacity>

          {/* Dismiss */}
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Voltar e editar"
          >
            <Text style={styles.dismissBtnText}>Voltar e editar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 100,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCirclePhysical: {
    backgroundColor: '#EF4444',
  },
  iconCirclePsych: {
    backgroundColor: '#8B5CF6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  guidance: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 16,
  },
  signalsWrap: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 20,
  },
  signalsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  signalsText: {
    fontSize: 13,
    color: '#B91C1C',
    lineHeight: 18,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  actionBtnSamu: {
    backgroundColor: '#EF4444',
  },
  actionBtnCvv: {
    backgroundColor: '#8B5CF6',
  },
  actionBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBtnNumber: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  continueBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dismissBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
