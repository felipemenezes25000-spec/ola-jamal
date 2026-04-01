/**
 * VideoCallControls — Bottom control bar for video call.
 *
 * Design: 4 circular buttons (48px) + End call (56px red).
 * Mic | Camera | End call (center, larger) | Flip camera
 * Hidden in Picture-in-Picture.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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
  return (
    <View style={[S.ctrl, { paddingBottom: insetBottom + 16 }]}>
      {/* Mic toggle */}
      <TouchableOpacity
        style={[S.cb, isMuted && S.cbActive]}
        onPress={onToggleMute}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? 'Ativar microfone' : 'Silenciar microfone'}
      >
        <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
      </TouchableOpacity>

      {/* Camera toggle */}
      <TouchableOpacity
        style={[S.cb, isCameraOff && S.cbActive]}
        onPress={onToggleCamera}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isCameraOff ? 'Ligar câmera' : 'Desligar câmera'}
      >
        <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={22} color="#fff" />
      </TouchableOpacity>

      {/* End call — larger, red */}
      <TouchableOpacity
        style={S.endCb}
        onPress={onEnd}
        disabled={ending}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isDoctor ? 'Encerrar consulta' : 'Sair da chamada'}
      >
        {ending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        )}
      </TouchableOpacity>

      {/* Flip camera */}
      <TouchableOpacity
        style={S.cb}
        onPress={onFlipCamera}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Trocar câmera"
      >
        <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
      </TouchableOpacity>

      {/* PiP (Android only) — smaller, at the edge */}
      {hasPip && onEnterPip ? (
        <TouchableOpacity
          style={S.cb}
          onPress={onEnterPip}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Minimizar em janela flutuante"
        >
          <Ionicons name="contract-outline" size={20} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const S = StyleSheet.create({
  ctrl: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingTop: 16,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(11,17,32,0.92)',
  },
  // Standard button — 48px circle
  cb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // Active state (muted / camera off)
  cbActive: {
    backgroundColor: 'rgba(239,68,68,0.5)',
  },
  // End call button — 56px red circle
  endCb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    marginHorizontal: 4,
  },
});
