/**
 * Tela Pós-Consulta — Design aprovado.
 * Emite receita + exames + atestado pré-preenchidos pela IA.
 * O médico revisa, edita e assina tudo de uma vez.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import { emitPostConsultationDocuments } from '../../lib/api-requests';
import type { RequestResponseDto } from '../../types/database';
import type {
  PostConsultationEmitRequest,
  PrescriptionItemEmit,
  ExamItemEmit,
} from '../../types/postConsultation';
import { parseAnamnesis, type AnamnesisData } from '../../lib/domain/anamnesis';
import { CID_PACKAGES, EXAM_PACKAGES, getCidPackage } from '../../lib/data/cidPackages';

// ── Types ──

interface Props {
  request: RequestResponseDto;
  onComplete: () => void;
  onBack: () => void;
}

// ── Helpers ──

function extractCidFromAnamnesis(anamnesis: AnamnesisData | null): string | null {
  if (!anamnesis?.cid_sugerido) return null;
  return anamnesis.cid_sugerido.toUpperCase().replace(/\./g, '').trim();
}

function buildMedsFromAnamnesis(anamnesis: AnamnesisData | null): PrescriptionItemEmit[] {
  if (!anamnesis?.medicamentos_sugeridos) return [];
  return anamnesis.medicamentos_sugeridos.map((m) => {
    if (typeof m === 'string') return { drug: m };
    return {
      drug: m.nome ?? 'Medicamento',
      concentration: m.dose ?? undefined,
      form: m.via ?? undefined,
      posology: m.posologia ?? undefined,
      duration: m.duracao ?? undefined,
      notes: m.indicacao ?? undefined,
    };
  });
}

function buildExamsFromAnamnesis(anamnesis: AnamnesisData | null): ExamItemEmit[] {
  if (!anamnesis?.exames_sugeridos) return [];
  return anamnesis.exames_sugeridos.map((e) => {
    if (typeof e === 'string') return { type: 'laboratorial', description: e };
    return {
      type: 'laboratorial',
      code: e.codigo_tuss ?? undefined,
      description: e.nome ?? 'Exame',
    };
  });
}

// ── Main Component ──

export default function PostConsultationScreen({ request, onComplete, onBack }: Props) {
  const { colors } = useAppTheme();
  const S = useMemo(() => makeStyles(colors), [colors]);

  // ── Parse anamnesis ──
  const anamnesis = useMemo(
    () => parseAnamnesis(request.consultationAnamnesis),
    [request.consultationAnamnesis]
  );

  const detectedCid = useMemo(() => extractCidFromAnamnesis(anamnesis), [anamnesis]);
  const cidPkg = useMemo(() => detectedCid ? getCidPackage(detectedCid) : null, [detectedCid]);

  // ── State: Document toggles ──
  const [rxEnabled, setRxEnabled] = useState(true);
  const [exEnabled, setExEnabled] = useState(false);
  const [atEnabled, setAtEnabled] = useState(() => (cidPkg?.defaultLeaveDays ?? 0) > 0);

  // ── State: Sections expanded ──
  const [rxOpen, setRxOpen] = useState(true);
  const [exOpen, setExOpen] = useState(false);
  const [atOpen, setAtOpen] = useState(() => (cidPkg?.defaultLeaveDays ?? 0) > 0);
  const [cidPickerOpen, setCidPickerOpen] = useState(false);
  const [exListExpanded, setExListExpanded] = useState(false);

  // ── State: Prescription ──
  const [rxType, setRxType] = useState<'simples' | 'controlado'>('simples');
  const [meds, setMeds] = useState<PrescriptionItemEmit[]>(() =>
    buildMedsFromAnamnesis(anamnesis).length > 0
      ? buildMedsFromAnamnesis(anamnesis)
      : cidPkg?.medications.map((m) => ({
          drug: m.drug, posology: m.posology, notes: m.indication,
        })) ?? []
  );

  // ── State: Exams ──
  const [exams, setExams] = useState<ExamItemEmit[]>(() =>
    buildExamsFromAnamnesis(anamnesis).length > 0
      ? buildExamsFromAnamnesis(anamnesis)
      : cidPkg?.exams.map((e) => ({ type: 'laboratorial', description: e })) ?? []
  );
  const [examJustification, setExamJustification] = useState(cidPkg?.examJustification ?? '');

  // ── State: Certificate ──
  const [certType, setCertType] = useState<'afastamento' | 'comparecimento' | 'aptidao'>('afastamento');
  const [certBody, setCertBody] = useState(cidPkg?.defaultCertificateBody ?? '');
  const [certCid, setCertCid] = useState(detectedCid ?? '');
  const [certDays, setCertDays] = useState(cidPkg?.defaultLeaveDays ?? 3);
  const [certIncludeCid, setCertIncludeCid] = useState(true);

  // ── State: Submission ──
  const [submitting, setSubmitting] = useState(false);

  // ── CID change: reload all data ──
  const loadCidPackage = useCallback((code: string) => {
    const pkg = getCidPackage(code);
    if (!pkg) return;
    setMeds(pkg.medications.map((m) => ({ drug: m.drug, posology: m.posology, notes: m.indication })));
    setExams(pkg.exams.map((e) => ({ type: 'laboratorial', description: e })));
    setExamJustification(pkg.examJustification);
    setCertBody(pkg.defaultCertificateBody);
    setCertCid(code);
    setCertDays(pkg.defaultLeaveDays || 1);
    setAtEnabled(pkg.defaultLeaveDays > 0);
    setAtOpen(pkg.defaultLeaveDays > 0);
    if (pkg.exams.length > 0) { setExEnabled(true); setExOpen(true); }
    setCidPickerOpen(false);
  }, []);

  // ── Remove item helpers ──
  const removeMed = (idx: number) => setMeds((prev) => prev.filter((_, i) => i !== idx));
  const removeExam = (idx: number) => setExams((prev) => prev.filter((_, i) => i !== idx));

  // ── Load exam package ──
  const loadExamPackage = useCallback((pkgKey: string) => {
    const pkg = EXAM_PACKAGES.find((p) => p.key === pkgKey);
    if (!pkg) return;
    setExams(pkg.exams.map((e) => ({ type: 'laboratorial', description: e })));
    setExamJustification(pkg.justification);
    setExEnabled(true);
    setExOpen(true);
  }, []);

  // ── Computed ──
  const docCount = (rxEnabled ? 1 : 0) + (exEnabled ? 1 : 0) + (atEnabled ? 1 : 0);
  const docTags: string[] = [];
  if (rxEnabled) docTags.push(`Receita (${meds.length})`);
  if (exEnabled) docTags.push(`Exames (${exams.length})`);
  if (atEnabled) docTags.push(`Atestado (${certDays}d)`);

  // ── Submit ──
  const handleSubmit = async () => {
    if (docCount === 0) {
      Alert.alert('Nenhum documento', 'Ative pelo menos um documento para emitir.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: PostConsultationEmitRequest = {
        requestId: request.id,
        mainIcd10Code: certCid || detectedCid || undefined,
        anamnesis: request.consultationAnamnesis ?? undefined,
        structuredAnamnesis: request.consultationAnamnesis ?? undefined,
        plan: request.doctorConductNotes ?? request.aiConductSuggestion ?? undefined,
      };

      if (rxEnabled && meds.length > 0) {
        payload.prescription = { type: rxType, items: meds };
      }
      if (exEnabled && exams.length > 0) {
        payload.examOrder = { clinicalJustification: examJustification, items: exams };
      }
      if (atEnabled && certBody.trim()) {
        payload.medicalCertificate = {
          certificateType: certType,
          body: certBody,
          icd10Code: certCid || undefined,
          leaveDays: certDays,
          leaveStartDate: new Date().toISOString(),
          leavePeriod: 'integral',
          includeIcd10: certIncludeCid,
        };
      }

      const result = await emitPostConsultationDocuments(payload);
      Alert.alert('Documentos emitidos', result.message, [{ text: 'OK', onPress: onComplete }]);
    } catch (err: any) {
      Alert.alert('Erro', err?.message ?? 'Não foi possível emitir os documentos.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──
  return (
    <View style={S.root}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* CID Hero Card */}
        <View style={S.cidCard}>
          <View style={S.cidBadge}>
            <Text style={S.cidBadgeText}>{certCid || detectedCid || '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.cidTitle}>
              {cidPkg?.name ?? CID_PACKAGES[certCid]?.name ?? 'CID não identificado'}
            </Text>
            <Text style={S.cidSub}>Documentos pré-preenchidos com base na transcrição da consulta.</Text>
            <TouchableOpacity onPress={() => setCidPickerOpen(!cidPickerOpen)}>
              <Text style={S.cidLink}>Trocar CID</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CID Picker (colapsável) */}
        {cidPickerOpen && (
          <View style={S.cidGrid}>
            {Object.values(CID_PACKAGES).map((pkg) => (
              <TouchableOpacity
                key={pkg.code}
                style={[S.cidOpt, pkg.code === certCid && S.cidOptActive]}
                onPress={() => loadCidPackage(pkg.code)}
              >
                <Text style={S.cidOptCode}>{pkg.code}</Text>
                <Text style={S.cidOptName}>{pkg.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ═══ RECEITA ═══ */}
        <View style={[S.panel, !rxEnabled && S.panelOff]}>
          <TouchableOpacity style={S.panelHead} onPress={() => rxEnabled && setRxOpen(!rxOpen)} activeOpacity={0.7}>
            <View style={[S.panelDot, { backgroundColor: '#2E5BFF' }]} />
            <Text style={S.panelName}>Receita</Text>
            <Text style={S.panelBadge}>{meds.length} ite{meds.length !== 1 ? 'ns' : 'm'}</Text>
            <Switch value={rxEnabled} onValueChange={(v) => { setRxEnabled(v); if (v) setRxOpen(true); }}
              trackColor={{ false: '#D4D7DF', true: '#2E5BFF' }} thumbColor="#fff" />
            <Ionicons name={rxOpen && rxEnabled ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {rxOpen && rxEnabled && (
            <View style={S.panelBody}>
              <View style={S.chips}>
                <TouchableOpacity style={[S.chip, rxType === 'simples' && S.chipOn]} onPress={() => setRxType('simples')}>
                  <Text style={[S.chipText, rxType === 'simples' && S.chipTextOn]}>Simples</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[S.chip, rxType === 'controlado' && S.chipOn]} onPress={() => setRxType('controlado')}>
                  <Text style={[S.chipText, rxType === 'controlado' && S.chipTextOn]}>Controlado</Text>
                </TouchableOpacity>
              </View>
              {meds.map((m, i) => (
                <View key={`med-${i}`} style={S.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={S.itemName}>{m.drug}{m.concentration ? ` ${m.concentration}` : ''}</Text>
                    {(m.posology || m.notes) && (
                      <Text style={S.itemSub}>{[m.posology, m.notes].filter(Boolean).join(' · ')}</Text>
                    )}
                  </View>
                  <TouchableOpacity style={S.itemRemove} onPress={() => removeMed(i)}>
                    <Ionicons name="close" size={14} color="#E5484D" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={S.addBtn}>
                <Ionicons name="add" size={18} color="#2E5BFF" />
                <Text style={S.addBtnText}>Adicionar medicamento</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ═══ EXAMES ═══ */}
        <View style={[S.panel, !exEnabled && S.panelOff]}>
          <TouchableOpacity style={S.panelHead} onPress={() => exEnabled && setExOpen(!exOpen)} activeOpacity={0.7}>
            <View style={[S.panelDot, { backgroundColor: '#00B27A' }]} />
            <Text style={S.panelName}>Exames</Text>
            <Text style={S.panelBadge}>{exams.length} exame{exams.length !== 1 ? 's' : ''}</Text>
            <Switch value={exEnabled} onValueChange={(v) => { setExEnabled(v); if (v) setExOpen(true); }}
              trackColor={{ false: '#D4D7DF', true: '#00B27A' }} thumbColor="#fff" />
            <Ionicons name={exOpen && exEnabled ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {exOpen && exEnabled && (
            <View style={S.panelBody}>
              {/* Exam Packages */}
              <Text style={S.label}>PACOTES RÁPIDOS</Text>
              <View style={S.pkgGrid}>
                {EXAM_PACKAGES.map((pkg) => (
                  <TouchableOpacity key={pkg.key} style={S.pkg} onPress={() => loadExamPackage(pkg.key)}>
                    <Text style={S.pkgName}>{pkg.name}</Text>
                    <Text style={S.pkgCount}>{pkg.exams.length} exames</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={S.divider} />
              {/* Exam Items (colapsável) */}
              {exams.slice(0, exListExpanded ? undefined : 3).map((e, i) => (
                <View key={`ex-${i}`} style={S.item}>
                  <Text style={[S.itemName, { flex: 1 }]}>{e.description}</Text>
                  <TouchableOpacity style={S.itemRemove} onPress={() => removeExam(i)}>
                    <Ionicons name="close" size={14} color="#E5484D" />
                  </TouchableOpacity>
                </View>
              ))}
              {exams.length > 3 && (
                <TouchableOpacity style={S.expandBtn} onPress={() => setExListExpanded(!exListExpanded)}>
                  <Ionicons name={exListExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#2E5BFF" />
                  <Text style={S.expandBtnText}>{exListExpanded ? 'Recolher' : `Ver todos (${exams.length})`}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={S.addBtn}>
                <Ionicons name="add" size={18} color="#2E5BFF" />
                <Text style={S.addBtnText}>Adicionar exame avulso</Text>
              </TouchableOpacity>
              <View style={{ marginTop: 10 }}>
                <Text style={S.fieldLabel}>Justificativa clínica</Text>
                <TextInput style={S.textArea} value={examJustification} onChangeText={setExamJustification}
                  placeholder="Preenchida ao selecionar pacote" multiline placeholderTextColor={colors.textMuted} />
              </View>
            </View>
          )}
        </View>

        {/* ═══ ATESTADO ═══ */}
        <View style={[S.panel, !atEnabled && S.panelOff]}>
          <TouchableOpacity style={S.panelHead} onPress={() => atEnabled && setAtOpen(!atOpen)} activeOpacity={0.7}>
            <View style={[S.panelDot, { backgroundColor: '#E88D1A' }]} />
            <Text style={S.panelName}>Atestado</Text>
            <Text style={S.panelBadge}>{certDays} dia{certDays !== 1 ? 's' : ''}</Text>
            <Switch value={atEnabled} onValueChange={(v) => { setAtEnabled(v); if (v) setAtOpen(true); }}
              trackColor={{ false: '#D4D7DF', true: '#E88D1A' }} thumbColor="#fff" />
            <Ionicons name={atOpen && atEnabled ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
          </TouchableOpacity>
          {atOpen && atEnabled && (
            <View style={S.panelBody}>
              <View style={S.chips}>
                {(['afastamento', 'comparecimento', 'aptidao'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[S.chip, certType === t && S.chipOn]} onPress={() => setCertType(t)}>
                    <Text style={[S.chipText, certType === t && S.chipTextOn]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={S.fieldLabel}>Motivo</Text>
              <TextInput style={S.textArea} value={certBody} onChangeText={setCertBody}
                multiline placeholderTextColor={colors.textMuted} />
              <View style={S.certRow}>
                <View style={{ width: 80 }}>
                  <Text style={S.fieldLabel}>CID</Text>
                  <TextInput style={[S.input, { textAlign: 'center', fontWeight: '600', fontSize: 16 }]}
                    value={certCid} onChangeText={setCertCid} autoCapitalize="characters" />
                </View>
                <View style={{ width: 100 }}>
                  <Text style={S.fieldLabel}>Dias</Text>
                  <View style={S.stepper}>
                    <TouchableOpacity style={S.stepBtn} onPress={() => setCertDays(Math.max(1, certDays - 1))}>
                      <Text style={S.stepBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={S.stepVal}>{certDays}</Text>
                    <TouchableOpacity style={S.stepBtn} onPress={() => setCertDays(Math.min(30, certDays + 1))}>
                      <Text style={S.stepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.fieldLabel}>Início</Text>
                  <TextInput style={[S.input, { backgroundColor: '#F9FAFB' }]}
                    value={new Date().toLocaleDateString('pt-BR')} editable={false} />
                </View>
              </View>
              <TouchableOpacity style={S.checkRow} onPress={() => setCertIncludeCid(!certIncludeCid)}>
                <View style={[S.checkbox, certIncludeCid && S.checkboxOn]}>
                  {certIncludeCid && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={S.checkText}>Incluir CID no atestado (paciente autorizou)</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ═══ RESUMO ═══ */}
        <View style={S.summary}>
          <Text style={S.summaryTitle}>
            {docCount} documento{docCount !== 1 ? 's' : ''} pronto{docCount !== 1 ? 's' : ''} para assinatura
          </Text>
          <View style={S.tags}>
            {docTags.map((t, i) => (
              <View key={i} style={S.tag}>
                <Text style={S.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══ BOTÕES ═══ */}
        <TouchableOpacity style={S.signBtn} onPress={handleSubmit} disabled={submitting || docCount === 0}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
              <Text style={S.signBtnText}>Assinar e emitir documentos</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={S.wppBtn}>
          <Ionicons name="logo-whatsapp" size={20} color="#22C55E" />
          <Text style={S.wppBtnText}>Enviar por WhatsApp</Text>
        </TouchableOpacity>

        <Text style={S.footer}>
          Assinatura digital ICP-Brasil · QR Code verificável{'\n'}
          Prontuário atualizado automaticamente
        </Text>

      </ScrollView>
    </View>
  );
}

// ── Styles ──

function makeStyles(c: DesignColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F4F5F7' },
    scroll: { padding: 16, paddingBottom: 40 },

    // CID Card
    cidCard: {
      backgroundColor: '#F4F1FF', borderRadius: 16, padding: 18,
      flexDirection: 'row', alignItems: 'center', gap: 16,
      borderWidth: 1, borderColor: '#E2DEFF', marginBottom: 16,
    },
    cidBadge: {
      width: 56, height: 56, borderRadius: 14, backgroundColor: '#7B61FF',
      justifyContent: 'center', alignItems: 'center',
    },
    cidBadgeText: { color: '#fff', fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },
    cidTitle: { fontSize: 16, fontWeight: '600', color: '#4C1D95', letterSpacing: -0.3 },
    cidSub: { fontSize: 12, color: '#7C3AED', marginTop: 4, lineHeight: 18 },
    cidLink: { fontSize: 12, color: '#7B61FF', fontWeight: '500', marginTop: 6 },

    cidGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16,
    },
    cidOpt: {
      width: '48%' as any, padding: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: '#ECEDF1', backgroundColor: '#fff',
    },
    cidOptActive: { borderColor: '#7B61FF', backgroundColor: '#F4F1FF' },
    cidOptCode: { fontSize: 14, fontWeight: '600', color: '#1A1D26' },
    cidOptName: { fontSize: 11, color: '#9498A8', marginTop: 2 },

    // Panels
    panel: {
      backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ECEDF1',
      marginBottom: 10, overflow: 'hidden',
    },
    panelOff: { opacity: 0.35 },
    panelHead: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 16, minHeight: 58,
    },
    panelDot: { width: 10, height: 10, borderRadius: 5 },
    panelName: { fontSize: 16, fontWeight: '600', color: '#1A1D26', flex: 1, letterSpacing: -0.3 },
    panelBadge: {
      fontSize: 12, color: '#9498A8', fontWeight: '500',
      backgroundColor: '#F4F5F7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    },
    panelBody: { paddingHorizontal: 18, paddingBottom: 18 },

    // Chips
    chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    chip: {
      paddingHorizontal: 20, paddingVertical: 9, borderRadius: 24,
      borderWidth: 1.5, borderColor: '#ECEDF1', backgroundColor: '#fff',
    },
    chipOn: { backgroundColor: '#1A1D26', borderColor: '#1A1D26' },
    chipText: { fontSize: 13, fontWeight: '500', color: '#5E6272' },
    chipTextOn: { color: '#fff' },

    // Items
    item: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB',
      marginBottom: 6, minHeight: 50,
    },
    itemName: { fontSize: 14, fontWeight: '500', color: '#1A1D26', lineHeight: 20 },
    itemSub: { fontSize: 12, color: '#9498A8', marginTop: 2 },
    itemRemove: {
      width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2',
      justifyContent: 'center', alignItems: 'center',
    },

    // Add button
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5,
      borderColor: '#D4D7DF', borderStyle: 'dashed', marginTop: 4,
    },
    addBtnText: { fontSize: 13, fontWeight: '500', color: '#2E5BFF' },

    // Expand
    expandBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: 10, borderRadius: 8, marginTop: 4,
    },
    expandBtnText: { fontSize: 13, fontWeight: '500', color: '#2E5BFF' },

    // Exam packages
    label: { fontSize: 11, fontWeight: '500', color: '#9498A8', letterSpacing: 0.6, marginBottom: 8 },
    pkgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    pkg: {
      width: '48%' as any, padding: 14, borderRadius: 12,
      borderWidth: 1.5, borderColor: '#ECEDF1', backgroundColor: '#fff',
    },
    pkgName: { fontSize: 13, fontWeight: '600', color: '#1A1D26' },
    pkgCount: { fontSize: 11, color: '#9498A8', marginTop: 2 },
    divider: { height: 1, backgroundColor: '#ECEDF1', marginVertical: 10 },

    // Fields
    fieldLabel: { fontSize: 12, fontWeight: '500', color: '#5E6272', marginBottom: 5 },
    input: {
      borderWidth: 1.5, borderColor: '#ECEDF1', borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
      color: '#1A1D26', backgroundColor: '#fff', minHeight: 48,
    },
    textArea: {
      borderWidth: 1.5, borderColor: '#ECEDF1', borderRadius: 12,
      padding: 14, fontSize: 14, color: '#1A1D26', backgroundColor: '#fff',
      minHeight: 64, textAlignVertical: 'top', marginBottom: 10,
    },

    // Certificate specifics
    certRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-end' },
    stepper: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
      borderRadius: 12, borderWidth: 1.5, borderColor: '#ECEDF1', overflow: 'hidden', height: 48,
    },
    stepBtn: {
      width: 44, height: 48, justifyContent: 'center', alignItems: 'center',
    },
    stepBtnText: { fontSize: 18, color: '#5E6272' },
    stepVal: { fontSize: 18, fontWeight: '600', minWidth: 32, textAlign: 'center', color: '#1A1D26' },
    checkRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      padding: 14, backgroundColor: '#F9FAFB', borderRadius: 12, minHeight: 48,
    },
    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D4D7DF',
      justifyContent: 'center', alignItems: 'center',
    },
    checkboxOn: { backgroundColor: '#2E5BFF', borderColor: '#2E5BFF' },
    checkText: { fontSize: 13, color: '#5E6272', flex: 1 },

    // Summary
    summary: {
      backgroundColor: '#ECFDF5', borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 14,
    },
    summaryTitle: { fontSize: 15, fontWeight: '600', color: '#065F46', marginBottom: 10, letterSpacing: -0.3 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    tag: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: '#D1FAE5' },
    tagText: { fontSize: 12, fontWeight: '500', color: '#065F46' },

    // CTAs
    signBtn: {
      backgroundColor: '#1A1D26', borderRadius: 16, paddingVertical: 18,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    signBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
    wppBtn: {
      borderRadius: 16, paddingVertical: 16, marginTop: 8,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      borderWidth: 1.5, borderColor: '#22C55E', backgroundColor: '#F7FDF9',
    },
    wppBtnText: { fontSize: 14, fontWeight: '500', color: '#166534' },
    footer: { fontSize: 11, color: '#9498A8', textAlign: 'center', marginTop: 12, lineHeight: 18 },
  });
}
