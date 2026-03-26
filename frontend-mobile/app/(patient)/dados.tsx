import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../../components/ui';
import { apiClient, getApiErrorMessage } from '../../lib/api-client';
import type { DesignColors, DesignTokens } from '../../lib/designSystem';
import { borderRadius, spacing } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';

type ExportState = 'idle' | 'loading' | 'success' | 'error';

export default function DataExportScreen() {
  const { colors, shadows } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  const [state, setState] = useState<ExportState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleExport = async () => {
    setState('loading');
    setErrorMsg('');

    try {
      const res = await apiClient.get<Record<string, unknown>>('/api/patients/me/export');

      const json = JSON.stringify(res, null, 2);
      const fileUri = `${FileSystem.cacheDirectory}meus-dados-renoveja.json`;

      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      setState('success');

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exportar meus dados',
          UTI: 'public.json',
        });
      } else {
        Alert.alert(
          'Dados exportados',
          'Seus dados foram salvos com sucesso, mas o compartilhamento não está disponível neste dispositivo.',
        );
      }
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e) || 'Erro ao exportar dados. Tente novamente mais tarde.';
      setErrorMsg(msg);
      setState('error');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="download-outline" size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Exportar meus dados</Text>

        {/* LGPD explanation */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.info} />
            <Text style={styles.infoTitle}>Seus direitos (LGPD Art. 18)</Text>
          </View>
          <Text style={styles.infoText}>
            A Lei Geral de Proteção de Dados garante seu direito de acessar todos os dados
            pessoais que mantemos sobre você. Isso inclui dados cadastrais, histórico de
            consultas, prescrições e transcrições.
          </Text>
          <Text style={styles.infoText}>
            Ao exportar, você receberá um arquivo JSON com todas as informações associadas
            à sua conta.
          </Text>
        </View>

        {/* Rate limit warning */}
        <View style={styles.warningCard}>
          <Ionicons name="time-outline" size={18} color={colors.warning} />
          <Text style={styles.warningText}>
            Você pode solicitar uma exportação por hora.
          </Text>
        </View>

        {/* Action button */}
        <View style={styles.buttonWrap}>
          <AppButton
            title={
              state === 'loading'
                ? 'Exportando...'
                : state === 'success'
                  ? 'Exportar novamente'
                  : 'Exportar meus dados'
            }
            onPress={handleExport}
            disabled={state === 'loading'}
            variant="primary"
            size="lg"
            icon="download-outline"
          />
        </View>

        {/* Error message */}
        {state === 'error' && errorMsg ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Success message */}
        {state === 'success' ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
            <Text style={styles.successText}>
              Dados exportados com sucesso! Use o menu de compartilhamento para salvar o arquivo.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: DesignColors, shadows: DesignTokens['shadows']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: 40,
    },
    iconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...shadows.card,
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    infoText: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.warningLight,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
      marginBottom: spacing.lg,
    },
    warningText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: '500',
      flex: 1,
    },
    buttonWrap: {
      marginBottom: spacing.md,
    },
    errorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.errorLight,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
    },
    errorText: {
      fontSize: 13,
      color: colors.error,
      flex: 1,
    },
    successCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.successLight,
      borderRadius: borderRadius.md,
      padding: spacing.sm,
    },
    successText: {
      fontSize: 13,
      color: colors.success,
      flex: 1,
    },
  });
}
