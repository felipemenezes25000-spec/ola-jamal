import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useListBottomPadding } from '../../lib/ui/responsive';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { spacing, borderRadius, typography, doctorDS } from '../../lib/themeDoctor';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { getDisplayPrice } from '../../lib/config/pricing';
import { formatBRL } from '../../lib/utils/format';
import StatusTracker from '../../components/StatusTracker';
import { StatusBadge } from '../../components/StatusBadge';
import { DoctorHeader } from '../../components/ui/DoctorHeader';
import { DoctorCard } from '../../components/ui/DoctorCard';
import { AppButton, AIActionSheet, AppEmptyState } from '../../components/ui';
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export { cacheRequest } from '../../hooks/useDoctorRequest';

const TYPE_LABELS: Record<string, string> = { prescription: 'RECEITA', exam: 'EXAME', consultation: 'CONSULTA' };

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
          onViewRecord={() => router.push(`/doctor-patient/${request.patientId}` as never)}
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

function DetailsCard({ request }: { request: NonNullable<ReturnType<typeof useDoctorRequest>['request']> }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.detailsGrid}>
        <View style={s.detailItem}>
          <Text style={s.detailItemLabel}>TIPO</Text>
          <View style={s.detailChip}>
            <Ionicons name={request.requestType === 'prescription' ? 'document-text' : request.requestType === 'exam' ? 'flask' : 'videocam'} size={14} color={colors.primary} />
            <Text style={s.detailChipText}>{TYPE_LABELS[request.requestType]}</Text>
          </View>
        </View>
        {request.prescriptionType && (
          <View style={s.detailItem}>
            <Text style={s.detailItemLabel}>MODALIDADE</Text>
            <View style={[s.detailChip, request.prescriptionType === 'controlado' && s.detailChipWarn, request.prescriptionType === 'azul' && s.detailChipInfo]}>
              {request.prescriptionType === 'controlado' && <Ionicons name="warning" size={13} color={colors.warning} />}
              <Text style={[s.detailChipText, request.prescriptionType === 'controlado' && { color: colors.warning }, request.prescriptionType === 'azul' && { color: colors.info }]}>
                {request.prescriptionType === 'simples' ? 'Simples' : request.prescriptionType === 'controlado' ? 'Controlada' : 'Azul'}
              </Text>
            </View>
          </View>
        )}
        <View style={s.detailItem}>
          <Text style={s.detailItemLabel}>VALOR</Text>
          <Text style={s.detailPrice}>{formatBRL(getDisplayPrice(request.price, request.requestType, request.prescriptionType))}</Text>
        </View>
      </View>
    </DoctorCard>
  );
}

function MedicationsCard({ medications }: { medications: string[] | null }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!medications || medications.length === 0) return null;
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="medical" size={16} color={colors.primary} />
        </View>
        <Text style={s.sectionLabel}>MEDICAMENTOS</Text>
        <View style={s.sectionCountBadge}><Text style={s.sectionCountText}>{medications.length}</Text></View>
      </View>
      {medications.map((m, i) => (
        <View key={i} style={[s.medCard, i > 0 && s.medCardBorder]}>
          <View style={s.medIndex}><Text style={s.medIndexText}>{i + 1}</Text></View>
          <Text style={s.medCardText}>{m}</Text>
        </View>
      ))}
    </DoctorCard>
  );
}

function ExamsCard({ exams }: { exams: string[] | null }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!exams || exams.length === 0) return null;
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="flask" size={16} color={colors.primary} />
        </View>
        <Text style={s.sectionLabel}>EXAMES SOLICITADOS</Text>
        <View style={s.sectionCountBadge}><Text style={s.sectionCountText}>{exams.length}</Text></View>
      </View>
      {exams.map((e, i) => (
        <View key={i} style={[s.medCard, i > 0 && s.medCardBorder]}>
          <View style={[s.medIndex, { backgroundColor: colors.accentSoft }]}>
            <Text style={[s.medIndexText, { color: colors.primaryDark }]}>{i + 1}</Text>
          </View>
          <Text style={s.medCardText}>{e}</Text>
        </View>
      ))}
    </DoctorCard>
  );
}

