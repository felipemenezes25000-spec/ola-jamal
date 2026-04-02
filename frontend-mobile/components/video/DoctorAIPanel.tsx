/**
 * DoctorAIPanel — Painel lateral do médico durante a videoconsulta.
 * Theme-aware (dark mode forced), UX otimizada para decisão clínica rápida.
 *
 * Sub-components:
 *   ai-panel/AIIndicators.tsx    — Gravity, CID, alerts, differential
 *   ai-panel/AISuggestionView.tsx — Meds, exams, interactions, anamnesis
 *   ai-panel/AIMetadataPanel.tsx  — Perguntas, sugestões, evidências tabs
 *   ai-panel/types.ts             — Shared types, configs, helpers, styles
 */

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { getFieldsForConsultationType } from '../../lib/domain/anamnesis';
import { parseMed, parseExam } from './ai-panel/types';
import { AIIndicators } from './ai-panel/AIIndicators';
import { AIMetadataPanel } from './ai-panel/AIMetadataPanel';

// ── Types ──

type MedSugerido = string | {
  nome: string; classe_terapeutica?: string; dose?: string; via?: string;
  posologia?: string; duracao?: string; indicacao?: string;
  contraindicacoes?: string; interacoes?: string;
  mecanismo_acao?: string; ajuste_renal?: string; ajuste_hepatico?: string;
  alerta_faixa_etaria?: string; alternativa?: string;
};

type ExameSugerido = string | {
  nome: string; codigo_tuss?: string; descricao?: string;
  o_que_afere?: string; indicacao?: string; interpretacao_esperada?: string;
  preparo_paciente?: string; prazo_resultado?: string; urgencia?: string;
};

type DiagDiferencial = {
  hipotese: string; cid: string; probabilidade: string;
  argumentos_a_favor?: string; argumentos_contra?: string;
  exames_confirmatorios?: string;
};

type PerguntaSugerida = {
  pergunta: string;
  objetivo?: string;
  hipoteses_afetadas?: string;
  impacto_na_conduta?: string;
  prioridade?: 'alta' | 'media' | 'baixa';
};

type InteracaoCruzada = {
  medicamento_a: string;
  medicamento_b: string;
  tipo: 'grave' | 'moderada' | 'leve';
  descricao: string;
  conduta: string;
};

type EvidenceItem = {
  title: string; abstract: string; source: string;
  translatedAbstract?: string; relevantExcerpts?: string[];
  clinicalRelevance?: string; provider?: string; url?: string;
  conexaoComPaciente?: string; nivelEvidencia?: string; motivoSelecao?: string;
};

interface DoctorAIPanelProps {
  anamnesis: Record<string, unknown> | null;
  suggestions: string[];
  evidence: EvidenceItem[];
  consultationType?: string | null;
}

// ── Tab definition ──

type TabKey = 'consulta' | 'perguntas' | 'evidencias';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'consulta', label: 'Consulta', icon: 'document-text' },
  { key: 'perguntas', label: 'Perguntas', icon: 'help-circle' },
  { key: 'evidencias', label: 'Evidências', icon: 'library' },
];

// ── Gravity badge — colors resolved at render time via useAppTheme ──

function getGravityConfig(colors: any): Record<string, { color: string; label: string; icon: string }> {
  return {
    verde: { color: colors.success, label: 'Não Urgente', icon: 'shield-checkmark' },
    amarelo: { color: colors.warning, label: 'Pouco Urgente', icon: 'alert-circle' },
    laranja: { color: colors.error, label: 'Urgente', icon: 'warning' },
    vermelho: { color: colors.destructive, label: 'Emergência', icon: 'close-circle' },
  };
}

// ── Anamnesis field definitions (source: lib/domain/anamnesis.ts) ──

// Re-export types for consumers that import from this file
export type { DoctorAIPanelProps } from './ai-panel/types';

