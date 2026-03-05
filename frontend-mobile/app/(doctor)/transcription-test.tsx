/**
 * Tela de teste de transcrição — valida Deepgram sem consulta ativa.
 * Acesse via: router.push('/(doctor)/transcription-test')
 * Requer backend em ASPNETCORE_ENVIRONMENT=Development.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { transcribeTestAudio } from '../../lib/api';
import { colors } from '../../lib/themeDoctor';

const RECORD_SECONDS = 8;
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: 2,
    audioEncoder: 3,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: 0x40,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

export default function TranscriptionTestScreen() {
  const [status, setStatus] = useState<'idle' | 'recording' | 'sending' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ transcribed: boolean; text?: string; fileSize?: number; error?: string } | null>(null);

  const runTest = useCallback(async () => {
    try {
      setStatus('recording');
      setResult(null);

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permissão de microfone necessária para o teste.');
        setStatus('error');
        setResult({ transcribed: false, error: 'Permissão de microfone negada' });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      await new Promise((r) => setTimeout(r, RECORD_SECONDS * 1000));
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) {
        setStatus('error');
        setResult({ transcribed: false, error: 'Falha ao obter gravação' });
        return;
      }

      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = fileInfo.exists ? ((fileInfo as unknown as { size?: number }).size ?? 0) : 0;
      if (!fileInfo.exists || (fileSize ?? 0) < 500) {
        setStatus('error');
        setResult({ transcribed: false, error: `Arquivo muito pequeno (${fileSize ?? 0} bytes). Fale durante a gravação.` });
        return;
      }

      setStatus('sending');
      const extension = Platform.OS === 'web' ? 'webm' : 'm4a';
      const mimeType = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
      const res = await transcribeTestAudio({
        uri,
        name: `test_${Date.now()}.${extension}`,
        type: mimeType,
      });

      setResult({
        transcribed: res.transcribed ?? false,
        text: res.text,
        fileSize: res.fileSize,
      });
      setStatus('done');
    } catch (e: any) {
      const msg = e?.message || 'Erro desconhecido';
      setStatus('error');
      setResult({ transcribed: false, error: msg });
      if (__DEV__) console.warn('[TranscriptionTest]', e);
    }
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Teste de Transcrição',
          headerBackTitle: 'Voltar',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Ionicons name="mic" size={48} color={colors.primary} />
          <Text style={styles.title}>Teste de Transcrição</Text>
          <Text style={styles.subtitle}>
            Grava {RECORD_SECONDS}s de áudio e envia para o backend (Deepgram).{'\n'}
            Requer backend em <Text style={styles.code}>Development</Text> e <Text style={styles.code}>OpenAI:ApiKey</Text> configurada.
          </Text>

          {status === 'idle' && (
            <TouchableOpacity style={styles.btn} onPress={runTest} activeOpacity={0.8}>
              <Ionicons name="mic" size={20} color="#fff" />
              <Text style={styles.btnText}>Gravar e testar</Text>
            </TouchableOpacity>
          )}

          {status === 'recording' && (
            <View style={styles.recording}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>Gravando... fale durante {RECORD_SECONDS}s</Text>
            </View>
          )}

          {status === 'sending' && (
            <View style={styles.sending}>
              <Text style={styles.sendingText}>Enviando para transcrição...</Text>
            </View>
          )}

          {result && (
            <View style={[styles.result, result.error && styles.resultError]}>
              {result.error ? (
                <>
                  <Ionicons name="alert-circle" size={24} color={colors.error} />
                  <Text style={styles.resultTitle}>Erro</Text>
                  <Text style={styles.resultText}>{result.error}</Text>
                  {result.error.includes('404') && (
                    <Text style={styles.hint}>
                      O endpoint /transcribe-test só existe em Development. Rode o backend localmente com ASPNETCORE_ENVIRONMENT=Development.
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Ionicons name={result.transcribed ? 'checkmark-circle' : 'close-circle'} size={24} color={result.transcribed ? colors.success : colors.error} />
                  <Text style={styles.resultTitle}>{result.transcribed ? 'Transcrição OK' : 'Sem texto detectado'}</Text>
                  {result.fileSize && <Text style={styles.meta}>Tamanho: {Math.round(result.fileSize / 1024)} KB</Text>}
                  {result.text && <Text style={styles.resultText}>{result.text}</Text>}
                </>
              )}
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setStatus('idle'); setResult(null); }}>
                <Text style={styles.btnSecondaryText}>Testar novamente</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 12 },
  subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  recording: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.error },
  recText: { color: colors.textSecondary, fontSize: 14 },
  sending: { marginTop: 24 },
  sendingText: { color: colors.textSecondary, fontSize: 14 },
  result: {
    marginTop: 24,
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  resultError: { borderWidth: 1, borderColor: colors.error + '40' },
  resultTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 8 },
  resultText: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 12, textAlign: 'center', fontStyle: 'italic' },
  btnSecondary: { marginTop: 16 },
  btnSecondaryText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