function SymptomsCard({ symptoms }: { symptoms: string | null }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!symptoms) return null;
  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <View style={[s.sectionIconWrap, { backgroundColor: colors.warningLight }]}>
          <Ionicons name="chatbubble-ellipses" size={16} color={colors.warning} />
        </View>
        <Text style={s.sectionLabel}>SINTOMAS RELATADOS</Text>
      </View>
      <View style={s.symptomsBlock}><Text style={s.symptomsText}>{symptoms}</Text></View>
    </DoctorCard>
  );
}

function ConsultationPostSection({ request, router }: { request: NonNullable<ReturnType<typeof useDoctorRequest>['request']>; router: ReturnType<typeof useRouter> }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (request.requestType !== 'consultation' || request.status !== 'consultation_finished') return null;
  if (!request.consultationTranscript && !request.consultationAnamnesis && !request.consultationAiSuggestions && !request.consultationEvidence) return null;

  return (
    <>
      {request.consultationAnamnesis && request.consultationAnamnesis.trim() && (() => {
        let ana: Record<string, unknown> = {};
        try { ana = JSON.parse(request.consultationAnamnesis || '{}'); } catch { /* ignore */ }
        const fields: { key: string; label: string; icon: string }[] = [
          { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble-ellipses' },
          { key: 'historia_doenca_atual', label: 'História da Doença Atual', icon: 'time' },
          { key: 'sintomas', label: 'Sintomas', icon: 'thermometer' },
          { key: 'medicamentos_em_uso', label: 'Medicamentos em Uso', icon: 'medical' },
          { key: 'alergias', label: 'Alergias', icon: 'warning' },
          { key: 'antecedentes_relevantes', label: 'Antecedentes', icon: 'document-text' },
          { key: 'cid_sugerido', label: 'CID Sugerido', icon: 'code-slash' },
        ];
        return (
          <DoctorCard style={[s.cardMargin, s.aiCard]}>
            <View style={s.aiHeader}>
              <Ionicons name="document-text" size={18} color={colors.primary} />
              <Text style={s.aiTitle}>ANAMNESE ESTRUTURADA</Text>
              <View style={[s.riskBadge, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="sparkles" size={10} color={colors.primary} />
                <Text style={[s.riskText, { color: colors.primary }]}>IA</Text>
              </View>
            </View>
            <View style={s.aiDisclaimer}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
              <Text style={s.aiDisclaimerText}>Gerado por IA — revisão médica obrigatória. CFM Res. 2.299/2021.</Text>
            </View>
            {fields.map(({ key, label, icon }) => {
              const val = ana[key];
              if (!val || (typeof val === 'string' && !val.trim())) return null;
              const display = Array.isArray(val) ? val.join(', ') : String(val);
              const isAlert = key === 'alergias';
              const isCid = key === 'cid_sugerido';
              return (
                <View key={key} style={s.anaField}>
                  <View style={s.anaLabelRow}>
                    <Ionicons name={icon as IoniconName} size={12} color={isAlert ? colors.destructive : colors.textMuted} />
                    <Text style={[s.anaLabel, isAlert && { color: colors.destructive }]}>{label}</Text>
                  </View>
                  <Text style={[s.anaValue, isCid && { color: colors.primary, fontFamily: typography.fontFamily.bold }]}>{display}</Text>
                </View>
              );
            })}
            {Array.isArray(ana.alertas_vermelhos) && (ana.alertas_vermelhos as unknown[]).length > 0 && (
              <View style={s.redFlagBlock}>
                <View style={s.anaLabelRow}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={[s.anaLabel, { color: colors.error }]}>ALERTAS DE GRAVIDADE</Text>
                </View>
                {(ana.alertas_vermelhos as string[]).map((flag, i) => (
                  <View key={i} style={s.redFlagItem}><Text style={s.redFlagText}>{flag}</Text></View>
                ))}
              </View>
            )}
          </DoctorCard>
        );
      })()}

      {(request.consultationAiSuggestions || (() => {
        try {
          const ana = JSON.parse(request.consultationAnamnesis || '{}');
          const hasMeds = Array.isArray(ana.medicamentos_sugeridos) && ana.medicamentos_sugeridos.length > 0;
          const hasExams = Array.isArray(ana.exames_sugeridos) && ana.exames_sugeridos.length > 0;
          return hasMeds || hasExams;
        } catch { return false; }
      })()) && (
        <DoctorCard style={[s.cardMargin, { borderWidth: 1, borderColor: colors.accent }]}>
          <View style={s.aiHeader}>
            <Ionicons name="bulb" size={18} color={colors.primaryLight} />
            <Text style={s.aiTitle}>SUGESTÕES CLÍNICAS DA IA</Text>
          </View>
          {request.consultationAiSuggestions && (() => {
            try {
              const items = JSON.parse(request.consultationAiSuggestions || '[]') as string[];
              return items.map((item, i) => {
                const text = typeof item === 'string' ? item : '';
                const isRedFlag = text.startsWith('🚨');
                return (
                  <View key={i} style={[s.suggestionItem, isRedFlag && s.suggestionItemDanger]}>
                    <Ionicons name={isRedFlag ? 'alert-circle' : 'bulb-outline'} size={16} color={isRedFlag ? colors.error : colors.primaryLight} />
                    <Text style={[s.suggestionText, isRedFlag && { color: colors.error }]}>{text.replace('🚨 ', '')}</Text>
                  </View>
                );
              });
            } catch { return null; }
          })()}
          {(() => {
            try {
              const ana = JSON.parse(request.consultationAnamnesis || '{}');
              const medsRaw = Array.isArray(ana.medicamentos_sugeridos) ? ana.medicamentos_sugeridos : [];
              const examsRaw = Array.isArray(ana.exames_sugeridos) ? ana.exames_sugeridos : [];
              const medDisplay = (m: unknown): string => {
                if (typeof m === 'string') return m;
                const o = m as { nome?: string; dose?: string; via?: string; posologia?: string; duracao?: string; indicacao?: string };
                const parts = [o.nome, o.dose, o.via, o.posologia, o.duracao].filter(Boolean);
                const base = parts.join(' ');
                return o.indicacao ? `${base} (${o.indicacao})` : base;
              };
              const examDisplay = (e: unknown): string => {
                if (typeof e === 'string') return e;
                const o = e as { nome?: string; descricao?: string; o_que_afere?: string; indicacao?: string };
                return o.nome ?? '';
              };
              if (medsRaw.length === 0 && examsRaw.length === 0) return null;
              return (
                <View style={{ marginTop: 8 }}>
                  {medsRaw.length > 0 && (
                    <>
                      <Text style={[s.anaLabel, { marginBottom: 6 }]}>MEDICAMENTOS SUGERIDOS</Text>
                      <View style={s.medChipsRow}>
                        {medsRaw.map((m: unknown, i: number) => (
                          <TouchableOpacity key={i} style={s.medChip} onPress={async () => { await Clipboard.setStringAsync(medDisplay(m)); showToast({ message: 'Copiado!', type: 'success' }); }}>
                            <Text style={s.medChipText} numberOfLines={2}>{medDisplay(m)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                  {examsRaw.length > 0 && (
                    <View style={{ marginTop: medsRaw.length > 0 ? 12 : 0 }}>
                      <Text style={[s.anaLabel, { marginBottom: 6 }]}>EXAMES SUGERIDOS</Text>
                      <View style={s.medChipsRow}>
                        {examsRaw.map((ex: unknown, i: number) => (
                          <TouchableOpacity key={i} style={s.medChip} onPress={async () => { await Clipboard.setStringAsync(examDisplay(ex)); showToast({ message: 'Copiado!', type: 'success' }); }}>
                            <Text style={s.medChipText} numberOfLines={2}>{examDisplay(ex)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              );
            } catch { return null; }
          })()}
        </DoctorCard>
      )}

      {request.consultationEvidence && request.consultationEvidence.trim() && (() => {
        try {
          const evidence = JSON.parse(request.consultationEvidence || '[]') as { provider?: string; url?: string; title?: string; source?: string; clinicalRelevance?: string }[];
          if (!Array.isArray(evidence) || evidence.length === 0) return null;
          return (
            <DoctorCard style={[s.cardMargin, { borderWidth: 1, borderColor: colors.accent }]}>
              <View style={s.aiHeader}>
                <Ionicons name="library" size={18} color={colors.primary} />
                <Text style={s.aiTitle}>ARTIGOS CIENTÍFICOS (APOIO AO CID)</Text>
              </View>
              <View style={s.aiDisclaimer}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={s.aiDisclaimerText}>Fontes: PubMed, Europe PMC, Semantic Scholar. Links diretos para os artigos.</Text>
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
          );
        } catch { return null; }
      })()}

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

      {(() => {
        try {
          const ana = JSON.parse(request.consultationAnamnesis || '{}');
          const medsRaw = Array.isArray(ana.medicamentos_sugeridos) ? ana.medicamentos_sugeridos : [];
          const examsRaw = Array.isArray(ana.exames_sugeridos) ? ana.exames_sugeridos : [];
          const medDisplay = (m: unknown): string => {
            if (typeof m === 'string') return m;
            const o = m as { nome?: string; dose?: string; via?: string; posologia?: string; duracao?: string; indicacao?: string };
            const parts = [o.nome, o.dose, o.via, o.posologia, o.duracao].filter(Boolean);
            const base = parts.join(' ');
            return o.indicacao ? `${base} (${o.indicacao})` : base;
          };
          const examDisplay = (e: unknown): string => {
            if (typeof e === 'string') return e;
            const o = e as { nome?: string };
            return o.nome ?? '';
          };
          const medsForPrefill = medsRaw.map((m: unknown) => medDisplay(m));
          const examsForPrefill = examsRaw.map((e: unknown) => examDisplay(e));
          if (medsRaw.length === 0 && examsRaw.length === 0) return null;
          return (
            <View style={[s.cardMargin, { marginBottom: 8 }]}>
              {medsRaw.length > 0 && (
                <AppButton
                  title="Criar Receita Baseada na Consulta"
                  variant="doctorPrimary"
                  trailing={<Ionicons name="chevron-forward" size={20} color={colors.white} />}
                  onPress={() => router.push({ pathname: '/doctor-request/editor/[id]' as never, params: { id: request.id, prefillMeds: JSON.stringify(medsForPrefill) } })}
                  style={{ width: '100%' }}
                />
              )}
              {examsRaw.length > 0 && (
                <AppButton
                  title="Criar Pedido de Exame Baseado na Consulta"
                  variant="outline"
                  trailing={<Ionicons name="flask-outline" size={20} color={colors.primary} />}
                  onPress={() => router.push({ pathname: '/new-request/exam' as never, params: { prefillExams: JSON.stringify(examsForPrefill) } })}
                  style={{ width: '100%', marginTop: medsRaw.length > 0 ? 8 : 0 }}
                />
              )}
            </View>
          );
        } catch { return null; }
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
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const suggestion = request.aiConductSuggestion || '';
  if (request.requestType !== 'consultation') return null;

  return (
    <DoctorCard style={[s.cardMargin, s.formCard]}>
      <View style={s.formHeader}>
        <Ionicons name="journal" size={18} color={colors.primary} />
        <Text style={s.formTitle}>PRONTUÁRIO / CONDUTA DA CONSULTA</Text>
      </View>
      <Text style={s.formDesc}>
        Campo livre para registrar evolução, hipótese (CID) e conduta em linguagem clínica.
        Somente o médico pode editar; o texto compõe o histórico do paciente.
      </Text>
      {request.aiConductSuggestion && (
        <View style={{ marginBottom: spacing.sm }}>
          <View style={s.aiHeader}>
            <Ionicons name="bulb" size={16} color={colors.primary} />
            <Text style={s.aiTitle}>Sugestão de conduta da IA</Text>
          </View>
          <Text style={[s.aiSummary, { fontSize: 13, lineHeight: 20, color: colors.textSecondary, marginTop: spacing.xs }]}>{suggestion}</Text>
          <TouchableOpacity
            style={s.aiSummaryActionBtn}
            onPress={() => setSheetOpen(true)}
          >
            <Ionicons name="ellipsis-horizontal-circle-outline" size={16} color={colors.primary} />
            <Text style={s.aiSummaryActionText}>Ações da IA</Text>
          </TouchableOpacity>
          <AIActionSheet
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Ações da sugestão de conduta"
            subtitle="Copie ou aplique no prontuário com um toque."
            actions={[
              {
                key: 'copy',
                label: 'Copiar sugestão',
                icon: 'copy-outline',
                onPress: async () => {
                  await Clipboard.setStringAsync(suggestion);
                  showToast({ message: 'Sugestão copiada', type: 'success' });
                },
              },
              {
                key: 'apply',
                label: 'Aplicar no prontuário',
                icon: 'checkmark-done-outline',
                onPress: () => {
                  const next = conductNotes && conductNotes.trim().length > 0
                    ? `${conductNotes.trim()}\n\n${suggestion}`
                    : suggestion;
                  setConductNotes(next);
                },
              },
              {
                key: 'discard',
                label: 'Descartar',
                icon: 'trash-outline',
                destructive: true,
                onPress: () => {},
              },
            ]}
          />
        </View>
      )}
      <TextInput
        style={s.formTextArea}
        placeholder={'Sugestão de estruturação:\nQueixa e duração: ...\nEvolução / anamnese: ...\nHipótese diagnóstica (CID): ...\nConduta: Visando continuidade do tratamento, prescrevo...'}
        value={conductNotes}
        onChangeText={setConductNotes}
        multiline
        textAlignVertical="top"
        placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}
        onPress={() => setIncludeConductInPdf(prev => !prev)}
        activeOpacity={0.7}
      >
        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: includeConductInPdf ? colors.primary : colors.border, backgroundColor: includeConductInPdf ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
          {includeConductInPdf && <Ionicons name="checkmark" size={14} color={colors.white} />}
        </View>
        <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
          Incluir esta conduta no PDF e no histórico compartilhado com o paciente.
        </Text>
      </TouchableOpacity>
      <View style={s.formBtns}>
        <AppButton title="Salvar no prontuário" variant="doctorPrimary" onPress={handleSaveConduct} loading={savingConduct} style={s.primaryBtnFlex} />
      </View>
    </DoctorCard>
  );
}

function SignedDocumentCard({ request }: { request: NonNullable<ReturnType<typeof useDoctorRequest>['request']> }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  if (!request.signedDocumentUrl) return null;

  return (
    <DoctorCard style={s.cardMargin}>
      <View style={s.sectionHeader}>
        <Ionicons name="document-text" size={18} color={colors.success} />
        <Text style={s.sectionTitle}>DOCUMENTO ASSINADO</Text>
      </View>
      <TouchableOpacity
        style={s.pdfBtn}
        onPress={async () => {
          try {
            await WebBrowser.openBrowserAsync(request.signedDocumentUrl!);
          } catch (e: unknown) {
            Alert.alert('Erro', (e as Error)?.message || 'Não foi possível abrir o documento.');
          }
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="open-outline" size={20} color={colors.primary} />
        <Text style={s.pdfBtnText}>Visualizar PDF Assinado</Text>
      </TouchableOpacity>
    </DoctorCard>
  );
}

/* ---- Styles ---- */

const pad = doctorDS.screenPaddingHorizontal;

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, gap: spacing.md },
  emptyTitle: { fontSize: 14, fontFamily: typography.fontFamily.bold, color: colors.textSecondary, letterSpacing: 0.8 },
  emptyAction: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: borderRadius.md, marginTop: spacing.sm },
  emptyActionText: { fontSize: 13, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.white, letterSpacing: 0.6 },
  cardMargin: { marginHorizontal: pad, marginTop: spacing.md },
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
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(0,119,182,0.06)', borderRadius: 6 },
  aiDisclaimerText: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummary: { fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 24 },
  aiSummaryActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  aiSummaryActionText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  medCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  medCardBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  medIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  medIndexText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.primary },
  medCardText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text, flex: 1, lineHeight: 20 },
  symptomsBlock: { borderLeftWidth: 3, borderLeftColor: colors.warning, paddingLeft: 12, paddingVertical: 4, backgroundColor: colors.warningLight + '40', borderRadius: 4 },
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