export function DoctorAIPanel({ anamnesis, suggestions, evidence, consultationType }: DoctorAIPanelProps) {
  const { colors } = useAppTheme({ scheme: 'dark', role: 'doctor' });
  const S = useMemo(() => makeStyles(colors), [colors]);
  const GRAVITY_CONFIG = useMemo(() => getGravityConfig(colors), [colors]);
  const isPsy = consultationType === 'psicologo';
  const displayFields = useMemo(() => getFieldsForConsultationType(consultationType), [consultationType]);
  const [activeTab, setActiveTab] = useState<TabKey>('consulta');
  const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set());
  const [expandedMeds, setExpandedMeds] = useState<Set<number>>(new Set());

  // Parse derived data
  const denominadorComum = (anamnesis?.denominador_comum as string) ?? '';
  const gravidade = (anamnesis?.classificacao_gravidade as string) ?? '';
  const diagDiferencial: DiagDiferencial[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.diagnostico_diferencial) ? (anamnesis!.diagnostico_diferencial as DiagDiferencial[]) : []; }
    catch { return []; }
  }, [anamnesis]);
  const primaryDiag = diagDiferencial.length > 0 ? diagDiferencial[0] : null;
  const primaryCid = primaryDiag?.cid ?? '';
  const primaryHipotese = primaryDiag?.hipotese ?? '';
  const exameFisicoDirigido = (anamnesis?.exame_fisico_dirigido as string) ?? '';
  const orientacoesPaciente: string[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.orientacoes_paciente) ? (anamnesis!.orientacoes_paciente as string[]) : []; }
    catch { return []; }
  }, [anamnesis]);
  const criteriosRetorno: string[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.criterios_retorno) ? (anamnesis!.criterios_retorno as string[]) : []; }
    catch { return []; }
  }, [anamnesis]);
  const perguntasSugeridas: PerguntaSugerida[] = useMemo(() => {
    try {
      if (!Array.isArray(anamnesis?.perguntas_sugeridas)) return [];
      return (anamnesis!.perguntas_sugeridas as unknown[]).map((p: unknown) =>
        typeof p === 'string'
          ? { pergunta: p, objetivo: '', hipoteses_afetadas: '', impacto_na_conduta: '', prioridade: 'media' as const }
          : {
              pergunta: (p as PerguntaSugerida).pergunta ?? '',
              objetivo: (p as PerguntaSugerida).objetivo ?? '',
              hipoteses_afetadas: (p as PerguntaSugerida).hipoteses_afetadas ?? '',
              impacto_na_conduta: (p as PerguntaSugerida).impacto_na_conduta ?? '',
              prioridade: ((p as PerguntaSugerida).prioridade ?? 'media') as 'alta' | 'media' | 'baixa',
            }
      ).filter((p: PerguntaSugerida) => p.pergunta.length > 0);
    } catch { return []; }
  }, [anamnesis]);
  const lacunasAnamnese: string[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.lacunas_anamnese) ? (anamnesis!.lacunas_anamnese as string[]) : []; }
    catch { return []; }
  }, [anamnesis]);
  const alertasVermelhos: string[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.alertas_vermelhos) ? (anamnesis!.alertas_vermelhos as string[]) : []; }
    catch { return []; }
  }, [anamnesis]);
  const meds: MedSugerido[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.medicamentos_sugeridos) ? (anamnesis!.medicamentos_sugeridos as MedSugerido[]) : []; }
    catch { return []; }
  }, [anamnesis]);
  const exames: ExameSugerido[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.exames_sugeridos) ? (anamnesis!.exames_sugeridos as ExameSugerido[]) : []; }
    catch { return []; }
  }, [anamnesis]);
  const interacoesCruzadas: InteracaoCruzada[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.interacoes_cruzadas) ? (anamnesis!.interacoes_cruzadas as InteracaoCruzada[]) : []; }
    catch { return []; }
  }, [anamnesis]);

  const hasAna = anamnesis && Object.keys(anamnesis).length > 0;

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado', `${label} copiado para a área de transferência.`);
  }, []);

  const toggleEvidenceExpand = useCallback((idx: number) => {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const toggleMedExpand = useCallback((idx: number) => {
    setExpandedMeds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }, []);

  const filteredEvidence = useMemo(() =>
    evidence.filter(e => e.title?.trim()),
    [evidence]
  );

  const buildFullSummary = useCallback(() => {
    const parts: string[] = [];
    if (gravidade && GRAVITY_CONFIG[gravidade]) parts.push(`GRAVIDADE: ${GRAVITY_CONFIG[gravidade].label}`);
    if (primaryHipotese) parts.push(`HIPÓTESE PRINCIPAL: ${primaryHipotese}${primaryCid ? ` (${primaryCid})` : ''}`);
    if (diagDiferencial.length > 0) {
      parts.push('\nDIAGNÓSTICO DIFERENCIAL:');
      diagDiferencial.forEach((dd, i) => parts.push(`${i + 1}. ${dd.hipotese} (${dd.cid}) — ${dd.probabilidade}`));
    }
    displayFields.forEach(({ key, label }) => {
      const v = anamnesis?.[key];
      if (!v || (typeof v === 'string' && !(v as string).trim())) return;
      const d = Array.isArray(v) ? (v as unknown[]).join(', ') : String(v);
      parts.push(`\n${label}: ${d}`);
    });
    if (meds.length > 0) {
      parts.push('\nMEDICAMENTOS:');
      meds.forEach((m, i) => {
        const med = parseMed(m);
        const dosagem = [med.dose, med.via, med.posologia, med.duracao].filter(Boolean).join(' \u2022 ');
        parts.push(`${i + 1}. ${med.nome}${dosagem ? ` — ${dosagem}` : ''}${med.indicacao ? ` | ${med.indicacao}` : ''}`);
      });
    }
    if (exames.length > 0) {
      parts.push('\nEXAMES:');
      exames.forEach((ex, i) => {
        const exam = parseExam(ex);
        parts.push(`${i + 1}. ${exam.nome}${exam.codigo_tuss ? ` (TUSS: ${exam.codigo_tuss})` : ''} — ${exam.urgencia ?? 'rotina'}`);
      });
    }
    if (orientacoesPaciente.length > 0) {
      parts.push('\nORIENTAÇÕES:');
      orientacoesPaciente.forEach(o => parts.push(`\u2022 ${o}`));
    }
    if (criteriosRetorno.length > 0) {
      parts.push('\nCRITÉRIOS DE RETORNO:');
      criteriosRetorno.forEach(c => parts.push(`\u26A0\uFE0F ${c}`));
    }
    return parts.join('\n');
  }, [gravidade, GRAVITY_CONFIG, primaryHipotese, primaryCid, diagDiferencial, anamnesis, displayFields, meds, exames, orientacoesPaciente, criteriosRetorno]);

  return (
    <View style={S.container}>
      {/* Tab bar */}
      <View style={S.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[S.tab, activeTab === tab.key && S.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Ionicons
              name={tab.icon as 'document-text' | 'help-circle' | 'library'}
              size={14}
              color={activeTab === tab.key ? colors.primary : colors.textMuted}
            />
            <Text style={[S.tabText, activeTab === tab.key && S.tabTextActive]}>
              {tab.label}
            </Text>
            {tab.key === 'perguntas' && perguntasSugeridas.length > 0 && (
              <View style={[S.tabBadge, { backgroundColor: colors.error }]}>
                <Text style={S.tabBadgeText}>{perguntasSugeridas.length}</Text>
              </View>
            )}
            {tab.key === 'evidencias' && filteredEvidence.length > 0 && (
              <View style={S.tabBadge}>
                <Text style={S.tabBadgeText}>{filteredEvidence.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>
        {/* Consulta tab */}
        {activeTab === 'consulta' && (
          <>
            {hasAna && (
              <TouchableOpacity
                style={S.copyAllTopBtn}
                onPress={() => copyToClipboard(buildFullSummary(), 'Resumo completo')}
                accessibilityRole="button"
                accessibilityLabel="Copiar resumo completo da consulta"
              >
                <Ionicons name="clipboard-outline" size={14} color={colors.primary} />
                <Text style={S.copyAllTopText}>Copiar Resumo Completo</Text>
              </TouchableOpacity>
            )}

            {suggestions.length > 0 && (
              <View style={[S.sec, { padding: 10, backgroundColor: colors.primarySoft, borderRadius: 10, borderWidth: 1, borderColor: colors.primary + '25' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Ionicons name="bulb" size={14} color={colors.primary} />
                  <Text style={[S.secT, { color: colors.primary }]}>RESUMO DA IA</Text>
                </View>
                {suggestions.map((s, i) => {
                  const text = typeof s === 'string' ? s : String((s as { text?: string; suggestion?: string })?.text ?? (s as { text?: string; suggestion?: string })?.suggestion ?? '');
                  if (!text) return null;
                  return (
                    <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
                      <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>•</Text>
                      <Text style={{ fontSize: 12, color: colors.text, flex: 1 }}>{text}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <AIIndicators
              gravidade={gravidade}
              denominadorComum={denominadorComum}
              primaryCid={primaryCid}
              primaryHipotese={primaryHipotese}
              alertasVermelhos={alertasVermelhos}
              diagDiferencial={diagDiferencial}
              gravityConfig={GRAVITY_CONFIG}
              colors={colors}
              copyToClipboard={copyToClipboard}
            />

            {/* Red alerts */}
            {alertasVermelhos.length > 0 && (
              <View style={S.alertBlock}>
                <View style={S.secH}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={[S.secT, { color: colors.error }]}>ALERTAS</Text>
                </View>
                {alertasVermelhos.map((a, i) => (
                  <Text key={i} style={S.alertText}>⚠️ {a}</Text>
                ))}
              </View>
            )}

            {/* Differential diagnosis / Psychology hypotheses */}
            {diagDiferencial.length > 0 && (
              <View style={S.sec}>
                <View style={S.secH}>
                  <Ionicons name={isPsy ? 'bulb' : 'git-branch'} size={14} color={colors.primary} />
                  <Text style={[S.secT, { color: colors.primary }]}>{isPsy ? 'HIPÓTESES CLÍNICAS' : 'DIAGNÓSTICO DIFERENCIAL'}</Text>
                </View>
                {diagDiferencial.map((dd, i) => {
                  const probColor = dd.probabilidade === 'alta' ? colors.success
                    : dd.probabilidade === 'media' ? colors.warning : colors.textMuted;
                  return (
                    <View key={i} style={S.ddItem}>
                      <View style={S.ddHeader}>
                        <View style={[S.ddProbDot, { backgroundColor: probColor }]} />
                        <Text style={S.ddHipotese}>{dd.hipotese}</Text>
                      </View>
                      {dd.cid ? <Text style={S.ddCid}>{dd.cid}</Text> : null}
                      {dd.argumentos_a_favor ? (
                        <Text style={S.ddArg}>✓ {dd.argumentos_a_favor}</Text>
                      ) : null}
                      {dd.argumentos_contra ? (
                        <Text style={S.ddArgContra}>✗ {dd.argumentos_contra}</Text>
                      ) : null}
                      {dd.exames_confirmatorios ? (
                        <Text style={S.ddExames}>🔬 {dd.exames_confirmatorios}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Anamnesis / Psychology assessment fields */}
            {hasAna && (
              <View style={S.sec}>
                <View style={S.secH}>
                  <Ionicons name={isPsy ? 'heart' : 'document-text'} size={14} color={colors.primary} />
                  <Text style={S.secT}>{isPsy ? 'AVALIAÇÃO PSICOLÓGICA' : 'ANAMNESE'}</Text>
                  <View style={S.badge}><Ionicons name="sparkles" size={10} color={colors.primary} /><Text style={S.badgeTxt}>IA</Text></View>
                </View>
                {displayFields.map(({ key, label, icon }) => {
                  const v = anamnesis?.[key];
                  if (!v || (typeof v === 'string' && !(v as string).trim())) return null;
                  const d = Array.isArray(v) ? (v as unknown[]).join(', ') : String(v);
                  const isAlert = key === 'alergias';
                  return (
                    <View key={key} style={S.af}>
                      <View style={S.afL}>
                        <Ionicons name={icon as any} size={11} color={isAlert ? colors.error : colors.textMuted} />
                        <Text style={[S.afLT, isAlert && { color: colors.error }]}>{label}</Text>
                      </View>
                      <Text style={S.afV}>{d}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Physical exam guidance — medical only */}
            {!isPsy && exameFisicoDirigido.length > 0 && (
              <View style={S.examFisicoBlock}>
                <View style={S.secH}>
                  <Ionicons name="fitness" size={14} color={colors.accent} />
                  <Text style={[S.secT, { color: colors.accent }]}>EXAME FÍSICO DIRIGIDO</Text>
                </View>
                <Text style={S.examFisicoText}>{exameFisicoDirigido}</Text>
              </View>
            )}

            {/* Medications — medical only */}
            {!isPsy && meds.length > 0 && (
              <View style={S.sec}>
                <View style={S.secH}>
                  <Ionicons name="medkit" size={14} color={colors.primary} />
                  <Text style={[S.secT, { color: colors.primary }]}>MEDICAMENTOS ({meds.length})</Text>
                </View>
                {meds.map((m, i) => {
                  const med = parseMed(m);
                  const parts = [med.dose, med.via, med.posologia, med.duracao].filter(Boolean);
                  const linha = parts.length > 0 ? parts.join(' • ') : '';
                  const isExpanded = expandedMeds.has(i);
                  const hasDetails = med.classe_terapeutica || med.mecanismo_acao || med.contraindicacoes || med.interacoes || med.ajuste_renal || med.ajuste_hepatico || med.alerta_faixa_etaria || med.alternativa;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={S.medCard}
                      onPress={() => hasDetails ? toggleMedExpand(i) : null}
                      activeOpacity={hasDetails ? 0.7 : 1}
                      accessibilityRole={hasDetails ? 'button' : 'text'}
                      accessibilityLabel={`Medicamento ${i + 1}: ${med.nome}`}
                    >
                      <View style={S.medHeader}>
                        <View style={S.medNumCircle}>
                          <Text style={S.medNum}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={S.medNome}>{med.nome}</Text>
                          {linha ? <Text style={S.medDosagem}>{linha}</Text> : null}
                        </View>
                        {hasDetails && (
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                        )}
                      </View>
                      {med.indicacao ? <Text style={S.medIndicacao}>↳ {med.indicacao}</Text> : null}
                      {isExpanded && (
                        <View style={S.medDetails}>
                          {med.classe_terapeutica ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="flask-outline" size={11} color={colors.textSecondary} />
                              <Text style={S.medDetailText}>{med.classe_terapeutica}</Text>
                            </View>
                          ) : null}
                          {med.mecanismo_acao ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="cog-outline" size={11} color={colors.primary} />
                              <Text style={[S.medDetailText, { color: colors.primary }]}>Mecanismo: {med.mecanismo_acao}</Text>
                            </View>
                          ) : null}
                          {med.contraindicacoes ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="close-circle-outline" size={11} color={colors.error} />
                              <Text style={[S.medDetailText, { color: colors.error }]}>CI: {med.contraindicacoes}</Text>
                            </View>
                          ) : null}
                          {med.interacoes ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="swap-horizontal" size={11} color={colors.warning} />
                              <Text style={[S.medDetailText, { color: colors.warning }]}>Interações: {med.interacoes}</Text>
                            </View>
                          ) : null}
                          {med.ajuste_renal ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="water-outline" size={11} color={colors.accent} />
                              <Text style={[S.medDetailText, { color: colors.accent }]}>Ajuste renal: {med.ajuste_renal}</Text>
                            </View>
                          ) : null}
                          {med.ajuste_hepatico ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="nutrition-outline" size={11} color={colors.accent} />
                              <Text style={[S.medDetailText, { color: colors.accent }]}>Ajuste hepático: {med.ajuste_hepatico}</Text>
                            </View>
                          ) : null}
                          {med.alerta_faixa_etaria ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="person-outline" size={11} color={colors.warning} />
                              <Text style={[S.medDetailText, { color: colors.warning }]}>{med.alerta_faixa_etaria}</Text>
                            </View>
                          ) : null}
                          {med.alternativa ? (
                            <View style={S.medDetailRow}>
                              <Ionicons name="arrow-redo-outline" size={11} color={colors.primary} />
                              <Text style={[S.medDetailText, { color: colors.primary }]}>Alt: {med.alternativa}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                      <TouchableOpacity
                        style={S.medAction}
                        onPress={() => copyToClipboard(
                          `${med.nome}${linha ? '\n' + linha : ''}${med.indicacao ? '\nIndicação: ' + med.indicacao : ''}`,
                          'Medicamento'
                        )}
                        accessibilityRole="button"
                        accessibilityLabel={`Copiar ${med.nome} para receita`}
                      >
                        <Ionicons name="copy-outline" size={11} color={colors.primary} />
                        <Text style={S.medActionText}>Copiar p/ receita</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
                <Text style={S.disclaimer}>* Sugestões da IA — decisão final do médico</Text>
              </View>
            )}

            {/* Drug interactions — medical only */}
            {!isPsy && interacoesCruzadas.length > 0 && (
              <View style={S.sec}>
                <View style={S.secH}>
                  <Ionicons name="warning" size={14} color={colors.error} />
                  <Text style={[S.secT, { color: colors.error }]}>INTERAÇÕES MEDICAMENTOSAS ({interacoesCruzadas.length})</Text>
                </View>
                {interacoesCruzadas.map((ic, i) => {
                  const tipoColor = ic.tipo === 'grave' ? colors.error : ic.tipo === 'moderada' ? colors.warning : colors.warning;
                  const tipoBg = ic.tipo === 'grave' ? colors.errorLight : colors.warningLight;
                  const tipoLabel = ic.tipo === 'grave' ? 'GRAVE' : ic.tipo === 'moderada' ? 'MODERADA' : 'LEVE';
                  return (
                    <View key={i} style={[S.interacaoCard, { backgroundColor: tipoBg, borderColor: tipoColor + '30' }]}>
                      <View style={S.interacaoHeader}>
                        <Ionicons name="alert-circle" size={14} color={tipoColor} />
                        <View style={[S.interacaoTipoBadge, { backgroundColor: tipoColor + '15' }]}>
                          <Text style={[S.interacaoTipoText, { color: tipoColor }]}>{tipoLabel}</Text>
                        </View>
                      </View>
                      <Text style={S.interacaoMeds}>
                        {ic.medicamento_a} × {ic.medicamento_b}
                      </Text>
                      <Text style={[S.interacaoDesc, { color: tipoColor }]}>{ic.descricao}</Text>
                      {ic.conduta ? (
                        <View style={S.interacaoCondutaRow}>
                          <Ionicons name="arrow-forward-circle-outline" size={11} color={colors.primary} />
                          <Text style={S.interacaoConduta}>{ic.conduta}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Exams — medical only */}
            {!isPsy && exames.length > 0 && (
              <View style={S.sec}>
                <View style={S.secH}>
                  <Ionicons name="flask" size={14} color={colors.primary} />
                  <Text style={[S.secT, { color: colors.primary }]}>EXAMES ({exames.length})</Text>
                </View>
                {exames.map((ex, i) => {
                  const exam = parseExam(ex);
                  const isUrgent = exam.urgencia === 'urgente';
                  return (
                    <View key={i} style={[S.examCard, isUrgent && S.examUrgent]}>
                      <View style={S.examHeader}>
                        <View style={S.examNumCircle}>
                          <Text style={S.examNumText}>{i + 1}</Text>
                        </View>
                        <Text style={S.examNome}>{exam.nome}</Text>
                        {isUrgent && (
                          <View style={S.urgentBadge}>
                            <Text style={S.urgentText}>URGENTE</Text>
                          </View>
                        )}
                      </View>
                      {exam.codigo_tuss ? (
                        <Text style={S.examTuss}>TUSS: {exam.codigo_tuss}</Text>
                      ) : null}
                      {exam.o_que_afere ? (
                        <Text style={S.examDetail}>Avalia: {exam.o_que_afere}</Text>
                      ) : null}
                      {exam.indicacao ? (
                        <Text style={S.examIndicacao}>↳ {exam.indicacao}</Text>
                      ) : null}
                      {exam.interpretacao_esperada ? (
                        <View style={S.examInterpretacao}>
                          <Ionicons name="analytics-outline" size={11} color={colors.accent} />
                          <Text style={S.examInterpretacaoText}>Esperado: {exam.interpretacao_esperada}</Text>
                        </View>
                      ) : null}
                      {exam.preparo_paciente ? (
                        <Text style={S.examPreparo}>📋 Preparo: {exam.preparo_paciente}</Text>
                      ) : null}
                      {exam.prazo_resultado ? (
                        <Text style={S.examDetail}>⏱ Resultado: {exam.prazo_resultado}</Text>
                      ) : null}
                    </View>
                  );
                })}
                <Text style={S.disclaimer}>* Sugestões da IA — decisão final do médico</Text>
              </View>
            )}

            {/* Patient orientation + Return criteria */}
            {(orientacoesPaciente.length > 0 || criteriosRetorno.length > 0) && (
              <View style={S.sec}>
                {orientacoesPaciente.length > 0 && (
                  <>
                    <View style={S.secH}>
                      <Ionicons name="heart" size={14} color={colors.success} />
                      <Text style={[S.secT, { color: colors.success }]}>ORIENTAÇÕES AO PACIENTE</Text>
                    </View>
                    {orientacoesPaciente.map((o, i) => (
                      <Text key={i} style={S.orientText}>• {o}</Text>
                    ))}
                  </>
                )}
                {criteriosRetorno.length > 0 && (
                  <>
                    <View style={[S.secH, { marginTop: 12 }]}>
                      <Ionicons name="flag" size={14} color={colors.warning} />
                      <Text style={[S.secT, { color: colors.warning }]}>CRITÉRIOS DE RETORNO</Text>
                    </View>
                    {criteriosRetorno.map((c, i) => (
                      <Text key={i} style={S.criterioText}>⚠️ {c}</Text>
                    ))}
                  </>
                )}
                <TouchableOpacity
                  style={S.copyOrientBtn}
                  onPress={() => {
                    const text = [
                      ...orientacoesPaciente.map(o => `• ${o}`),
                      '',
                      'Sinais de alarme:',
                      ...criteriosRetorno.map(c => `⚠️ ${c}`),
                    ].join('\n');
                    copyToClipboard(text, 'Orientações');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Copiar orientações ao paciente"
                >
                  <Ionicons name="share-outline" size={12} color={colors.primary} />
                  <Text style={S.copyOrientText}>Copiar orientações</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Perguntas / Evidências tabs */}
        {(activeTab === 'perguntas' || activeTab === 'evidencias') && (
          <AIMetadataPanel
            activeTab={activeTab}
            perguntasSugeridas={perguntasSugeridas}
            lacunasAnamnese={lacunasAnamnese}
            filteredEvidence={filteredEvidence}
            expandedEvidence={expandedEvidence}
            toggleEvidenceExpand={toggleEvidenceExpand}
            colors={colors}
            copyToClipboard={copyToClipboard}
          />
        )}
      </ScrollView>

      {/* Footer */}
      <View style={S.footer}>
        <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} />
        <Text style={S.footerText}>IA como apoio — revisão médica obrigatória</Text>
      </View>
    </View>
  );
}

// ── Styles ──

type PanelColors = { primary: string; primaryLight: string; text: string; textMuted: string; textSecondary: string; white: string; error: string; errorLight: string; warning: string; warningLight: string; success: string; accent: string; accentSoft: string; border: string; surface: string; surfaceSecondary: string; primarySoft: string };

function makeStyles(colors: PanelColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },

    tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 8, backgroundColor: colors.surface },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
    tabTextActive: { color: colors.primary },
    tabBadge: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
    tabBadgeText: { fontSize: 9, fontWeight: '700', color: colors.white },

    content: { padding: 12, gap: 14 },

    // Copy All
    copyAllTopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary + '25' },
    copyAllTopText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

    // Gravity
    gravityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
    gravityText: { fontSize: 13, fontWeight: '700' },

    // CID card
    cidCard: { backgroundColor: colors.primarySoft, borderRadius: 10, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.primary + '20' },
    cidHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cidLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 0.5, flex: 1 },
    confidenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    confidenceDot: { width: 6, height: 6, borderRadius: 3 },
    confidenceText: { fontSize: 10, fontWeight: '600' },
    cidValue: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
    cidDescricao: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 2 },
    cidCopy: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
    cidCopyText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

    // Sections
    sec: { gap: 8 },
    secH: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    secT: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: colors.primarySoft },
    badgeTxt: { fontSize: 10, fontWeight: '700', color: colors.primary },

    // Anamnesis fields
    af: { gap: 2, paddingLeft: 4 },
    afL: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    afLT: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
    afV: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

    // Alerts
    alertBlock: { backgroundColor: colors.errorLight, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.error + '40' },
    alertText: { fontSize: 12, color: colors.error, lineHeight: 18 },

    // Differential diagnosis
    ddItem: { backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 10, gap: 4 },
    ddHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ddProbDot: { width: 8, height: 8, borderRadius: 4 },
    ddHipotese: { fontSize: 12, fontWeight: '700', color: colors.text, flex: 1 },
    ddCid: { fontSize: 11, color: colors.primary, fontWeight: '600', marginLeft: 14 },
    ddArg: { fontSize: 11, color: colors.success, marginLeft: 14, lineHeight: 16 },
    ddArgContra: { fontSize: 11, color: colors.warning, marginLeft: 14, lineHeight: 16 },
    ddExames: { fontSize: 11, color: colors.primary, marginLeft: 14, lineHeight: 16 },

    // Physical exam
    examFisicoBlock: { backgroundColor: colors.accentSoft, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.accent + '40' },
    examFisicoText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

    // Medications
    medCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.border },
    medHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    medNumCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' },
    medNum: { fontSize: 11, fontWeight: '700', color: colors.primary },
    medNome: { fontSize: 12, fontWeight: '700', color: colors.text, lineHeight: 18 },
    medDosagem: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    medIndicacao: { fontSize: 11, color: colors.textMuted, paddingLeft: 30, lineHeight: 16 },
    medDetails: { paddingLeft: 30, gap: 4, marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
    medDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    medDetailText: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 },
    medAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 30, marginTop: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.primarySoft, alignSelf: 'flex-start' },
    medActionText: { fontSize: 10, color: colors.primary, fontWeight: '600' },

    // Exams
    examCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: colors.border },
    examUrgent: { backgroundColor: colors.errorLight, borderColor: colors.error + '60' },
    examHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    examNumCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center' },
    examNumText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    examNome: { fontSize: 12, fontWeight: '700', color: colors.text, flex: 1, lineHeight: 18 },
    urgentBadge: { backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
    urgentText: { fontSize: 9, fontWeight: '700', color: colors.white },
    examTuss: { fontSize: 10, color: colors.primary, fontWeight: '600', marginLeft: 30, fontFamily: 'monospace' },
    examDetail: { fontSize: 11, color: colors.textSecondary, marginLeft: 30, lineHeight: 16 },
    examIndicacao: { fontSize: 11, color: colors.textMuted, marginLeft: 30, lineHeight: 16 },
    examPreparo: { fontSize: 11, color: colors.warning, marginLeft: 30, lineHeight: 16 },
    examInterpretacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginLeft: 30, marginTop: 2, backgroundColor: colors.accentSoft, borderRadius: 6, padding: 6 },
    examInterpretacaoText: { fontSize: 11, color: colors.accent, lineHeight: 16, flex: 1, fontStyle: 'italic' },

    // Drug interactions
    interacaoCard: { borderRadius: 10, padding: 12, gap: 6, borderWidth: 1 },
    interacaoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    interacaoTipoBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    interacaoTipoText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    interacaoMeds: { fontSize: 13, fontWeight: '700', color: colors.text },
    interacaoDesc: { fontSize: 12, lineHeight: 18 },
    interacaoCondutaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 },
    interacaoConduta: { fontSize: 11, color: colors.primary, lineHeight: 16, flex: 1, fontWeight: '600' },

    disclaimer: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic', marginTop: 4 },

    // Orientations
    orientText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, paddingLeft: 4 },
    criterioText: { fontSize: 12, color: colors.warning, lineHeight: 18, paddingLeft: 4 },
    copyOrientBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.primarySoft, alignSelf: 'flex-start' },
    copyOrientText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

    // Suggestions
    sugItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingLeft: 4 },
    sugDng: { backgroundColor: colors.errorLight, borderRadius: 6, padding: 6 },
    sugTxt: { fontSize: 12, color: colors.primary, lineHeight: 18, flex: 1 },

    // Perguntas
    perguntaIntro: { fontSize: 11, color: colors.textMuted, lineHeight: 16, fontStyle: 'italic', marginBottom: 4 },
    perguntaCard: { backgroundColor: colors.warningLight, borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.warning + '40' },
    perguntaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    perguntaNumCircle: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
    perguntaNum: { fontSize: 11, fontWeight: '700' },
    perguntaPrioBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    perguntaPrioDot: { width: 6, height: 6, borderRadius: 3 },
    perguntaPrioText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
    perguntaText: { fontSize: 13, color: colors.text, lineHeight: 20, fontWeight: '600', fontStyle: 'italic' },
    perguntaObj: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4 },
    perguntaObjText: { fontSize: 11, color: colors.primary, lineHeight: 16, flex: 1 },
    perguntaHip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4, backgroundColor: colors.surfaceSecondary, borderRadius: 6, padding: 6 },
    perguntaHipText: { fontSize: 11, color: colors.textSecondary, lineHeight: 16, flex: 1 },
    perguntaImpacto: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingLeft: 4, backgroundColor: colors.accentSoft, borderRadius: 6, padding: 6 },
    perguntaImpactoText: { fontSize: 11, color: colors.accent, lineHeight: 16, flex: 1 },
    perguntaCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.primarySoft },
    perguntaCopyText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
    perguntaDisclaimer: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingHorizontal: 4, marginTop: 4 },
    perguntaDisclaimerText: { fontSize: 10, color: colors.textMuted, lineHeight: 14, flex: 1 },

    // Lacunas
    lacunasBlock: { backgroundColor: colors.warningLight, borderRadius: 10, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.warning + '50' },
    lacunaItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 4 },
    lacunaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning, marginTop: 5 },
    lacunaText: { fontSize: 12, color: colors.warning, lineHeight: 18, flex: 1 },

    // Evidence
    evItem: { backgroundColor: colors.surfaceSecondary, borderRadius: 8, padding: 10, gap: 6, borderWidth: 1, borderColor: colors.border },
    evHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    evHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    evTitle: { fontSize: 12, fontWeight: '700', color: colors.text, lineHeight: 16, flex: 1 },
    evNivelBadge: { backgroundColor: colors.accent + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    evNivelText: { fontSize: 9, fontWeight: '700', color: colors.accent, letterSpacing: 0.3 },
    evConexao: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.accentSoft, borderRadius: 6, padding: 6 },
    evConexaoText: { fontSize: 11, color: colors.accent, lineHeight: 15, flex: 1, fontWeight: '600' },
    evRelevance: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.primarySoft, borderRadius: 6, padding: 6 },
    evRelevanceText: { fontSize: 11, color: colors.primary, lineHeight: 15, flex: 1 },
    evExcerpt: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 8, marginLeft: 4 },
    evExcerptText: { fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 15 },
    evFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    evSource: { fontSize: 10, color: colors.textMuted, flex: 1 },
    evProviderBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
    evProviderText: { fontSize: 9, fontWeight: '600', color: colors.white },
    evSourcesLegend: { marginBottom: 8, paddingHorizontal: 4 },
    evSourcesText: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic' },
    evPubMed: { backgroundColor: '#228B22' },
    evEuropePmc: { backgroundColor: '#3B82F6' },
    evSemantic: { backgroundColor: '#7C3AED' },
    evClinicalTrials: { backgroundColor: '#065F46' },
    evMotivo: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 4, marginTop: 2 },
    evMotivoText: { fontSize: 10, color: colors.textMuted, lineHeight: 14, flex: 1, fontStyle: 'italic' },

    // Empty
    emptyState: { alignItems: 'center', gap: 8, paddingVertical: 40 },
    emptyTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
    emptySub: { fontSize: 11, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },

    // Footer
    footer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: colors.border },
    footerText: { fontSize: 10, color: colors.textMuted },
  });
}

export default DoctorAIPanel;
