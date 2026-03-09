import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import { useListBottomPadding } from '../../lib/ui/responsive';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography, doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import StatusTracker from '../../components/StatusTracker';
import { StatusBadge } from '../../components/StatusBadge';
import { DoctorHeader } from '../../components/ui/DoctorHeader';
import { DoctorCard } from '../../components/ui/DoctorCard';
import { AppButton, AppEmptyState } from '../../components/ui';
import { SkeletonList } from '../../components/ui/SkeletonLoader';
import { showToast } from '../../components/ui/Toast';
import { useTriageEval } from '../../hooks/useTriageEval';
import { useDoctorRequest } from '../../hooks/useDoctorRequest';
import { useFocusEffect } from 'expo-router';

import { getPatientProfileForDoctor } from '../../lib/api';
import type { PatientProfileForDoctorDto } from '../../types/database';
import { PatientInfoCard } from '../../components/doctor-request/PatientInfoCard';
import { AiCopilotSection } from '../../components/doctor-request/AiCopilotSection';
import { PrescriptionImageGallery } from '../../components/doctor-request/PrescriptionImageGallery';
import { DoctorActionButtons } from '../../components/doctor-request/DoctorActionButtons';
import { DetailsCard, MedicationsCard, ExamsCard, SymptomsCard, SignedDocumentCard } from '../../components/doctor-request/RequestDetailCards';
import { AnamnesisCard } from '../../components/prontuario/AnamnesisCard';
import { ConductForm } from '../../components/prontuario/ConductForm';
import { parseAnamnesis, parseSuggestions, parseEvidence, displayMedicamento, displayExame } from '../../lib/domain/anamnesis';

export { cacheRequest } from '../../hooks/useDoctorRequest';

const TYPE_LABELS: Record<string, string> = { prescription: 'RECEITA', exam: 'EXAME', consultation: 'CONSULTA' };
const HORIZONTAL_PAD = doctorDS.screenPaddingHorizontal;

