import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { createPrescriptionRequest } from '../../lib/api';
import { validate } from '../../lib/validation';
import { createPrescriptionSchema } from '../../lib/validation/schemas';
import { PRESCRIPTION_TYPE_PRICES } from '../../lib/config/pricing';
import { formatBRL } from '../../lib/utils/format';
import { getApiErrorMessage } from '../../lib/api-client';
import { useListBottomPadding } from '../../lib/ui/responsive';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard, StepIndicator, StickyCTA } from '../../components/ui';
import { CompatibleImage } from '../../components/CompatibleImage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { evaluatePrescriptionCompleteness } from '../../lib/domain/assistantIntelligence';
import { evaluateAssistantCompleteness } from '../../lib/api';

const t = theme;
const c = t.colors;
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
  {
    key: 'amarelo' as const,
    label: 'Receituário AMARELO',
    desc: 'Receituário para medicamentos sujeitos a controle especial (lista B1/B2 – amarelo).',
    price: PRESCRIPTION_TYPE_PRICES.amarelo,
    comingSoon: true,
    anvisaPrevisao: ANVISA_PREVISAO,
  },
];

export default function NewPrescription() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'simples' | 'controlado'>('simples');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const currentStep = images.length > 0 ? 3 : 2;
  const listPadding = useListBottomPadding();
  const selectedPrice = formatBRL(TYPES.find((type) => type.key === selectedType)?.price ?? 0);
  const completenessLocal = evaluatePrescriptionCompleteness({
    prescriptionType: selectedType,
    imagesCount: images.length,
  });
  const [apiLoading, setApiLoading] = useState(false);
  const [apiResult, setApiResult] = useState<{
    score: number;
    doneCount: number;
    totalCount: number;
    items: { id: string; label: string; required: boolean; done: boolean }[];
    missingRequired: { id: string; label: string; required: boolean; done: boolean }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      .catch(() => { if (!cancelled) setApiResult(null); });
    return () => { cancelled = true; };
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
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (!result.canceled && result.assets?.length) {
      setImages([...images, ...result.assets.map((a) => a.uri)]);
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
          [{ text: 'Entendi', style: 'default' }]
        );
        return;
      }
      Alert.alert('Sucesso!', 'Sua solicitação foi enviada. Acompanhe o status na lista de pedidos.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: unknown) {
      Alert.alert('Erro', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false} edges={['bottom']} padding={false}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: listPadding + 150 }]} showsVerticalScrollIndicator={false}>
          <AppHeader title="Renovação de Receita" />
          <StepIndicator current={currentStep} total={3} labels={['Tipo', 'Foto', 'Revisão']} />
          <AppCard style={[styles.assistantCard, apiLoading && styles.assistantCardLoading]}>
            <View style={styles.assistantHeader}>
              <Ionicons name="sparkles-outline" size={18} color={c.primary.main} />
              <Text style={styles.assistantTitle}>Dra. Renoveja: qualidade do envio</Text>
              {apiLoading && (
                <ActivityIndicator size="small" color={c.primary.main} style={styles.assistantLoading} />
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
          {currentStep === 1 && (
            <Text style={styles.stepHint}>Passo 1 — Selecione o tipo de receita tocando em um dos cards abaixo.</Text>
          )}
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
                  <View style={styles.checkIcon}>
                    <Ionicons name="checkmark-circle" size={24} color={c.primary.main} />
                  </View>
                )}
              </AppCard>
            );
          })}

          {/* Photo */}
          <Text style={styles.sectionLabel}>FOTO DA RECEITA</Text>
          {currentStep === 2 && (
            <Text style={styles.stepHint}>Passo 2 — Envie a foto da sua receita. Toque em Câmera (tirar foto) ou Galeria (escolher da galeria).</Text>
          )}
          <Text style={styles.photoHint}>
            Envie APENAS fotos do documento da receita (papel ou tela com medicamentos). Fotos de
            pessoas, animais ou outros objetos serão rejeitadas automaticamente.
          </Text>
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="camera" size={26} color={c.primary.main} />
              </View>
              <Text style={styles.photoButtonText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="image" size={26} color={c.primary.main} />
              </View>
              <Text style={styles.photoButtonText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          {images.length > 0 && (
            <View style={styles.imagesRow}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <CompatibleImage uri={uri && typeof uri === 'string' ? uri : undefined} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImage}
                    onPress={() => setImages(images.filter((_, i) => i !== index))}
                  >
                    <Ionicons name="close-circle" size={22} color={c.status.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={c.status.info} />
            <Text style={styles.infoText}>
              Sua solicitação será analisada por um médico em até 15 minutos. Caso não seja aprovada,
              o valor será estornado integralmente.
            </Text>
          </View>
        </ScrollView>
        <StickyCTA
          summaryTitle="Total"
          summaryValue={selectedPrice}
          summaryHint={`${completeness.score}% pronto • ${images.length} foto(s) anexada(s)`}
          primary={{
            label: 'Enviar solicitação',
            onPress: handleSubmit,
            loading,
            disabled: loading || images.length === 0,
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flexGrow: 1,
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
  },
  sectionLabel: {
    ...typo.variants.overline,
    color: c.text.secondary,
    marginTop: s.lg,
    marginBottom: s.sm,
  } as any,
  stepHint: {
    fontSize: 13,
    color: c.text.secondary,
    marginBottom: s.sm,
    lineHeight: 20,
  },
  assistantCard: {
    marginTop: s.md,
    borderWidth: 1,
    borderColor: c.primary.soft,
    backgroundColor: c.primary.soft + '66',
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
    color: c.primary.main,
  },
  assistantProgress: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: typo.fontWeight.semibold,
    color: c.text.primary,
  },
  assistantMissing: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: c.text.secondary,
  },
  assistantGood: {
    marginTop: 8,
    fontSize: 12,
    color: c.status.success,
    fontWeight: typo.fontWeight.semibold,
  },
  typeCard: {
    marginBottom: s.sm,
    position: 'relative',
  },
  typeCardDisabled: {
    opacity: 0.92,
    backgroundColor: c.background.paper,
  },
  typeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeTextContainer: {
    flex: 1,
    marginRight: s.sm,
  },
  typeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  typeName: {
    fontSize: typo.fontSize.md,
    fontWeight: typo.fontWeight.semibold,
    color: c.text.primary,
  },
  typeNameSelected: {
    color: c.primary.main,
  },
  popularBadge: {
    backgroundColor: c.primary.dark,
    paddingHorizontal: s.sm,
    paddingVertical: 2,
    borderRadius: r.full,
  },
  popularText: {
    fontSize: typo.fontSize.xs,
    fontWeight: typo.fontWeight.bold,
    color: c.primary.contrast,
  },
  typeDesc: {
    fontSize: typo.variants.caption.fontSize,
    color: c.text.secondary,
    marginTop: 2,
  },
  typeNameDisabled: {
    color: c.text.secondary,
  },
  typeDescDisabled: {
    color: c.text.tertiary,
  },
  comingSoonBadge: {
    backgroundColor: c.border?.main ?? '#E5E7EB',
    paddingHorizontal: s.sm,
    paddingVertical: 2,
    borderRadius: r.full,
  },
  comingSoonText: {
    fontSize: typo.fontSize.xs,
    fontWeight: typo.fontWeight.semibold,
    color: c.text.secondary,
  },
  anvisaPrevisao: {
    fontSize: typo.fontSize.xs,
    color: c.text.tertiary,
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
    color: c.text.primary,
  },
  typePriceSelected: {
    color: c.primary.main,
  },
  checkIcon: {
    position: 'absolute',
    top: s.sm,
    right: s.sm,
  },
  photoHint: {
    ...typo.variants.caption,
    color: c.text.tertiary,
    marginBottom: s.sm,
  } as any,
  photoRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  photoButton: {
    flex: 1,
    backgroundColor: c.background.paper,
    borderRadius: 18,
    paddingVertical: s.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.border.main,
    borderStyle: 'dashed',
    gap: s.sm,
    ...t.shadows.sm,
  },
  photoIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonText: {
    fontSize: typo.fontSize.sm,
    color: c.primary.main,
    fontWeight: typo.fontWeight.semibold,
  },
  imagesRow: {
    flexDirection: 'row',
    marginTop: s.sm,
    gap: s.sm,
  },
  imageContainer: {
    position: 'relative',
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
    backgroundColor: c.background.paper,
    borderRadius: r.full,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: c.status.infoLight,
    marginTop: s.lg,
    padding: s.md,
    borderRadius: r.lg,
    gap: s.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    ...typo.variants.caption,
    color: c.text.secondary,
    lineHeight: 18,
  } as any,
});
