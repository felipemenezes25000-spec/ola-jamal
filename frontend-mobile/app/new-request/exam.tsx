import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '../../lib/theme';
import { uiTokens } from '../../lib/ui/tokens';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { createExamRequest, evaluateAssistantCompleteness, suggestExamsFromSymptoms } from '../../lib/api';
import type { ExamSuggestion } from '../../lib/api-requests';
import { showToast } from '../../components/ui/Toast';
import { useInvalidateRequests } from '../../lib/hooks/useRequestsQuery';
import { getApiErrorMessage } from '../../lib/api-client';
import { isDuplicateRequestError } from '../../lib/hooks/useCreateRequest';
import { validate } from '../../lib/validation';
import { createExamSchema } from '../../lib/validation/schemas';
import { useStickyCtaScrollPadding } from '../../lib/ui/responsive';
import { Screen } from '../../components/ui/Screen';
import { AppHeader, AppCard, AppInput, StepIndicator, StickyCTA } from '../../components/ui';
import { CompatibleImage } from '../../components/CompatibleImage';
import { useTriageEval } from '../../hooks/useTriageEval';
import { detectRedFlags, evaluateExamCompleteness } from '../../lib/domain/assistantIntelligence';
import { useSymptomVoiceInput } from '../../hooks/useSymptomVoiceInput';
import { EXAM_PACKAGES } from '../../lib/data/cidPackages';

const s = theme.spacing;
const _r = theme.borderRadius;
const ty = theme.typography;

const EXAM_TYPES = [
  { key: 'laboratorial' as const, label: 'Laboratorial', desc: 'Exames de sangue, urina e outros.', icon: 'flask-outline' as const, accent: '#22C55E' },
  { key: 'imagem' as const, label: 'Imagem', desc: 'Raio-X, ultrassom, tomografia.', icon: 'scan-outline' as const, accent: '#0EA5E9' },
];

const QUICK_EXAMS_LAB = [
  'Hemograma completo',
  'Glicemia em jejum',
  'TSH',
  'Colesterol total',
  'TGO / TGP',
  'Creatinina',
];

const QUICK_EXAMS_IMAGEM = [
  'Raio-X de tórax PA e perfil',
  'USG abdome total',
  'USG tireoide',
  'Tomografia de crânio',
  'Ressonância magnética de coluna lombar',
  'Mamografia bilateral',
];

interface QuickPack {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  exams: string[];
}

const QUICK_PACKS_LAB: QuickPack[] = EXAM_PACKAGES.map((p) => ({
  key: p.key,
  label: p.name,
  icon: p.key === 'checkup' ? 'fitness-outline' :
        p.key === 'ist' ? 'shield-checkmark-outline' :
        p.key === 'prenatal' ? 'heart-outline' :
        p.key === 'cardiovascular' ? 'pulse-outline' :
        p.key === 'renal' ? 'water-outline' :
        p.key === 'hepatico' ? 'analytics-outline' :
        'body-outline',
  exams: p.exams,
}));

const QUICK_PACKS_IMAGEM: QuickPack[] = [
  {
    key: 'img_torax',
    label: 'Tórax',
    icon: 'body-outline',
    exams: ['Raio-X de tórax PA e perfil', 'Tomografia de tórax', 'Angiotomografia de tórax'],
  },
  {
    key: 'img_abdome',
    label: 'Abdome',
    icon: 'fitness-outline',
    exams: ['USG abdome total', 'USG abdome superior', 'Tomografia de abdome', 'Ressonância de abdome'],
  },
  {
    key: 'img_cabeca',
    label: 'Cabeça e pescoço',
    icon: 'happy-outline',
    exams: ['Tomografia de crânio', 'Ressonância de crânio', 'USG tireoide', 'USG cervical', 'Raio-X de seios da face'],
  },
  {
    key: 'img_musculo',
    label: 'Musculoesquelético',
    icon: 'walk-outline',
    exams: ['Raio-X de coluna lombar', 'Raio-X de coluna cervical', 'Ressonância de coluna lombar', 'Ressonância de joelho', 'Raio-X de ombro', 'USG de ombro'],
  },
  {
    key: 'img_gineco',
    label: 'Ginecológico',
    icon: 'flower-outline',
    exams: ['Mamografia bilateral', 'USG das mamas', 'USG transvaginal', 'USG pélvica'],
  },
  {
    key: 'img_vascular',
    label: 'Vascular',
    icon: 'pulse-outline',
    exams: ['Doppler de carótidas', 'Doppler venoso de MMII', 'Doppler arterial de MMII', 'Ecocardiograma'],
  },
];

