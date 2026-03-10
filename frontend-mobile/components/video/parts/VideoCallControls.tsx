/**
 * VideoCallControls — Barra inferior de controles da videochamada.
 *
 * Mic | Câmera | Virar | PiP (Android) | Encerrar/Sair
 * Oculto em Picture-in-Picture.
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';

interface VideoCallControlsProps {
  colors: DesignColors;
  insetBottom: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isDoctor: boolean;
  ending: boolean;
  hasPip: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onEnd: () => void;
  onEnterPip?: () => void;
}

export const VideoCallControls = React.memo(function VideoCallControls({
  colors, insetBottom, isMuted, isCameraOff, isDoctor, ending, hasPip,
  onToggleMute, onToggleCamera, onFlipCamera, onEnd, onEnterPip,
}: VideoCallControlsProps) {
  // Cor fixa escura — garante contraste em todos os dispositivos (evita botões brancos invisíveis)
  const btnBg = '#1E293B';

  return (
    <View style={[S.ctrl, { paddingBottom: insetBottom + 12 }]}>
      {hasPip && onEnterPip && (
        <TouchableOpacity style={[S.cb, { backgroundColor: btnBg }]} onPress={onEnterPip}
          accessibilityRole="button" accessibilityLabel="Minimizar em janela flutuante">
          <Ionicons name="contract-outline" size={22} color={colors.white} />
          <Text style={S.cLbl}>Minimizar</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[S.cb, { backgroundColor: isMuted ? 'rgba(239,68,68,0.6)' : btnBg }]}
        onPress={onToggleMute}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? 'Microfone mudo, toque para ativar' : 'Microfone ativo, toque para mutar'}
      >
        <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={colors.white} />
        <Text style={S.cLbl}>{isMuted ? 'Mudo' : 'Mic'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[S.cb, { backgroundColor: isCameraOff ? 'rgba(239,68,68,0.6)' : btnBg }]}
        onPress={onToggleCamera}
        accessibilityRole="button"
        accessibilityLabel={isCameraOff ? 'Câmera desligada' : 'Câmera ligada'}
      >
        <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={22} color={colors.white} />
        <Text style={S.cLbl}>{isCameraOff ? 'Off' : 'Câm'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[S.cb, { backgroundColor: btnBg }]} onPress={onFlipCamera}
        accessibilityRole="button" accessibilityLabel="Virar câmera">
        <Ionicons name="camera-reverse-outline" size={22} color={colors.white} />
        <Text style={S.cLbl}>Virar</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[S.cb, S.endCb, { backgroundColor: colors.destructive }]}
        onPress={onEnd} disabled={ending}
        accessibilityLabel={isDoctor ? 'Encerrar consulta' : 'Sair da chamada'}
      >
        {ending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Ionicons name="call" size={22} color={colors.white} style={{ transform: [{ rotate: '135deg' }] }} />
        )}
        <Text style={S.cLbl}>{isDoctor ? 'Encerrar' : 'Sair'}</Text>
      </TouchableOpacity>
    </View>
  );
});

const S = StyleSheet.create({
  ctrl: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 20, paddingTop: 14, backgroundColor: 'rgba(15,23,42,0.95)',
  },
  cb: { width: 56, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 4 },
  endCb: {},
  cLbl: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },
});