export default function DoctorRequestDetail() {
  const router = useRouter();
  const listPadding = useListBottomPadding();
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);

  const {
    request, loading, loadError, actionLoading,
    rejectionReason, setRejectionReason, showRejectForm, setShowRejectForm,
    certPassword, setCertPassword, showSignForm, setShowSignForm,
    conductNotes, setConductNotes, includeConductInPdf, setIncludeConductInPdf,
    savingConduct, loadData, handleSaveConduct,
    handleApprove, handleReject, handleSign, handleAcceptConsultation,
    canApprove, canReject, canSign, canAccept, canVideo, isInQueue, requestId,
  } = useDoctorRequest();

  const [aiSummaryExpanded, setAiSummaryExpanded] = useState(false);
  const [patientProfile, setPatientProfile] = useState<PatientProfileForDoctorDto | null | undefined>(undefined);

  useEffect(() => {
    if (!request?.patientId) {
      setPatientProfile(null);
      return;
    }
    setPatientProfile(undefined);
    let cancelled = false;
    getPatientProfileForDoctor(request.patientId)
      .then((p) => { if (!cancelled) setPatientProfile(p ?? null); })
      .catch(() => { if (!cancelled) setPatientProfile(null); });
    return () => { cancelled = true; };
  }, [request?.patientId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));
  useTriageEval({
    context: 'doctor_detail',
    step: 'idle',
    role: 'doctor',
    requestType: request?.requestType ?? undefined,
    status: request?.status ?? undefined,
    aiSummaryForDoctor: request?.aiSummaryForDoctor ?? undefined,
  });

  if (loading) return (
    <View style={s.loadingContainer}>
      <DoctorHeader title="Carregando..." onBack={() => router.back()} />
      <View style={{ padding: spacing.md }}><SkeletonList count={4} /></View>
    </View>
  );

  if (loadError && !request) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <DoctorHeader title="Detalhe do Pedido" onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AppEmptyState
            icon="alert-circle-outline"
            title="Erro ao carregar pedido"
            subtitle="Verifique sua conexão e tente novamente."
            actionLabel="Tentar novamente"
            onAction={loadData}
          />
        </View>
      </View>
    );
  }

  if (!request) return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DoctorHeader title="Detalhe do Pedido" onBack={() => router.back()} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <AppEmptyState
          icon="document-text-outline"
          title="Pedido não encontrado"
          subtitle="Este pedido pode ter sido removido ou não está mais disponível."
          actionLabel="Voltar"
          onAction={() => router.back()}
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DoctorHeader
        title={TYPE_LABELS[request.requestType] || 'Pedido'}
        onBack={() => router.back()}
        right={<StatusBadge status={request.status} />}
      />
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: listPadding }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DoctorCard style={s.cardMargin}>
          <StatusTracker currentStatus={request.status} requestType={request.requestType} />
        </DoctorCard>

        <PatientInfoCard
          request={request}
          profile={patientProfile ?? undefined}
          onViewRecord={() => nav.push(router, `/doctor-patient/${request.patientId}`)}
          style={s.cardMargin}
        />

        <DetailsCard request={request} />

        <AiCopilotSection
          request={request}
          expanded={aiSummaryExpanded}
          onToggleExpand={() => setAiSummaryExpanded(!aiSummaryExpanded)}
          style={s.cardMargin}
        />

        <PrescriptionImageGallery
          images={request.prescriptionImages ?? []}
          label="IMAGENS DA RECEITA"
          iconBackgroundColor={colors.primarySoft}
          style={s.cardMargin}
        />

        <PrescriptionImageGallery
          images={request.examImages ?? []}
          label="IMAGENS DO EXAME"
          iconBackgroundColor={colors.accentSoft}
          style={s.cardMargin}
        />

        <MedicationsCard medications={request.medications} />
        <ExamsCard exams={request.exams} />
        <SymptomsCard symptoms={request.symptoms} />

        <ConsultationPostSection request={request} router={router} />

        <ConductSection
          request={request}
          conductNotes={conductNotes}
          setConductNotes={setConductNotes}
          includeConductInPdf={includeConductInPdf}
          setIncludeConductInPdf={setIncludeConductInPdf}
          savingConduct={savingConduct}
          handleSaveConduct={handleSaveConduct}
        />

        <SignedDocumentCard request={request} />

        <DoctorActionButtons
          canApprove={canApprove}
          canReject={canReject}
          canSign={canSign}
          canAccept={canAccept}
          canVideo={canVideo}
          actionLoading={actionLoading}
          isPrescription={request.requestType === 'prescription'}
          isExam={request.requestType === 'exam'}
          onApprove={handleApprove}
          onReject={handleReject}
          onSign={handleSign}
          onAccept={handleAcceptConsultation}
          onStartVideo={() => router.push(`/video/${request.id}`)}
          onNavigateEditor={() => router.push(`/doctor-request/editor/${requestId}`)}
          showRejectForm={showRejectForm}
          showSignForm={showSignForm}
          rejectionReason={rejectionReason}
          certPassword={certPassword}
          onRejectionReasonChange={setRejectionReason}
          onCertPasswordChange={setCertPassword}
          onToggleRejectForm={() => { setShowRejectForm(!showRejectForm); }}
          onToggleSignForm={() => { setShowSignForm(!showSignForm); if (showSignForm) setCertPassword(''); }}
          isInQueue={isInQueue}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ---- Inline sub-sections (kept in the same file for simplicity) ---- */

