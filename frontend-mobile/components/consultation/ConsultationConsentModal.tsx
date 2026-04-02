import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '../../lib/theme';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { AppButton } from '../../components/ui';
import { apiClient } from '../../lib/api-client';

interface ConsultationConsentModalProps {
  visible: boolean;
  requestId: string;
  onAccepted: () => void;
  onDeclined: () => void;
}

const CONSENT_ITEMS = [
  'A consulta presencial é a referência em atendimento médico e que posso solicitá-la a qualquer momento.',
  'O médico pode, a seu critério clínico, recusar o atendimento por telemedicina e indicar atendimento presencial.',
  'A consulta será transcrita em texto para fins de prontuário. A sessão de vídeo poderá ser gravada para segurança e auditoria, com armazenamento seguro e acesso restrito.',
  'Meus dados serão tratados conforme a LGPD e a Política de Privacidade do RenoveJá+.',
  'Posso revogar este consentimento a qualquer momento.',
] as const;

export function ConsultationConsentModal({
  visible,
  requestId,
  onAccepted,
  onDeclined,
}: ConsultationConsentModalProps) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await apiClient.post(`/api/requests/${requestId}/teleconsultation-consent`, {
        channel: Platform.OS,
      });
      onAccepted();
    } catch (e: unknown) {
      Alert.alert(
        'Erro ao registrar consentimento',
        (e as Error)?.message || 'Tente novamente em instantes.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDeclined}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal accessibilityRole="none">
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={32} color={colors.primary} importantForAccessibility="no" />
            <Text style={styles.title} accessibilityRole="header">Termo de Consentimento</Text>
            <Text style={styles.subtitle}>Resolução CFM 2.314/2022</Text>
          </View>

          {/* Consent text */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.intro}>
              Concordo em realizar esta consulta por telemedicina, estando ciente de que:
            </Text>

            {CONSENT_ITEMS.map((item, index) => (
              <View key={index} style={styles.consentItem} accessible accessibilityLabel={item}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.primary}
                  style={styles.consentIcon}
                  importantForAccessibility="no"
                />
                <Text style={styles.consentText} importantForAccessibility="no">{item}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Buttons */}
          <View style={styles.actions}>
            <AppButton
              title="Aceitar e entrar"
              icon="videocam"
              onPress={handleAccept}
              loading={loading}
              disabled={loading}
            />
            <AppButton
              title="Recusar"
              variant="outline"
              onPress={onDeclined}
              disabled={loading}
              style={styles.declineBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      maxWidth: 420,
      width: '100%',
      maxHeight: '85%',
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
      textAlign: 'center',
    },
    scrollArea: {
      maxHeight: 320,
      marginBottom: spacing.md,
    },
    scrollContent: {
      paddingVertical: spacing.sm,
    },
    intro: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.md,
      lineHeight: 22,
    },
    consentItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    consentIcon: {
      marginTop: 2,
    },
    consentText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    actions: {
      gap: spacing.sm,
    },
    declineBtn: {
      borderColor: colors.textMuted,
    },
  });
}
