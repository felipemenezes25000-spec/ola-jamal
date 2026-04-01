/**
 * Tela de Resumo da Consulta — Exibida após o médico encerrar a videochamada.
 * Mostra: info paciente/médico, duração, SOAP notes, medicamentos, exames,
 * anamnese, sugestões IA, transcrição, nota clínica, rating/feedback.
 * Anamnese e nota clínica são salvos automaticamente no prontuário do paciente.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { useAuth } from '../../contexts/AuthContext';
import { fetchRequestById, saveConsultationSummary } from '../../lib/api';
import type { RequestResponseDto } from '../../types/database';
import { parseAnamnesis } from '../../lib/domain/anamnesis';
import { AnamnesisCard } from '../../components/prontuario/AnamnesisCard';
import { SoapNotesCard } from '../../components/prontuario/SoapNotesCard';

const ACCENT_PURPLE = '#8B5CF6';
const PRIMARY = '#0EA5E9';

function formatDuration(startedAt: string | null | undefined, endedAt: string | null | undefined): string {
  if (!startedAt) return '--';
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diff = Math.max(0, Math.floor((end - start) / 1000));
  const mins = Math.floor(diff / 60);
  const secs = diff % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}min`;
  }
  return `${mins}min ${secs.toString().padStart(2, '0')}s`;
}

export default function ConsultationSummaryScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const { width: screenW } = useWindowDimensions();
  const S = useMemo(() => makeStyles(colors, screenW), [colors, screenW]);

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';

  // Paciente não precisa ver resumo da consulta (IA, anamnese, etc.) — redireciona para o pedido
  const isPatient = user != null && user.role !== 'doctor';
  useEffect(() => {
    if (isPatient && rid) {
      router.replace(`/request-detail/${rid}`);
    }
  }, [isPatient, rid, router]);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [clinicalNote, setClinicalNote] = useState('');
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const initialSaveDone = useRef(false);

  const anamnesis = useMemo(
    () => parseAnamnesis(request?.consultationAnamnesis),
    [request?.consultationAnamnesis]
  );

  const suggestions = useMemo(() => {
    if (!request?.consultationAiSuggestions) return [];
    try {
      const parsed = JSON.parse(request.consultationAiSuggestions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [request?.consultationAiSuggestions]);

  const transcript = request?.consultationTranscript ?? '';
  const hasAnamnesis = anamnesis && Object.keys(anamnesis).length > 0;
  const hasSuggestions = suggestions.length > 0;
  const hasTranscript = transcript.length > 0;

  // Extract medications and exams from anamnesis
  const medications = useMemo(() => {
    if (!anamnesis?.medicamentos_sugeridos) return [];
    return Array.isArray(anamnesis.medicamentos_sugeridos) ? anamnesis.medicamentos_sugeridos : [];
  }, [anamnesis?.medicamentos_sugeridos]);

  const exams = useMemo(() => {
    if (!anamnesis?.exames_sugeridos) return [];
    return Array.isArray(anamnesis.exames_sugeridos) ? anamnesis.exames_sugeridos : [];
  }, [anamnesis?.exames_sugeridos]);

  useEffect(() => {
    if (!rid) return;
    fetchRequestById(rid)
      .then((r) => {
        setRequest(r);
        setClinicalNote(r.notes ?? '');
      })
      .catch(() => {
        Alert.alert('Erro', 'Nao foi possivel carregar o resumo da consulta.');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [rid, router]);

  /** Salva anamnese e nota clínica no prontuário automaticamente. Apenas médico pode salvar. */
  const saveToRecord = useCallback(async (anamnesisJson: string | null, plan: string) => {
    if (!rid || user?.role !== 'doctor') return;
    try {
      await saveConsultationSummary(rid, {
        anamnesis: anamnesisJson ?? undefined,
        plan: plan.trim() || undefined,
      });
    } catch {
      // Silencioso — o backend já salvou na finalização; este é um refresh
    }
  }, [rid, user?.role]);

  const lastSavedNote = useRef<string | null>(null);
  const userHasEdited = useRef(false);

  /** Auto-save ao carregar: garante anamnese e nota no prontuário (apenas médico). */
  useEffect(() => {
    if (!request || !rid || initialSaveDone.current || user?.role !== 'doctor') return;
    initialSaveDone.current = true;
    const plan = request.notes ?? '';
    lastSavedNote.current = plan;
    saveToRecord(request.consultationAnamnesis ?? null, plan);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user?.role guard; saveToRecord already depends on it
  }, [request, rid, saveToRecord]);

  /** Auto-save ao editar a nota clínica (debounce 2s). Só quando o usuário alterou. Apenas médico. */
  useEffect(() => {
    if (!rid || !request || !userHasEdited.current || user?.role !== 'doctor') return;
    if (lastSavedNote.current === clinicalNote) return;
    const t = setTimeout(() => {
      lastSavedNote.current = clinicalNote;
      saveToRecord(request.consultationAnamnesis ?? null, clinicalNote);
    }, 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- user?.role guard
  }, [clinicalNote, rid, request, saveToRecord]);

  const copyText = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', `${label} copiado para area de transferencia.`);
  };

  const handleSubmitFeedback = () => {
    if (rating === 0) {
      Alert.alert('Avaliacao', 'Selecione uma nota antes de enviar.');
      return;
    }
    // TODO: integrate with API to save feedback
    setFeedbackSubmitted(true);
    Alert.alert('Obrigado!', 'Sua avaliacao foi enviada com sucesso.');
  };

  if (isPatient && rid) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[S.container, S.center]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={S.loadText}>Carregando resumo...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[S.container, S.center]}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={S.errorText}>Consulta nao encontrada</Text>
        <TouchableOpacity style={S.backBtnError} onPress={() => router.back()}>
          <Text style={S.backBtnErrorText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const duration = formatDuration(
    request.consultationStartedAt,
    request.updatedAt
  );

  return (
    <View style={[S.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={S.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={S.headerBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={S.headerTitle}>Resumo da Consulta</Text>
        </View>
        <View style={S.headerBadge}>
          <Ionicons name="sparkles" size={12} color={ACCENT_PURPLE} />
          <Text style={[S.headerBadgeText, { color: ACCENT_PURPLE }]}>IA</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Patient + Doctor Info Cards */}
        <View style={S.infoCardsRow}>
          {/* Patient card */}
          <View style={[S.infoCard, { flex: 1 }]}>
            <View style={[S.infoCardIcon, { backgroundColor: `${PRIMARY}18` }]}>
              <Ionicons name="person" size={18} color={PRIMARY} />
            </View>
            <Text style={S.infoCardLabel}>Paciente</Text>
            <Text style={S.infoCardName} numberOfLines={2}>
              {request.patientName ?? 'Paciente'}
            </Text>
          </View>

          {/* Doctor card */}
          <View style={[S.infoCard, { flex: 1 }]}>
            <View style={[S.infoCardIcon, { backgroundColor: `${ACCENT_PURPLE}18` }]}>
              <Ionicons name="medkit" size={18} color={ACCENT_PURPLE} />
            </View>
            <Text style={S.infoCardLabel}>Medico</Text>
            <Text style={S.infoCardName} numberOfLines={2}>
              {request.doctorName ?? 'Medico'}
            </Text>
          </View>
        </View>

        {/* Duration display */}
        <View style={S.durationCard}>
          <Ionicons name="time-outline" size={20} color={PRIMARY} />
          <View style={{ flex: 1 }}>
            <Text style={S.durationLabel}>Duracao da consulta</Text>
            <Text style={S.durationValue}>{duration}</Text>
          </View>
          {request.consultationStartedAt && (
            <Text style={S.durationDate}>
              {new Date(request.consultationStartedAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </Text>
          )}
        </View>

        {/* SOAP Notes — purple border accent */}
        {request?.consultationSoapNotes && (
          <View style={S.soapSection}>
            <SoapNotesCard soapJson={request.consultationSoapNotes} />
          </View>
        )}

        {/* Anamnesis Section — shared component */}
        {hasAnamnesis && anamnesis && (
          <AnamnesisCard
            data={anamnesis}
            compact
            showAlerts
            showMedsSuggestions
            showExamsSuggestions
            style={S.section}
          />
        )}

        {/* Medications prescribed */}
        {medications.length > 0 && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBg, { backgroundColor: `${ACCENT_PURPLE}18` }]}>
                <Ionicons name="medical" size={16} color={ACCENT_PURPLE} />
              </View>
              <Text style={S.sectionTitle}>Medicamentos Prescritos</Text>
              <View style={S.countBadge}>
                <Text style={S.countBadgeText}>{medications.length}</Text>
              </View>
            </View>
            {medications.map((med: any, i: number) => {
              const name = typeof med === 'string' ? med : (med?.nome ?? med?.name ?? `Medicamento ${i + 1}`);
              const dosage = typeof med === 'object' ? (med?.posologia ?? med?.dosage ?? '') : '';
              const indication = typeof med === 'object' ? (med?.indicacao ?? med?.indication ?? '') : '';
              return (
                <View key={i} style={S.medItem}>
                  <View style={S.medNumber}>
                    <Text style={S.medNumberText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={S.medName}>{name}</Text>
                    {dosage ? <Text style={S.medDetail}>{dosage}</Text> : null}
                    {indication ? <Text style={S.medIndication}>{indication}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Exams requested */}
        {exams.length > 0 && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBg, { backgroundColor: `${PRIMARY}18` }]}>
                <Ionicons name="flask" size={16} color={PRIMARY} />
              </View>
              <Text style={S.sectionTitle}>Exames Solicitados</Text>
              <View style={S.countBadge}>
                <Text style={S.countBadgeText}>{exams.length}</Text>
              </View>
            </View>
            {exams.map((exam: any, i: number) => {
              const name = typeof exam === 'string' ? exam : (exam?.nome ?? exam?.name ?? `Exame ${i + 1}`);
              const reason = typeof exam === 'object' ? (exam?.justificativa ?? exam?.reason ?? '') : '';
              return (
                <View key={i} style={S.examItem}>
                  <View style={S.examBullet}>
                    <Ionicons name="document-text-outline" size={14} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={S.examName}>{name}</Text>
                    {reason ? <Text style={S.examReason}>{reason}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* AI Suggestions */}
        {hasSuggestions && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBg, { backgroundColor: `${ACCENT_PURPLE}18` }]}>
                <Ionicons name="bulb" size={16} color={ACCENT_PURPLE} />
              </View>
              <Text style={[S.sectionTitle, { color: ACCENT_PURPLE }]}>Sugestoes Clinicas</Text>
            </View>
            {suggestions.map((s: string, i: number) => {
              const isRed = s.startsWith('\u{1F6A8}');
              return (
                <View key={i} style={[S.suggestionItem, isRed && S.suggestionDanger]}>
                  <Ionicons
                    name={isRed ? 'alert-circle' : 'bulb-outline'}
                    size={16}
                    color={isRed ? colors.error : ACCENT_PURPLE}
                  />
                  <Text style={[S.suggestionText, isRed && { color: colors.error }]}>
                    {s.replace('\u{1F6A8} ', '')}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Next steps / follow-up info */}
        {request.notes && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBg, { backgroundColor: `${PRIMARY}18` }]}>
                <Ionicons name="arrow-forward-circle" size={16} color={PRIMARY} />
              </View>
              <Text style={S.sectionTitle}>Proximos Passos</Text>
            </View>
            <Text style={S.nextStepsText}>
              {request.notes}
            </Text>
          </View>
        )}

        {/* Nota Clinica (editavel apenas para medico) */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <View style={[S.sectionIconBg, { backgroundColor: `${PRIMARY}18` }]}>
              <Ionicons name="document-text-outline" size={16} color={PRIMARY} />
            </View>
            <Text style={S.sectionTitle}>Nota Clinica</Text>
          </View>
          {user?.role === 'doctor' ? (
            <TextInput
              style={S.clinicalNoteInput}
              placeholder="Digite ou edite a nota clinica (salva automaticamente no prontuario)"
              placeholderTextColor={colors.textMuted}
              value={clinicalNote}
              onChangeText={(t) => {
                userHasEdited.current = true;
                setClinicalNote(t);
              }}
              multiline
              numberOfLines={4}
            />
          ) : (
            <Text style={S.clinicalNoteReadOnly}>{clinicalNote || '\u2014'}</Text>
          )}
        </View>

        {/* Transcript */}
        {hasTranscript && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <View style={[S.sectionIconBg, { backgroundColor: 'rgba(148,163,184,0.15)' }]}>
                <Ionicons name="mic" size={16} color={colors.textMuted} />
              </View>
              <Text style={S.sectionTitle}>Transcricao</Text>
              <TouchableOpacity
                style={S.copyIcon}
                onPress={() => copyText(transcript, 'Transcricao')}
              >
                <Ionicons name="copy-outline" size={16} color={PRIMARY} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setExpandedTranscript(!expandedTranscript)}
              activeOpacity={0.7}
            >
              <Text
                style={S.transcriptText}
                numberOfLines={expandedTranscript ? undefined : 8}
                ellipsizeMode="tail"
              >
                {transcript}
              </Text>
              {!expandedTranscript && transcript.length > 300 && (
                <Text style={S.expandLink}>Toque para expandir...</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Download documents button */}
        <TouchableOpacity
          style={S.downloadBtn}
          onPress={() => nav.push(router, `/post-consultation-emit/${rid}`)}
          activeOpacity={0.8}
        >
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={S.downloadBtnText}>Baixar documentos</Text>
        </TouchableOpacity>

        {/* Rating / Feedback section */}
        <View style={S.ratingSection}>
          <View style={S.sectionHeader}>
            <View style={[S.sectionIconBg, { backgroundColor: '#FEF3C720' }]}>
              <Ionicons name="star" size={16} color="#F59E0B" />
            </View>
            <Text style={S.sectionTitle}>Avaliacao</Text>
          </View>

          {feedbackSubmitted ? (
            <View style={S.feedbackDone}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <Text style={S.feedbackDoneText}>Obrigado pela sua avaliacao!</Text>
            </View>
          ) : (
            <>
              <Text style={S.ratingPrompt}>Como foi esta consulta?</Text>
              <View style={S.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={32}
                      color={star <= rating ? '#F59E0B' : colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              {rating > 0 && (
                <>
                  <TextInput
                    style={S.feedbackInput}
                    placeholder="Comentario opcional..."
                    placeholderTextColor={colors.textMuted}
                    value={feedbackText}
                    onChangeText={setFeedbackText}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={S.feedbackSubmitBtn}
                    onPress={handleSubmitFeedback}
                    activeOpacity={0.8}
                  >
                    <Text style={S.feedbackSubmitText}>Enviar avaliacao</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>

        {/* Empty state */}
        {!hasAnamnesis && !hasSuggestions && !hasTranscript && medications.length === 0 && exams.length === 0 && (
          <View style={S.emptyState}>
            <Ionicons name="sparkles-outline" size={48} color={colors.textSecondary} />
            <Text style={S.emptyTitle}>Sem dados da IA</Text>
            <Text style={S.emptySub}>
              A transcricao e anamnese automatica nao foram geradas para esta consulta.
              Verifique se a gravacao foi iniciada durante a chamada.
            </Text>
          </View>
        )}

        {/* Footer disclaimer */}
        <View style={S.footerDisclaimer}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={S.footerDisclaimerText}>
            Conteudo gerado por IA como apoio a decisao clinica. A revisao e validacao
            medica sao obrigatorias. Conformidade com CFM Resolucao 2.299/2021.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View style={[S.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={S.actionBtnPrimary}
          onPress={() => nav.push(router, `/post-consultation-emit/${rid}`)}
        >
          <Ionicons name="document-text" size={20} color="#fff" />
          <Text style={S.actionBtnPrimaryText}>Emitir documentos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={S.actionBtnSecondary}
          onPress={() => router.back()}
        >
          <Ionicons name="checkmark-circle" size={20} color={colors.text} />
          <Text style={S.actionBtnSecondaryText}>Concluir sem emitir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ──

function makeStyles(colors: DesignColors, _screenW: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadText: { color: colors.textMuted, fontSize: 14 },
    errorText: { color: colors.error, fontSize: 15, marginTop: 8 },
    backBtnError: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 12 },
    backBtnErrorText: { color: '#fff', fontWeight: '600' },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    headerBack: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '700',
    },
    headerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: `${ACCENT_PURPLE}14`,
    },
    headerBadgeText: {
      fontSize: 12,
      fontWeight: '700',
    },

    content: { padding: 16, gap: 16 },

    // Info cards row (patient + doctor)
    infoCardsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoCardIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    infoCardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    infoCardName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },

    // Duration card
    durationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    durationLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    durationValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginTop: 2,
    },
    durationDate: {
      fontSize: 12,
      color: colors.textMuted,
    },

    // SOAP section with purple border
    soapSection: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 16,
      padding: 16,
      gap: 12,
      borderLeftWidth: 4,
      borderLeftColor: ACCENT_PURPLE,
    },

    // Generic section
    section: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    sectionIconBg: {
      width: 32,
      height: 32,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    copyIcon: {
      padding: 6,
      borderRadius: 8,
      backgroundColor: `${PRIMARY}14`,
    },

    // Count badge
    countBadge: {
      backgroundColor: `${ACCENT_PURPLE}20`,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    countBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: ACCENT_PURPLE,
    },

    // Medications
    medItem: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      paddingVertical: 6,
    },
    medNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: `${ACCENT_PURPLE}18`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    medNumberText: {
      fontSize: 12,
      fontWeight: '700',
      color: ACCENT_PURPLE,
    },
    medName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 20,
    },
    medDetail: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    medIndication: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
      fontStyle: 'italic',
    },

    // Exams
    examItem: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      paddingVertical: 6,
    },
    examBullet: {
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: `${PRIMARY}14`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    examName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      lineHeight: 20,
    },
    examReason: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },

    // Suggestions
    suggestionItem: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      paddingLeft: 2,
      paddingVertical: 4,
    },
    suggestionDanger: {
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 10,
      padding: 10,
    },
    suggestionText: {
      fontSize: 13,
      color: ACCENT_PURPLE,
      lineHeight: 20,
      flex: 1,
    },

    // Next steps
    nextStepsText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },

    // Clinical note
    clinicalNoteInput: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: colors.text,
      minHeight: 100,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
    },
    clinicalNoteReadOnly: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      paddingVertical: 8,
    },

    // Transcript
    transcriptText: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 21,
    },
    expandLink: {
      fontSize: 12,
      color: PRIMARY,
      fontWeight: '600',
      marginTop: 6,
    },

    // Download button
    downloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: PRIMARY,
      borderRadius: 14,
      paddingVertical: 16,
    },
    downloadBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },

    // Rating section
    ratingSection: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    ratingPrompt: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    starsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    feedbackInput: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      color: colors.text,
      minHeight: 72,
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: colors.border,
    },
    feedbackSubmitBtn: {
      backgroundColor: PRIMARY,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    feedbackSubmitText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    feedbackDone: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 16,
    },
    feedbackDoneText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
    },

    // Empty state
    emptyState: { alignItems: 'center', gap: 12, paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
    emptySub: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 20,
    },

    // Footer disclaimer
    footerDisclaimer: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      alignItems: 'flex-start',
    },
    footerDisclaimerText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
      flex: 1,
    },

    // Bottom bar
    bottomBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    actionBtnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      backgroundColor: PRIMARY,
      borderRadius: 14,
    },
    actionBtnPrimaryText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },
    actionBtnSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 14,
    },
    actionBtnSecondaryText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