function ConsultationPostSection({ request, router }: { request: NonNullable<ReturnType<typeof useDoctorRequest>['request']>; router: ReturnType<typeof useRouter> }) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (request.requestType !== 'consultation' || request.status !== 'consultation_finished') return null;
  if (!request.consultationTranscript && !request.consultationAnamnesis && !request.consultationAiSuggestions && !request.consultationEvidence) return null;

  const anamnesis = parseAnamnesis(request.consultationAnamnesis);
  const suggestions = parseSuggestions(request.consultationAiSuggestions);
  const evidence = parseEvidence(request.consultationEvidence);
  const hasMeds = (anamnesis?.medicamentos_sugeridos?.length ?? 0) > 0;
  const hasExams = (anamnesis?.exames_sugeridos?.length ?? 0) > 0;

  return (
    <>
      {anamnesis && Object.keys(anamnesis).length > 0 && (
        <AnamnesisCard
          data={anamnesis}
          compact
          showAlerts
          showMedsSuggestions
          showExamsSuggestions
          style={s.cardMargin}
        />
      )}

      {suggestions.length > 0 && (
        <DoctorCard style={[s.cardMargin, { borderWidth: 1, borderColor: colors.accent }]}>
          <View style={s.aiHeader}>
            <Ionicons name="bulb" size={18} color={colors.primaryLight} />
            <Text style={s.aiTitle}>SUGESTÕES CLÍNICAS DA IA</Text>
          </View>
          {suggestions.map((item, i) => {
            const isRedFlag = item.startsWith('🚨');
            return (
              <View key={i} style={[s.suggestionItem, isRedFlag && s.suggestionItemDanger]}>
                <Ionicons name={isRedFlag ? 'alert-circle' : 'bulb-outline'} size={16} color={isRedFlag ? colors.error : colors.primaryLight} />
                <Text style={[s.suggestionText, isRedFlag && { color: colors.error }]}>{item.replace('🚨 ', '')}</Text>
              </View>
            );
          })}
        </DoctorCard>
      )}

      {evidence.length > 0 && (
        <DoctorCard style={[s.cardMargin, { borderWidth: 1, borderColor: colors.accent }]}>
          <View style={s.aiHeader}>
            <Ionicons name="library" size={18} color={colors.primary} />
            <Text style={s.aiTitle}>ARTIGOS CIENTÍFICOS (APOIO AO CID)</Text>
          </View>
          <View style={s.aiDisclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={s.aiDisclaimerText}>Fontes: PubMed, Europe PMC, Semantic Scholar.</Text>
          </View>
          {evidence.map((item, i) => (
            <View key={i} style={[s.anaField, { marginBottom: 12 }]}>
              <View style={s.anaLabelRow}>
                <Ionicons name="book-outline" size={12} color={colors.primary} />
                <Text style={[s.anaLabel, { color: colors.primary }]}>{item.provider ?? 'Fonte'}</Text>
              </View>
              <Text style={[s.anaValue, { fontFamily: typography.fontFamily.medium }]}>{item.title ?? item.source ?? '—'}</Text>
              {item.clinicalRelevance && (
                <Text style={[s.anaValue, { fontSize: 12, color: colors.textMuted, marginTop: 4 }]}>{item.clinicalRelevance}</Text>
              )}
              {item.url && (
                <TouchableOpacity
                  style={[s.aiSummaryActionBtn, { marginTop: 6, alignSelf: 'flex-start' }]}
                  onPress={() => Linking.openURL(item.url!)}
                >
                  <Ionicons name="open-outline" size={14} color={colors.primary} />
                  <Text style={s.aiSummaryActionText}>Abrir artigo</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </DoctorCard>
      )}

      {request.consultationTranscript && request.consultationTranscript.trim() && (
        <DoctorCard style={s.cardMargin}>
          <View style={s.aiHeader}>
            <Ionicons name="mic" size={18} color={colors.textMuted} />
            <Text style={s.aiTitle}>TRANSCRIÇÃO DA CONSULTA</Text>
            <TouchableOpacity style={s.aiSummaryActionBtn} onPress={async () => { await Clipboard.setStringAsync(request.consultationTranscript || ''); showToast({ message: 'Transcrição copiada', type: 'success' }); }}>
              <Ionicons name="copy-outline" size={14} color={colors.primary} />
              <Text style={s.aiSummaryActionText}>Copiar</Text>
            </TouchableOpacity>
          </View>
          <View style={s.aiDisclaimer}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={s.aiDisclaimerText}>Transcrição automática — pode conter imprecisões.</Text>
          </View>
          <Text style={[s.aiSummary, { fontSize: 13, lineHeight: 21, color: colors.textSecondary }]}>{request.consultationTranscript}</Text>
        </DoctorCard>
      )}

      {(hasMeds || hasExams) && (() => {
        const medsForPrefill = (anamnesis?.medicamentos_sugeridos ?? []).map((m) => displayMedicamento(m));
        const examsForPrefill = (anamnesis?.exames_sugeridos ?? []).map((e) => displayExame(e));
        return (
          <View style={[s.cardMargin, { marginBottom: 8 }]}>
            {hasMeds && (
              <AppButton
                title="Criar Receita Baseada na Consulta"
                variant="doctorPrimary"
                trailing={<Ionicons name="chevron-forward" size={20} color={colors.white} />}
                onPress={() => router.push({ pathname: '/doctor-request/editor/[id]' as any, params: { id: request.id, prefillMeds: JSON.stringify(medsForPrefill) } })}
                style={{ width: '100%' }}
              />
            )}
            {hasExams && (
              <AppButton
                title="Criar Pedido de Exame Baseado na Consulta"
                variant="outline"
                trailing={<Ionicons name="flask-outline" size={20} color={colors.primary} />}
                onPress={() => router.push({ pathname: '/new-request/exam' as any, params: { prefillExams: JSON.stringify(examsForPrefill) } })}
                style={{ width: '100%', marginTop: hasMeds ? 8 : 0 }}
              />
            )}
          </View>
        );
      })()}
    </>
  );
}

function ConductSection({ request, conductNotes, setConductNotes, includeConductInPdf, setIncludeConductInPdf, savingConduct, handleSaveConduct }: {
  request: NonNullable<ReturnType<typeof useDoctorRequest>['request']>;
  conductNotes: string;
  setConductNotes: (v: string) => void;
  includeConductInPdf: boolean;
  setIncludeConductInPdf: (v: boolean | ((prev: boolean) => boolean)) => void;
  savingConduct: boolean;
  handleSaveConduct: () => Promise<void>;
}) {
  const { colors } = useAppTheme({ role: 'doctor' });
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (request.requestType !== 'consultation') return null;

  return (
    <ConductForm
      legacyConductNotes={conductNotes}
      aiSuggestion={request.aiConductSuggestion}
      anamnesisJson={request.consultationAnamnesis}
      includeConductInPdf={includeConductInPdf}
      onIncludeConductInPdfChange={(v) => setIncludeConductInPdf(v)}
      saving={savingConduct}
      onSave={(_data, combinedText) => {
        setConductNotes(combinedText);
        handleSaveConduct();
      }}
      style={s.cardMargin}
    />
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: spacing.md },
  emptyTitle: { fontSize: 14, fontFamily: typography.fontFamily.bold, color: colors.textSecondary, letterSpacing: 0.8 },
  emptyAction: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md, marginTop: spacing.sm },
  emptyActionText: { fontSize: 13, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.white, letterSpacing: 0.6 },
  cardMargin: { marginHorizontal: HORIZONTAL_PAD, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: 0.5 },
  sectionIconWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', flex: 1, marginBottom: 2 },
  sectionCountBadge: { backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionCountText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailItem: { minWidth: 80 },
  detailItemLabel: { fontSize: 12, fontFamily: typography.fontFamily.bold, color: colors.textMuted, marginBottom: 6, letterSpacing: 1 },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  detailChipWarn: { backgroundColor: colors.warningLight },
  detailChipInfo: { backgroundColor: colors.infoLight },
  detailChipText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  detailPrice: { fontSize: 20, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
  aiCard: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.accent },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  aiTitle: { fontSize: 13, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1, letterSpacing: 0.8 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.primaryGhost, borderRadius: 6 },
  aiDisclaimerText: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummary: { fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 24 },
  aiSummaryActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  aiSummaryActionText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  medCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  medCardBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  medIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  medIndexText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
  medCardText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text, flex: 1, lineHeight: 20 },
  symptomsBlock: { borderLeftWidth: 3, borderLeftColor: colors.warning, paddingLeft: 12, paddingVertical: 4, backgroundColor: colors.warningLight, borderRadius: 4 },
  symptomsText: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  anaField: { marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  anaLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  anaLabel: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  anaValue: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 21 },
  redFlagBlock: { marginTop: 8, padding: 10, backgroundColor: colors.errorLight, borderRadius: 8, borderWidth: 1, borderColor: colors.error },
  redFlagItem: { paddingVertical: 4 },
  redFlagText: { fontSize: 13, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.error, lineHeight: 20 },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggestionItemDanger: { backgroundColor: colors.errorLight, borderRadius: 6, paddingHorizontal: 8, borderBottomWidth: 0, marginBottom: 4 },
  suggestionText: { flex: 1, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 21 },
  medChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  medChip: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.success, borderRadius: 20 },
  medChipText: { fontSize: 12, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.successLight },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, borderRadius: borderRadius.md, padding: spacing.md },
  pdfBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  formCard: { borderWidth: 1, borderColor: colors.border },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  formTitle: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  formDesc: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.md },
  formTextArea: { backgroundColor: colors.background, borderRadius: borderRadius.sm, padding: spacing.md, fontSize: 15, color: colors.text, minHeight: 100, borderWidth: 1, borderColor: colors.border, fontFamily: typography.fontFamily.regular },
  formBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryBtnFlex: { flex: 1 },
  });
}
