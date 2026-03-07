import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { createPrescriptionRequest } from '../../lib/api';
import { PRESCRIPTION_TYPE_PRICES } from '../../lib/config/pricing';
import { formatBRL } from '../../lib/utils/format';
import { getApiErrorMessage } from '../../lib/api-client';
import { useStickyCtaScrollPadding } from '../../lib/ui/responsive';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard, StepIndicator, StickyCTA } from '../../components/ui';
import { CompatibleImage } from '../../components/CompatibleImage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { evaluatePrescriptionCompleteness } from '../../lib/domain/assistantIntelligence';
import { evaluateAssistantCompleteness } from '../../lib/api';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { showToast } from '../../components/ui/Toast';
import { useInvalidateRequests } from '../../lib/hooks/useRequestsQuery';

const t = theme;
const s = t.spacing;
const r = t.borderRadius;
const typo = t.typography;

/** Previsão ANVISA exibida nos receituários ainda não liberados (AZUL e AMARELO). */
const ANVISA_PREVISAO = 'Liberação conforme regulamentação ANVISA. Previsão de liberação a ser divulgada.';

const TYPES = [
  {
    key: 'simples' as const,
    label: 'Receituário simples',
    desc: 'Medicações de uso contínuo como medicação para diabetes, pressão alta, hipotireoidismo, remédios manipulados, remédios para dor, remédios para ciclo menstrual, reposição de vitaminas, entre outros.',
    price: PRESCRIPTION_TYPE_PRICES.simples,
  },
  {
    key: 'controlado' as const,
    label: 'Receituário controlado - dupla via',
    desc: 'Receitas para medicações controladas de uso contínuo como antidepressivos, anticonvulsivantes, remédios para dormir, remédios controlados para dor.',
    price: PRESCRIPTION_TYPE_PRICES.controlado,
    popular: true,
  },
  {
    key: 'azul' as const,
    label: 'Receituário AZUL',
    desc: 'Receituário para medicações que possuem elevada vigilância por causarem dependência. São feitas em receituário azul.',
    price: PRESCRIPTION_TYPE_PRICES.azul,
    comingSoon: true,
    anvisaPrevisao: ANVISA_PREVISAO,
  },
];