export default function NewExam() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefillExams?: string }>();
  const invalidateRequests = useInvalidateRequests();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const [examType, setExamType] = useState('laboratorial');
  const [exams, setExams] = useState<string[]>([]);
  const [examInput, setExamInput] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, narrow), [colors, narrow]);
  const voice = useSymptomVoiceInput();
  const [aiSuggestions, setAiSuggestions] = useState<ExamSuggestion[]>([]);
  const [aiSugLoading, setAiSugLoading] = useState(false);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const togglePack = useCallback((key: string) => {
    setExpandedPacks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const quickPacks = examType === 'imagem' ? QUICK_PACKS_IMAGEM : QUICK_PACKS_LAB;
  const quickExamsFlat = examType === 'imagem' ? QUICK_EXAMS_IMAGEM : QUICK_EXAMS_LAB;

  const handleVoiceRecord = useCallback(async () => {
    if (voice.isRecording) {
      const text = await voice.stopAndTranscribe(
        examType === 'imagem' ? 'Solicitação de exame de imagem' : 'Solicitação de exame laboratorial',
      );
      if (text) {
        setSymptoms((prev) => (prev.trim() ? `${prev.trim()}\n${text}` : text));
        showToast({ message: 'Sintomas transcritos com sucesso!', type: 'success' });
      } else if (voice.error) {
        showToast({ message: voice.error, type: 'error' });
      }
    } else {
      await voice.startRecording();
    }
  }, [voice, examType]);

  const listPadding = useStickyCtaScrollPadding();
  const completenessLocal = evaluateExamCompleteness({
    examType,
    examsCount: exams.length,
    symptoms,
    imagesCount: images.length,
  });
  const redFlagsLocal = detectRedFlags(symptoms);
  const [apiLoading, setApiLoading] = useState(false);

  useEffect(() => {
    const raw = params.prefillExams;
    if (raw && typeof raw === 'string') {
      try {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr) && arr.length > 0) {
          setExams(arr.filter(Boolean));
        }
      } catch { /* ignore */ }
    }
  }, [params.prefillExams]);

  const [apiResult, setApiResult] = useState<{
    score: number;
    doneCount: number;
    totalCount: number;
    items: { id: string; label: string; required: boolean; done: boolean }[];
    missingRequired: { id: string; label: string; required: boolean; done: boolean }[];
    hasUrgencyRisk: boolean;
    urgencySignals: string[];
    urgencyMessage: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setApiLoading(true);
      evaluateAssistantCompleteness({
        flow: 'exam',
        examType,
        examsCount: exams.length,
        symptoms,
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
              hasUrgencyRisk: res.hasUrgencyRisk,
              urgencySignals: res.urgencySignals,
              urgencyMessage: res.urgencyMessage,
            });
          }
        })
        .catch(() => { if (!cancelled) setApiResult(null); })
        .finally(() => { if (!cancelled) setApiLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [examType, exams.length, symptoms, images.length]);

  const completeness = apiResult
    ? { score: apiResult.score, doneCount: apiResult.doneCount, totalCount: apiResult.totalCount, items: apiResult.items, missingRequired: apiResult.missingRequired }
    : completenessLocal;
  const redFlags = apiResult
    ? {
        isUrgent: apiResult.hasUrgencyRisk,
        matchedSignals: apiResult.urgencySignals,
        guidance: apiResult.urgencyMessage ?? 'Sinais de urgência detectados. Considere buscar atendimento presencial.',
      }
    : redFlagsLocal;

  // Buscar sugestões de exames por IA quando sintomas tiverem >= 15 caracteres
  useEffect(() => {
    const trimmed = symptoms.trim();
    if (trimmed.length < 15) {
      setAiSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setAiSugLoading(true);
      suggestExamsFromSymptoms(trimmed, examType)
        .then((res) => {
          if (!cancelled && Array.isArray(res.suggestions)) {
            setAiSuggestions(res.suggestions.filter((s) => s.exam));
          }
        })
        .catch(() => { if (!cancelled) setAiSuggestions([]); })
        .finally(() => { if (!cancelled) setAiSugLoading(false); });
    }, 1200); // debounce 1.2s
    return () => { cancelled = true; clearTimeout(t); };
  }, [symptoms, examType]);

  let currentStep = 1;
  if (examType) currentStep = 2;
  if (exams.length > 0) currentStep = 3;
  if (symptoms.trim().length > 0) currentStep = 4;

  const examValidation = validate(createExamSchema, { examType, exams, symptoms, images });
  const isFormValid = completeness.missingRequired.length === 0 && examValidation.success;
  const symptomsRef = useRef<TextInput>(null);

  useTriageEval({
    context: 'exam',
    step: exams.length > 0 ? 'type_selected' : 'entry',
    role: 'patient',
    requestType: 'exam',
    examType: examType,
    exams,
  });

  const addExam = () => {
    const exam = examInput.trim();
    if (exam && !exams.includes(exam)) {
      setExams([...exams, exam]);
      setExamInput('');
    }
  };

  const addQuickExam = (exam: string) => {
    if (!exams.includes(exam)) {
      setExams([...exams, exam]);
    }
  };

  const removeExam = (index: number) => {
    setExams(exams.filter((_, i) => i !== index));
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à câmera para fotografar o pedido de exame.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const pickFromGallery = async () => {
    const remaining = 5 - images.length;
    if (remaining <= 0) {
      Alert.alert('Limite atingido', 'Máximo de 5 arquivos por solicitação.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const pickDocument = async () => {
    const remaining = 5 - images.length;
    if (remaining <= 0) {
      Alert.alert('Limite atingido', 'Máximo de 5 arquivos por solicitação.');
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: remaining > 1,
    });

    if (!result.canceled && result.assets?.length) {
      const allowed = result.assets.slice(0, remaining);
      setImages([...images, ...allowed.map((a) => a.uri)]);
    }
  };

  const submitExamRequest = async (payload: {
    examType: string;
    exams: string[];
    symptoms: string;
    images?: string[];
  }) => {
    setLoading(true);
    try {
      const result = await createExamRequest(payload);
      if (result.request?.status === 'rejected') {
        const msg =
          result.request.aiMessageToUser ||
          result.request.rejectionReason ||
          'A imagem não parece ser de pedido de exame ou laudo médico. Envie apenas fotos do documento.';
        Alert.alert(
          'Imagem não reconhecida',
          msg,
          [{ text: 'Entendi', style: 'default' }]
        );
        return;
      }
      invalidateRequests();
      showToast({ message: 'Pedido de exame enviado! Acompanhe na aba Pedidos.', type: 'success' });
      router.replace('/(patient)/requests');
    } catch (error: unknown) {
      if (isDuplicateRequestError(error)) {
        Alert.alert(
          'Pedido em andamento',
          error.message,
          [
            { text: 'Ver meus pedidos', onPress: () => router.replace('/(patient)/requests'), style: 'default' },
            { text: 'OK', style: 'cancel' },
          ]
        );
      } else {
        showToast({ message: getApiErrorMessage(error), type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (completeness.missingRequired.length > 0) {
      showToast({ message: completeness.missingRequired.map((item) => item.label).join('. '), type: 'error' });
      symptomsRef.current?.focus();
      return;
    }

    const validation = validate(createExamSchema, { examType, exams, symptoms, images });
    if (!validation.success) {
      showToast({ message: validation.firstError ?? 'Informe os exames desejados e os sintomas.', type: 'error' });
      symptomsRef.current?.focus();
      return;
    }
    const payload = {
      examType: validation.data!.examType ?? 'laboratorial',
      exams: validation.data!.exams ?? [],
      symptoms: validation.data!.symptoms ?? '',
      images: (validation.data!.images?.length ?? 0) > 0 ? validation.data!.images : undefined,
    };

    if (redFlags.isUrgent) {
      Alert.alert(
        'Sinais de urgência detectados',
        `${redFlags.guidance}\n\nSinais identificados: ${redFlags.matchedSignals.join(', ')}`,
        [
          { text: 'Voltar', style: 'cancel' },
          { text: 'Continuar mesmo assim', style: 'destructive', onPress: () => { void submitExamRequest(payload); } },
        ]
      );
      return;
    }

    await submitExamRequest(payload);
  };

  return (
    <Screen scroll={false} padding={false} edges={['top', 'bottom']}>
      <View style={styles.flex1}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: listPadding }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <AppHeader title="Novo Exame" />
          <StepIndicator current={currentStep} total={4} labels={['Tipo', 'Exames', 'Sintomas', 'Revisão']} />

          {/* AI Completeness */}
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
                <Text style={styles.readyText}>Pedido consistente para revisão</Text>
              </View>
            )}
          </View>

          {redFlags.isUrgent && (
            <View style={styles.redFlagCard}>
              <Ionicons name="warning-outline" size={18} color={colors.error} />
              <Text style={styles.redFlagText}>{redFlags.guidance}</Text>
            </View>
          )}

          {/* Exam Type */}
          <Text style={styles.sectionLabel}>Tipo de exame</Text>
          <View style={styles.typeRow}>
            {EXAM_TYPES.map(type => {
              const isSelected = examType === type.key;
              return (
                <AppCard
                  key={type.key}
                  selected={isSelected}
                  onPress={() => setExamType(type.key)}
                  style={styles.typeCard}
                >
                  <View style={[styles.typeIconWrap, { backgroundColor: type.accent + '14' }]}>
                    <Ionicons name={type.icon} size={24} color={isSelected ? type.accent : colors.textMuted} />
                  </View>
                  <Text style={[styles.typeName, isSelected && styles.typeNameSelected]} numberOfLines={1}>
                    {type.label}
                  </Text>
                  <Text style={styles.typeDesc} numberOfLines={2}>{type.desc}</Text>
                </AppCard>
              );
            })}
          </View>

          {/* Exams List */}
          <Text style={styles.sectionLabel}>Exames desejados</Text>
          <View style={styles.inputRow}>
            <AppInput
              placeholder="Ex: Hemograma completo"
              value={examInput}
              onChangeText={setExamInput}
              onSubmitEditing={addExam}
              returnKeyType="done"
              blurOnSubmit={false}
              autoCapitalize="sentences"
              autoCorrect={false}
              editable={!loading}
              containerStyle={styles.inputContainer}
            />
            <TouchableOpacity
              style={[styles.addButton, !examInput.trim() && styles.addButtonDisabled]}
              onPress={addExam}
              disabled={!examInput.trim()}
              accessibilityRole="button"
              accessibilityLabel="Adicionar exame"
              accessibilityState={{ disabled: !examInput.trim() }}
            >
              <Ionicons name="add" size={22} color="#FFFFFF" importantForAccessibility="no" />
            </TouchableOpacity>
          </View>

          {/* Quick Exam Chips */}
          <View style={styles.quickSection}>
            <Text style={styles.quickLabel}>Sugestões rápidas:</Text>
            <View style={styles.quickChips}>
              {quickExamsFlat.filter((e) => !exams.includes(e)).map((exam) => (
                <TouchableOpacity
                  key={exam}
                  style={styles.quickChip}
                  onPress={() => addQuickExam(exam)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Adicionar ${exam}`}
                >
                  <Ionicons name="add-circle-outline" size={14} color={colors.primary} importantForAccessibility="no" />
                  <Text style={styles.quickChipText}>{exam}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Expandable Packs */}
          <View style={styles.packsSection}>
            <Text style={styles.packsTitle}>
              {examType === 'imagem' ? 'Pacotes de imagem por região' : 'Pacotes laboratoriais'}
            </Text>
            <Text style={styles.packsHint}>Toque para expandir e adicionar exames individuais</Text>
            {quickPacks.map((pack) => {
              const isExpanded = expandedPacks.has(pack.key);
              const availableExams = pack.exams.filter((e) => !exams.includes(e));
              const allAdded = availableExams.length === 0;
              return (
                <View key={pack.key} style={styles.packCard}>
                  <TouchableOpacity
                    style={styles.packHeader}
                    onPress={() => togglePack(pack.key)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${pack.label}. ${pack.exams.length} exames`}
                    accessibilityState={{ expanded: isExpanded }}
                    accessibilityHint={isExpanded ? 'Toque para recolher' : 'Toque para expandir'}
                  >
                    <View style={styles.packIconWrap}>
                      <Ionicons name={pack.icon as any} size={18} color={colors.primary} importantForAccessibility="no" />
                    </View>
                    <Text style={styles.packLabel} numberOfLines={1}>{pack.label}</Text>
                    <Text style={styles.packCount}>{pack.exams.length} exames</Text>
                    {!allAdded && (
                      <TouchableOpacity
                        style={styles.packAddAllBtn}
                        onPress={() => {
                          const newExams = [...exams, ...availableExams];
                          setExams(newExams);
                          showToast({ message: `${availableExams.length} exames adicionados`, type: 'success' });
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Adicionar todos os ${availableExams.length} exames de ${pack.label}`}
                      >
                        <Text style={styles.packAddAllText}>+ Todos</Text>
                      </TouchableOpacity>
                    )}
                    {allAdded && (
                      <View style={styles.packDoneBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      </View>
                    )}
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.packBody}>
                      {pack.exams.map((exam) => {
                        const alreadyAdded = exams.includes(exam);
                        return (
                          <TouchableOpacity
                            key={exam}
                            style={[styles.packExamRow, alreadyAdded && styles.packExamRowAdded]}
                            onPress={() => {
                              if (alreadyAdded) {
                                setExams(exams.filter((e) => e !== exam));
                              } else {
                                addQuickExam(exam);
                              }
                            }}
                            activeOpacity={0.7}
                            accessibilityRole="checkbox"
                            accessibilityLabel={exam}
                            accessibilityState={{ checked: alreadyAdded }}
                          >
                            <Ionicons
                              name={alreadyAdded ? 'checkmark-circle' : 'add-circle-outline'}
                              size={16}
                              color={alreadyAdded ? '#22C55E' : colors.primary}
                              importantForAccessibility="no"
                            />
                            <Text style={[styles.packExamText, alreadyAdded && styles.packExamTextAdded]}>
                              {exam}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {exams.length > 0 && (
            <View style={styles.tags}>
              {exams.map((exam, index) => (
                <View key={`${exam}-${index}`} style={styles.tag}>
                  <Text style={styles.tagText}>{exam}</Text>
                  <TouchableOpacity onPress={() => removeExam(index)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Ionicons name="close" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Symptoms */}
          <View style={styles.symptomHeaderRow}>
            <View style={styles.flex1}>
              <Text style={styles.sectionLabel}>Sintomas</Text>
              <Text style={styles.fieldHint}>Descreva o que motivou o pedido de exame</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.micButton,
                voice.isRecording && styles.micButtonRecording,
                voice.isTranscribing && styles.micButtonTranscribing,
              ]}
              onPress={handleVoiceRecord}
              disabled={loading || voice.isTranscribing}
              activeOpacity={0.7}
              accessibilityLabel={voice.isRecording ? 'Parar gravação' : 'Gravar sintomas por voz'}
              accessibilityRole="button"
            >
              {voice.isTranscribing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={voice.isRecording ? 'stop' : 'mic'}
                  size={20}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Voice recording indicator */}
          {voice.isRecording && (
            <View style={styles.voiceIndicator}>
              <View style={styles.voicePulse} />
              <Text style={styles.voiceIndicatorText}>
                Gravando... {voice.durationSeconds}s — Toque no mic para parar
              </Text>
            </View>
          )}
          {voice.isTranscribing && (
            <View style={styles.voiceIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.voiceIndicatorText}>Transcrevendo e organizando seus sintomas...</Text>
            </View>
          )}

          <TextInput
            ref={symptomsRef}
            style={[styles.textarea, !isFormValid && symptoms.trim().length === 0 && styles.inputError]}
            placeholder="Ex: Dor de cabeça frequente há 2 semanas..."
            placeholderTextColor={colors.textMuted}
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCapitalize="sentences"
            autoCorrect
            returnKeyType="default"
            editable={!loading && !voice.isTranscribing}
            accessibilityLabel="Descreva seus sintomas"
            accessibilityHint="Campo obrigatório para descrever seus sintomas"
          />
          {!isFormValid && symptoms.trim().length === 0 && (
            <Text style={styles.inputErrorHint}>Descreva seus sintomas para continuar</Text>
          )}

          {/* AI Exam Suggestions */}
          {(aiSugLoading || aiSuggestions.length > 0) && (
            <View style={styles.aiSuggestCard}>
              <View style={styles.aiSuggestHeader}>
                <Ionicons name="sparkles" size={16} color="#8B5CF6" />
                <Text style={styles.aiSuggestTitle}>Sugestões da IA</Text>
                {aiSugLoading && <ActivityIndicator size="small" color="#8B5CF6" style={{ marginLeft: 'auto' }} />}
              </View>
              {aiSuggestions.length > 0 && (
                <Text style={styles.aiSuggestHint}>Toque para adicionar ao pedido</Text>
              )}
              {aiSuggestions.map((s, i) => {
                const alreadyAdded = exams.includes(s.exam);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.aiSuggestItem, alreadyAdded && styles.aiSuggestItemAdded]}
                    onPress={() => !alreadyAdded && addQuickExam(s.exam)}
                    disabled={alreadyAdded}
                    activeOpacity={0.7}
                  >
                    <View style={styles.aiSuggestRow}>
                      <Ionicons
                        name={alreadyAdded ? 'checkmark-circle' : 'add-circle-outline'}
                        size={18}
                        color={alreadyAdded ? '#22C55E' : '#8B5CF6'}
                      />
                      <View style={styles.flex1}>
                        <Text style={[styles.aiSuggestExam, alreadyAdded && styles.aiSuggestExamAdded]}>
                          {s.exam}
                        </Text>
                        {s.reason ? (
                          <Text style={styles.aiSuggestReason}>{s.reason}</Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Photo / Document */}
          <Text style={styles.sectionLabel}>Foto ou arquivo do pedido (opcional)</Text>
          <Text style={styles.fieldHint}>
            Se você tem um pedido de exame ou laudo, envie a foto ou PDF aqui.
          </Text>
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoButton} onPress={pickImage} activeOpacity={0.7}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="camera" size={22} color={colors.primary} />
              </View>
              <Text style={styles.photoText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery} activeOpacity={0.7}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="image" size={22} color={colors.primary} />
              </View>
              <Text style={styles.photoText}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoButton} onPress={pickDocument} activeOpacity={0.7}>
              <View style={styles.photoIconCircle}>
                <Ionicons name="document-attach" size={22} color={colors.primary} />
              </View>
              <Text style={styles.photoText}>Arquivo</Text>
            </TouchableOpacity>
          </View>
          {images.length > 0 && (
            <View style={styles.imagesRow}>
              {images.map((uri, i) => (
                <View key={i} style={styles.imgWrap}>
                  <CompatibleImage uri={uri && typeof uri === 'string' ? uri : undefined} style={styles.imgPreview} />
                  <TouchableOpacity
                    style={styles.imgRemove}
                    onPress={() => setImages(images.filter((_, j) => j !== i))}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <StickyCTA
          summaryTitle="Resumo"
          summaryValue={`${completeness.score}% pronto`}
          summaryHint={`${examType === 'imagem' ? 'pedido de imagem' : 'pedido laboratorial'}`}
          primary={{
            label: 'Enviar pedido',
            onPress: handleSubmit,
            loading,
            disabled: loading || !isFormValid,
          }}
        />
      </View>
    </Screen>
  );
}

function makeStyles(colors: DesignColors, narrow: boolean) {
  return StyleSheet.create({
    flex1: { flex: 1 },
    body: {
      flexGrow: 1,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
    },

    /* Completeness Card */
    completenessCard: {
      marginTop: s.md,
      marginBottom: s.sm,
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

    /* Red flags */
    redFlagCard: {
      marginTop: s.sm,
      marginBottom: s.sm,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.errorLight,
      backgroundColor: colors.errorLight,
      padding: s.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
    },
    redFlagText: { flex: 1, color: colors.error, fontSize: 12, lineHeight: 18 },

    /* Sections */
    sectionLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginTop: s.lg,
      marginBottom: s.sm,
    },
    fieldHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: s.sm,
      lineHeight: 18,
    },

    /* Type Cards */
    typeRow: {
      flexDirection: narrow ? 'column' : 'row',
      gap: s.sm,
    },
    typeCard: {
      flex: narrow ? undefined : 1,
      alignItems: 'center',
      paddingVertical: s.md,
    },
    typeIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: s.sm,
    },
    typeName: {
      fontSize: ty.fontSize.sm,
      fontWeight: '700',
      color: colors.text,
    },
    typeNameSelected: {
      color: colors.primary,
    },
    typeDesc: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
      lineHeight: 16,
    },

    /* Input Row */
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
    },
    inputContainer: {
      flex: 1,
      marginBottom: 0,
    },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonDisabled: {
      opacity: 0.5,
    },

    /* Quick Chips */
    quickSection: {
      marginTop: s.sm,
    },
    quickLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    quickChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    quickChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    quickChipText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },

    /* Tags */
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: s.sm,
      gap: s.sm,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      gap: 6,
    },
    tagText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '500',
    },

    /* Symptom header with mic */
    symptomHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s.sm,
    },
    micButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: s.lg,
    },
    micButtonRecording: {
      backgroundColor: '#EF4444',
    },
    micButtonTranscribing: {
      backgroundColor: colors.textMuted,
    },

    /* Voice indicator */
    voiceIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: s.sm,
      paddingVertical: s.xs,
      paddingHorizontal: s.sm,
      marginBottom: s.xs,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
    },
    voicePulse: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#EF4444',
    },
    voiceIndicatorText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: '500',
    },

    /* Textarea */
    textarea: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: s.md,
      fontSize: ty.fontSize.md,
      color: colors.text,
      minHeight: 100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputError: {
      borderColor: colors.error,
      borderWidth: 1.5,
    },
    inputErrorHint: {
      marginTop: s.xs,
      fontSize: 12,
      color: colors.error,
      lineHeight: 16,
    },

    /* AI Suggestions */
    aiSuggestCard: {
      marginTop: s.sm,
      padding: s.md,
      borderRadius: 14,
      backgroundColor: '#8B5CF610',
      borderWidth: 1,
      borderColor: '#8B5CF620',
    },
    aiSuggestHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    aiSuggestTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#8B5CF6',
    },
    aiSuggestHint: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: s.sm,
    },
    aiSuggestItem: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.surface,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiSuggestItemAdded: {
      backgroundColor: '#22C55E10',
      borderColor: '#22C55E30',
    },
    aiSuggestRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    aiSuggestExam: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    aiSuggestExamAdded: {
      color: '#22C55E',
    },
    aiSuggestReason: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },

    /* Expandable Packs */
    packsSection: {
      marginTop: s.md,
    },
    packsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    packsHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: s.sm,
    },
    packCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: s.xs,
      overflow: 'hidden',
    },
    packHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 8,
    },
    packIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    packLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    packCount: {
      fontSize: 11,
      color: colors.textMuted,
    },
    packAddAllBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: colors.primary + '18',
    },
    packAddAllText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    packDoneBadge: {
      paddingHorizontal: 4,
    },
    packBody: {
      paddingHorizontal: 12,
      paddingBottom: 10,
      gap: 2,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    packExamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 4,
      borderRadius: 8,
    },
    packExamRowAdded: {
      backgroundColor: '#22C55E' + '10',
    },
    packExamText: {
      flex: 1,
      fontSize: 12,
      color: colors.text,
      lineHeight: 16,
    },
    packExamTextAdded: {
      color: '#22C55E',
      fontWeight: '500',
    },

    /* Photo */
    photoRow: {
      flexDirection: 'row',
      gap: s.md,
    },
    photoButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      paddingVertical: s.md,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      gap: s.xs,
    },
    photoIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    imagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: s.sm,
      gap: s.sm,
    },
    imgWrap: {
      position: 'relative',
    },
    imgPreview: {
      width: 76,
      height: 76,
      borderRadius: 12,
    },
    imgRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      backgroundColor: colors.surface,
      borderRadius: 10,
    },
  });
}
