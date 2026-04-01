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
import { getApiErrorMessage } from '../../lib/api-client';
import { isDuplicateRequestError } from '../../lib/hooks/useCreateRequest';
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

const s = theme.spacing;
const _r = theme.borderRadius;
const ty = theme.typography;

const ANVISA_PREVISAO = 'Liberação conforme regulamentação ANVISA. Previsão de liberação a ser divulgada.';

const TYPES = [
  {
    key: 'simples' as const,
    label: 'Receituário simples',
    desc: 'Medicações de uso contínuo como medicação para diabetes, pressão alta, hipotireoidismo, remédios manipulados, remédios para dor, remédios para ciclo menstrual, reposição de vitaminas, entre outros.',
  },
  {
    key: 'controlado' as const,
    label: 'Receituário controlado - dupla via',
    desc: 'Receitas para medicações controladas de uso contínuo como antidepressivos, anticonvulsivantes, remédios para dormir, remédios controlados para dor.',
    popular: true,
  },
  {
    key: 'azul' as const,
    label: 'Receituário AZUL',
    desc: 'Receituário para medicações que possuem elevada vigilância por causarem dependência. São feitas em receituário azul.',
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
    }, 500);
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
      if (isDuplicateRequestError(error)) {
        const { code, cooldownDays, message } = error;
        if (code === 'active_request') {
          Alert.alert(
            'Pedido em andamento',
            message,
            [
              { text: 'Ver meus pedidos', onPress: () => router.replace('/(patient)/requests'), style: 'default' },
              { text: 'OK', style: 'cancel' },
            ]
          );
        } else if (code === 'cooldown_prescription' && cooldownDays != null) {
          Alert.alert(
            'Renovação muito cedo',
            `${message}\n\nPrazo mínimo exigido pela regulamentação médica (CFM/ANVISA).`,
            [{ text: 'Entendi', style: 'default' }]
          );
        } else {
          Alert.alert('Não foi possível enviar', message, [{ text: 'OK' }]);
        }
      } else {
        showToast({ message: getApiErrorMessage(error), type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false} edges={['top', 'bottom']} padding={false}>
      <View style={styles.flex1}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: listPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader title="Renovação de Receita" />
          <StepIndicator
            current={currentStep}
            total={3}
            labels={['Tipo', 'Foto', 'Revisão']}
            showConnectorLines={false}
          />

          {isConnected === false && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
              <Text style={styles.offlineText}>Você está offline. Não será possível enviar até reconectar.</Text>
            </View>
          )}

          {/* AI Completeness Card */}
          <View style={[styles.completenessCard, apiLoading && styles.completenessCardLoading]}>
            <View style={styles.completenessHeader}>
              <View style={styles.completenessIconWrap}>
                <Ionicons name="sparkles" size={16} color="#8B5CF6" />
              </View>
              <Text style={styles.completenessTitle}>Qualidade do envio</Text>
              {apiLoading && (
                <ActivityIndicator size="small" color={colors.primary} style={styles.mlAuto} />
              )}
            </View>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${completeness.score}%`,
                    backgroundColor: completeness.score === 100 ? '#22C55E' : colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={styles.completenessScore}>{completeness.score}% pronto</Text>
            {completeness.missingRequired.map((item) => (
              <View key={item.id} style={styles.missingRow}>
                <Ionicons name="ellipse-outline" size={12} color={colors.textMuted} />
                <Text style={styles.missingText}>{item.label}</Text>
              </View>
            ))}
            {completeness.missingRequired.length === 0 && (
              <View style={styles.missingRow}>
                <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                <Text style={styles.readyText}>Tudo certo para enviar</Text>
              </View>
            )}
          </View>

          {/* Type Selection */}
          <Text style={styles.sectionLabel}>Tipo de receita</Text>
          <View style={styles.typeList}>
            {TYPES.map(type => {
              const isComingSoon = 'comingSoon' in type && type.comingSoon;
              const isSelectable = !isComingSoon && (type.key === 'simples' || type.key === 'controlado');
              const isSelected = isSelectable && selectedType === type.key;
              return (
                <AppCard
                  key={type.key}
                  selected={isSelected}
                  onPress={isSelectable ? () => setSelectedType(type.key) : undefined}
                  style={StyleSheet.flatten([
                    styles.typeCard,
                    isComingSoon && styles.typeCardDisabled,
                  ])}
                >
                  <View style={styles.typeRow}>
                    <View style={styles.typeRadio}>
                      {isSelected ? (
                        <View style={styles.typeRadioSelected}>
                          <View style={styles.typeRadioDot} />
                        </View>
                      ) : (
                        <View style={[
                          styles.typeRadioEmpty,
                          isComingSoon && styles.typeRadioDisabled,
                        ]} />
                      )}
                    </View>
                    <View style={styles.typeTextContainer}>
                      <View style={styles.typeTitleRow}>
                        <Text
                          style={[
                            styles.typeName,
                            isSelected && styles.typeNameSelected,
                            isComingSoon && styles.typeNameDisabled,
                          ]}
                          numberOfLines={2}
                        >
                          {type.label}
                        </Text>
                        {'popular' in type && type.popular && (
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
                      <Text
                        style={[styles.typeDesc, isComingSoon && styles.typeDescDisabled]}
                        numberOfLines={4}
                      >
                        {type.desc}
                      </Text>
                      {isComingSoon && 'anvisaPrevisao' in type && type.anvisaPrevisao && (
                        <Text style={styles.anvisaPrevisao}>{type.anvisaPrevisao}</Text>
                      )}
                    </View>
                  </View>
                </AppCard>
              );
            })}
          </View>

          {/* Photo Upload */}
          <Text style={styles.sectionLabel}>Foto da receita</Text>

          <View style={styles.warningCard}>
            <Ionicons name="warning" size={16} color={colors.warning} />
            <Text style={styles.warningText}>
              Envie <Text style={styles.warningBold}>somente</Text> fotos da receita (papel ou tela). Outras imagens serão rejeitadas.
            </Text>
          </View>

          {images.length > 0 ? (
            <View style={styles.photoStatusRow}>
              <View style={styles.photoStatusLeft}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
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

          <View style={styles.photoButtons}>
            <Pressable
              style={({ pressed }) => [styles.photoButton, pressed && styles.photoButtonPressed]}
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Tirar foto da receita com a câmera"
            >
              <View style={styles.photoIconCircle}>
                <Ionicons name="camera" size={24} color={colors.primary} />
              </View>
              <Text style={styles.photoButtonLabel}>Câmera</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.photoButton, pressed && styles.photoButtonPressed]}
              onPress={pickFromGallery}
              accessibilityRole="button"
              accessibilityLabel="Escolher foto da receita na galeria"
            >
              <View style={styles.photoIconCircle}>
                <Ionicons name="image" size={24} color={colors.primary} />
              </View>
              <Text style={styles.photoButtonLabel}>Galeria</Text>
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
            <Ionicons name="time-outline" size={18} color={colors.info} />
            <Text style={styles.infoText}>
              Sua solicitação será analisada por um médico em até 15 minutos.
            </Text>
          </View>
        </ScrollView>

        <StickyCTA
          summaryTitle="Resumo"
          summaryValue={`${completeness.score}% pronto`}
          summaryHint={`${images.length} ${images.length === 1 ? 'foto anexada' : 'fotos anexadas'}`}
          primary={{
            label: 'Enviar pedido',
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
    flex1: { flex: 1 },
    body: {
      flexGrow: 1,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
    },
    offlineBanner: {
      marginTop: s.md,
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 10,
      paddingVertical: s.sm,
      paddingHorizontal: s.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
    },
    offlineText: { flex: 1, color: colors.textSecondary, fontSize: 12 },

    /* Completeness Card */
    completenessCard: {
      marginTop: s.md,
      marginBottom: s.md,
      padding: s.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    completenessCardLoading: { opacity: 0.9 },
    completenessHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.xs,
      marginBottom: s.sm,
    },
    completenessIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: '#8B5CF6' + '14',
      alignItems: 'center',
      justifyContent: 'center',
    },
    completenessTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    mlAuto: { marginLeft: 'auto' },
    progressBarBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      marginBottom: 6,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: 6,
      borderRadius: 3,
    },
    completenessScore: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    missingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    missingText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 16,
    },
    readyText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#22C55E',
    },

    /* Section */
    sectionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginTop: s.lg,
      marginBottom: s.sm,
    },

    /* Type Cards */
    typeList: {
      gap: s.sm,
    },
    typeCard: {
      padding: s.md,
    },
    typeCardDisabled: {
      opacity: 0.85,
      backgroundColor: colors.surfaceSecondary,
    },
    typeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    typeRadio: {
      marginRight: s.sm,
      marginTop: 2,
    },
    typeRadioSelected: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeRadioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    typeRadioEmpty: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.textMuted,
    },
    typeRadioDisabled: {
      borderColor: colors.border,
    },
    typeTextContainer: {
      flex: 1,
      minWidth: 0,
    },
    typeTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: s.sm,
    },
    typeName: {
      fontSize: ty.fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
    typeNameSelected: {
      color: colors.primary,
    },
    typeNameDisabled: {
      color: colors.textMuted,
    },
    popularBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    popularText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
      textTransform: 'uppercase',
    },
    comingSoonBadge: {
      backgroundColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
    },
    comingSoonText: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    typeDesc: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 17,
    },
    typeDescDisabled: {
      color: colors.textMuted,
    },
    anvisaPrevisao: {
      fontSize: 11,
      color: colors.textMuted,
      fontStyle: 'italic',
      marginTop: s.xs,
      lineHeight: 16,
    },

    /* Warning */
    warningCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
      backgroundColor: colors.warningLight,
      borderRadius: 12,
      padding: s.md,
      marginBottom: s.sm,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: colors.warning,
    },
    warningBold: {
      fontWeight: '700',
    },

    /* Photo status */
    photoStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: s.sm,
    },
    photoStatusLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    photoStatusText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#22C55E',
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
      fontWeight: '500',
    },

    /* Photo Buttons */
    photoButtons: {
      flexDirection: 'row',
      gap: s.md,
    },
    photoButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: s.lg,
      minHeight: 100,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: s.sm,
    },
    photoButtonPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },
    photoIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoButtonLabel: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },

    /* Images */
    imagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: s.sm,
      gap: s.sm,
    },
    imageContainer: {
      position: 'relative',
      overflow: 'visible',
    },
    imagePreview: {
      width: 80,
      height: 80,
      borderRadius: 12,
    },
    removeImage: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: colors.surface,
      borderRadius: 999,
    },

    /* Info */
    infoBox: {
      flexDirection: 'row',
      backgroundColor: colors.infoLight,
      marginTop: s.lg,
      marginBottom: s.md,
      padding: s.md,
      borderRadius: 12,
      gap: s.sm,
      alignItems: 'center',
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
}