export default function NewPrescription() {
  const router = useRouter();
  const invalidateRequests = useInvalidateRequests();
  const [selectedType, setSelectedType] = useState<'simples' | 'controlado'>('simples');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const currentStep = images.length > 0 ? 3 : 2;
  const listPadding = useStickyCtaScrollPadding();
  const selectedPrice = formatBRL(TYPES.find((type) => type.key === selectedType)?.price ?? 0);
  const completenessLocal = evaluatePrescriptionCompleteness({
    prescriptionType: selectedType,
    imagesCount: images.length,
  });
  const [apiLoading, setApiLoading] = useState(false);
  const { isConnected } = useNetworkStatus();
  const [apiResult, setApiResult] = useState<{
    score: number;
    doneCount: number;
    totalCount: number;
    items: { id: string; label: string; required: boolean; done: boolean }[];
    missingRequired: { id: string; label: string; required: boolean; done: boolean }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setApiLoading(true);
      evaluateAssistantCompleteness({
        flow: 'prescription',
        prescriptionType: selectedType,
        imagesCount: images.length,
      })
        .then((res) => {
          if (!cancelled) {
            const missingRequired = res.checks.filter((c) => c.required && !c.done);
            setApiResult({
              score: res.score,
              doneCount: res.doneCount,
              totalCount: res.totalCount,
              items: res.checks,
              missingRequired,
            });
          }
        })
        .catch(() => { if (!cancelled) setApiResult(null); })
        .finally(() => { if (!cancelled) setApiLoading(false); });
    }, 500); // debounce 500ms
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedType, images.length]);

  const completeness = apiResult
    ? { score: apiResult.score, doneCount: apiResult.doneCount, totalCount: apiResult.totalCount, items: apiResult.items, missingRequired: apiResult.missingRequired }
    : completenessLocal;

  const pickImage = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para fotografar a receita.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para escolher a foto da receita.');
      return;
    }

    const remaining = 5 - images.length;
    if (remaining <= 0) {
      Alert.alert('Limite atingido', 'Máximo de 5 fotos por solicitação.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (!result.canceled && result.assets?.length) {
      const allowed = result.assets.slice(0, remaining);
      setImages([...images, ...allowed.map((a) => a.uri)]);
    }
  };

  /** Dra. Renoveja: dicas por etapa (tipo, fotos). */
  useTriageEval({
    context: 'prescription',
    step: images.length > 0 ? 'photos_added' : 'type_selected',
    role: 'patient',
    requestType: 'prescription',
    prescriptionType: selectedType,
    imagesCount: images.length,
  });

  const handleSubmit = async () => {
    if (loading) return;
    if (isConnected === false) {
      Alert.alert('Sem conexão', 'Conecte-se à internet para enviar sua solicitação.');
      return;
    }
    if (completeness.missingRequired.length > 0) {
      Alert.alert(
        'Faltam itens para enviar',
        completeness.missingRequired.map((item) => `• ${item.label}`).join('\n')
      );
      return;
    }

    if (images.length === 0) {
      Alert.alert('Foto necessária', 'Tire uma foto da receita antiga para continuar.');
      return;
    }

    setLoading(true);
    try {
      const result = await createPrescriptionRequest({
        prescriptionType: selectedType,
        medications: undefined,
        images,
      });
      // A IA analisa na hora – se rejeitou, avisar imediatamente (não dizer sucesso)
      if (result.request?.status === 'rejected') {
        const msg =
          result.request.aiMessageToUser ||
          result.request.rejectionReason ||
          'A imagem não parece ser de uma receita médica. Envie apenas fotos do documento da receita (papel ou tela com medicamentos).';
        Alert.alert(
          'Imagem não reconhecida',
          msg,
          [{ text: 'Tentar novamente', style: 'default' }]
        );
        return;
      }
      invalidateRequests();
      showToast({ message: 'Solicitação enviada! Acompanhe na aba Pedidos.', type: 'success' });
      router.replace('/(patient)/requests');
    } catch (error: unknown) {
      showToast({ message: getApiErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false} edges={['bottom']} padding={false}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: listPadding }]} showsVerticalScrollIndicator={false}>
          <AppHeader title="Renovação de Receita" />
          <StepIndicator current={currentStep} total={3} labels={['Tipo', 'Foto', 'Revisão']} />
          {isConnected === false && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
              <Text style={styles.offlineText}>Você está offline. Não será possível enviar até reconectar.</Text>
            </View>
          )}
          <AppCard style={[styles.assistantCard, apiLoading && styles.assistantCardLoading]}>
            <View style={styles.assistantHeader}>
              <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
              <Text style={styles.assistantTitle}>Dra. Renoveja: qualidade do envio</Text>
              {apiLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.assistantLoading} />
              )}
            </View>
            <Text style={styles.assistantProgress}>Seu pedido está {completeness.score}% pronto</Text>
            {completeness.missingRequired.map((item) => (
              <Text key={item.id} style={styles.assistantMissing}>• {item.label}</Text>
            ))}
            {completeness.missingRequired.length === 0 ? (
              <Text style={styles.assistantGood}>Tudo certo para enviar. Vamos finalizar.</Text>
            ) : null}
          </AppCard>

          {/* Type Selection */}
          <Text style={styles.sectionLabel}>TIPO DE RECEITA</Text>
          {TYPES.map(type => {
            const isComingSoon = 'comingSoon' in type && type.comingSoon;
            const isSelectable = !isComingSoon && (type.key === 'simples' || type.key === 'controlado');
            return (
              <AppCard
                key={type.key}
                selected={isSelectable && selectedType === type.key}
                onPress={isSelectable ? () => setSelectedType(type.key) : undefined}
                style={StyleSheet.flatten(isComingSoon ? [styles.typeCard, styles.typeCardDisabled] : styles.typeCard)}
              >
                <View style={styles.typeContent}>
                  <View style={styles.typeTextContainer}>
                    <View style={styles.typeTitleRow}>
                      <Text
                        style={[
                          styles.typeName,
                          selectedType === type.key && styles.typeNameSelected,
                          isComingSoon && styles.typeNameDisabled,
                        ]}
                      >
                        {type.label}
                      </Text>
                      {type.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularText}>POPULAR</Text>
                        </View>
                      )}
                      {isComingSoon && (
                        <View style={styles.comingSoonBadge}>
                          <Text style={styles.comingSoonText}>Em breve</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.typeDesc, isComingSoon && styles.typeDescDisabled]}>{type.desc}</Text>
                    {isComingSoon && 'anvisaPrevisao' in type && type.anvisaPrevisao && (
                      <Text style={styles.anvisaPrevisao}>{type.anvisaPrevisao}</Text>
                    )}
                  </View>
                  {!isComingSoon && (
                    <View style={styles.typePriceContainer}>
                      <Text
                        style={[
                          styles.typePrice,
                          selectedType === type.key && styles.typePriceSelected,
                        ]}
                      >
                        {formatBRL(type.price)}
                      </Text>
                    </View>
                  )}
                </View>
                {isSelectable && selectedType === type.key && (
                  <View style={styles.checkIcon} pointerEvents="none">
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  </View>
                )}
              </AppCard>
            );
          })}

          {/* Photo */}
          <Text style={styles.sectionLabel}>FOTO DA RECEITA</Text>

          {/* Warning card — prominente, não pode ser ignorado */}
          <View style={styles.photoWarningCard}>
            <Ionicons name="warning" size={18} color={colors.warning} />
            <Text style={styles.photoWarningText}>
              Envie <Text style={styles.photoWarningBold}>somente</Text> fotos do documento da receita (papel ou tela com os medicamentos). Outras imagens serão rejeitadas automaticamente.
            </Text>
          </View>

          {/* Status: fotos adicionadas ou prompt para adicionar */}
          {images.length > 0 ? (
            <View style={styles.photoStatusRow}>
              <View style={styles.photoStatusSuccess}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.photoStatusText}>
                  {images.length} foto{images.length > 1 ? 's' : ''} adicionada{images.length > 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={styles.photoStatusHint}>máx. 5</Text>
            </View>
          ) : (
            <View style={styles.photoRequiredRow}>
              <Ionicons name="camera-outline" size={14} color={colors.warning} />
              <Text style={styles.photoRequiredText}>Adicione ao menos 1 foto para continuar</Text>
            </View>
          )}

          <View style={styles.photoRow}>
            <Pressable
              style={({ pressed }) => [styles.photoButton, pressed && styles.photoButtonPressed]}
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Tirar foto da receita com a câmera"
            >
              <View style={styles.photoIconCircle}>
                <Ionicons name="camera" size={26} color={colors.primary} />
              </View>
              <Text style={styles.photoButtonText}>Câmera</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.photoButton, pressed && styles.photoButtonPressed]}
              onPress={pickFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Escolher foto da receita na galeria"
            >
              <View style={styles.photoIconCircle}>
                <Ionicons name="image" size={26} color={colors.primary} />
              </View>
              <Text style={styles.photoButtonText}>Galeria</Text>
            </Pressable>
          </View>

          {images.length > 0 && (
            <View style={styles.imagesRow}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <CompatibleImage uri={uri && typeof uri === 'string' ? uri : undefined} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImage}
                    onPress={() => setImages(images.filter((_, i) => i !== index))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover foto ${index + 1}`}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={styles.infoText}>
              Sua solicitação será analisada por um médico em até 15 minutos. Caso não seja aprovada,
              o valor será estornado integralmente.
            </Text>
          </View>
        </ScrollView>
        <StickyCTA
          summaryTitle="Total"
          summaryValue={selectedPrice}
          summaryHint={`${completeness.score}% pronto • ${images.length} ${images.length === 1 ? 'foto anexada' : 'fotos anexadas'}`}
          primary={{
            label: 'Enviar solicitação',
            onPress: handleSubmit,
            loading,
            disabled: loading || images.length === 0 || isConnected === false,
          }}
        />
      </View>
    </Screen>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
    body: {
      flexGrow: 1,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
    },
    offlineBanner: {
      marginTop: s.md,
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: r.sm,
      paddingVertical: s.sm,
      paddingHorizontal: s.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    offlineText: { flex: 1, color: colors.textSecondary, fontSize: 12 },
    sectionLabel: {
      ...typo.variants.overline,
      color: colors.textSecondary,
      marginTop: s.lg,
      marginBottom: s.sm,
    } as any,
    stepHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: s.sm,
      lineHeight: 20,
    },
    assistantCard: {
      marginTop: s.md,
      borderWidth: 1,
      borderColor: colors.primarySoft,
      backgroundColor: colors.primarySoft + '66',
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    assistantCardLoading: {
      opacity: 0.95,
    },
    assistantLoading: {
      marginLeft: 'auto',
    },
    assistantHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    assistantTitle: {
      fontSize: 13,
      fontWeight: typo.fontWeight.bold,
      color: colors.primary,
    },
    assistantProgress: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: typo.fontWeight.semibold,
      color: colors.text,
    },
    assistantMissing: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    assistantGood: {
      marginTop: 8,
      fontSize: 12,
      color: colors.success,
      fontWeight: typo.fontWeight.semibold,
    },
    typeCard: {
      marginBottom: s.sm,
      position: 'relative',
    },
    typeCardDisabled: {
      opacity: 0.92,
      backgroundColor: colors.surface,
    },
    typeContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    typeTextContainer: {
      flex: 1,
      marginRight: 36,
      minWidth: 0,
    },
    typeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    typeName: {
      fontSize: typo.fontSize.md,
      fontWeight: typo.fontWeight.semibold,
      color: colors.text,
    },
    typeNameSelected: {
      color: colors.primary,
    },
    popularBadge: {
      backgroundColor: colors.primaryDark,
      paddingHorizontal: s.sm,
      paddingVertical: 4,
      borderRadius: r.full,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    popularText: {
      fontSize: typo.fontSize.xs,
      fontWeight: typo.fontWeight.bold,
      color: colors.white,
    },
    typeDesc: {
      fontSize: typo.variants.caption.fontSize,
      color: colors.textSecondary,
      marginTop: 2,
    },
    typeNameDisabled: {
      color: colors.textSecondary,
    },
    typeDescDisabled: {
      color: colors.textMuted,
    },
    comingSoonBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: s.sm,
      paddingVertical: 2,
      borderRadius: r.full,
    },
    comingSoonText: {
      fontSize: typo.fontSize.xs,
      fontWeight: typo.fontWeight.semibold,
      color: colors.textSecondary,
    },
    anvisaPrevisao: {
      fontSize: typo.fontSize.xs,
      color: colors.textMuted,
      fontStyle: 'italic',
      marginTop: s.xs,
      lineHeight: 16,
    },
    typePriceContainer: {
      alignItems: 'flex-end',
    },
    typePrice: {
      fontSize: typo.fontSize.lg,
      fontWeight: typo.fontWeight.bold,
      color: colors.text,
    },
    typePriceSelected: {
      color: colors.primary,
    },
    checkIcon: {
      position: 'absolute',
      top: s.md,
      right: s.md,
    },
    photoWarningCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: r.md,
      padding: s.md,
      marginBottom: s.sm,
    },
    photoWarningText: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      lineHeight: 19,
      color: colors.warning,
    },
    photoWarningBold: {
      fontWeight: typo.fontWeight.bold,
    },
    photoStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.sm,
    },
    photoStatusSuccess: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    photoStatusText: {
      fontSize: 13,
      fontWeight: typo.fontWeight.semibold,
      color: colors.success,
    },
    photoStatusHint: {
      fontSize: 12,
      color: colors.textMuted,
    },
    photoRequiredRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: s.sm,
    },
    photoRequiredText: {
      fontSize: 13,
      color: colors.warning,
      fontWeight: typo.fontWeight.medium,
    },
    photoRow: {
      flexDirection: 'row',
      gap: s.md,
    },
    photoButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: s.lg,
      minHeight: 110,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: s.sm,
      ...t.shadows.sm,
    },
    photoButtonPressed: {
      opacity: 0.75,
      transform: [{ scale: 0.97 }],
    },
    photoIconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoButtonText: {
      fontSize: typo.fontSize.sm,
      color: colors.primary,
      fontWeight: typo.fontWeight.semibold,
    },
    imagesRow: {
      flexDirection: 'row',
      marginTop: s.sm,
      gap: s.sm,
    },
    imageContainer: {
      position: 'relative',
      overflow: 'visible',
    },
    imagePreview: {
      width: 88,
      height: 88,
      borderRadius: 14,
    },
    removeImage: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: colors.surface,
      borderRadius: r.full,
    },
    infoBox: {
      flexDirection: 'row',
      backgroundColor: colors.infoLight,
      marginTop: s.lg,
      marginBottom: s.md,
      padding: s.md,
      borderRadius: r.lg,
      gap: s.sm,
      alignItems: 'flex-start',
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      minWidth: 0,
    },
  });
}
