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
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '../../lib/ui/useAppTheme';

import type {
  DoctorAIPanelProps,
  TabKey,
  MedSugerido,
  ExameSugerido,
  DiagDiferencial,
  PerguntaSugerida,
  InteracaoCruzada,
} from './ai-panel/types';
import {
  TABS,
  ANA_FIELDS,
  getGravityConfig,
  getConfidenceConfig,
  parseMed,
  parseExam,
  makeStyles,
} from './ai-panel/types';
import { AIIndicators } from './ai-panel/AIIndicators';
import { AISuggestionView } from './ai-panel/AISuggestionView';
import { AIMetadataPanel } from './ai-panel/AIMetadataPanel';

// Re-export types for consumers that import from this file
export type { DoctorAIPanelProps } from './ai-panel/types';

export function DoctorAIPanel({ anamnesis, suggestions, evidence }: DoctorAIPanelProps) {
  const { colors } = useAppTheme({ scheme: 'dark', role: 'doctor' });
  const S = useMemo(() => makeStyles(colors), [colors]);
  const GRAVITY_CONFIG = useMemo(() => getGravityConfig(colors), [colors]);
  const CONFIDENCE_CONFIG = useMemo(() => getConfidenceConfig(colors), [colors]);

  const [activeTab, setActiveTab] = useState<TabKey>('consulta');
  const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set());
  const [expandedMeds, setExpandedMeds] = useState<Set<number>>(new Set());

  // Parse derived data
  const cidSugerido = (anamnesis?.cid_sugerido as string) ?? '';
  const cidDescricao = (anamnesis?.cid_descricao as string) ?? '';
  const confiancaCid = (anamnesis?.confianca_cid as string) ?? '';
  const gravidade = (anamnesis?.classificacao_gravidade as string) ?? '';
  const diagDiferencial: DiagDiferencial[] = useMemo(() => {
    try { return Array.isArray(anamnesis?.diagnostico_diferencial) ? (anamnesis!.diagnostico_diferencial as DiagDiferencial[]) : []; }
    catch { return []; }
  }, [anamnesis]);
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
    if (cidSugerido) parts.push(`HIPÓTESE: ${cidSugerido}${cidDescricao ? ` — ${cidDescricao}` : ''}`);
    if (gravidade && GRAVITY_CONFIG[gravidade]) parts.push(`GRAVIDADE: ${GRAVITY_CONFIG[gravidade].label}`);
    if (diagDiferencial.length > 0) {
      parts.push('\nDIAGNÓSTICO DIFERENCIAL:');
      diagDiferencial.forEach((dd, i) => parts.push(`${i + 1}. ${dd.hipotese} (${dd.cid}) — ${dd.probabilidade}`));
    }
    ANA_FIELDS.forEach(({ key, label }) => {
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
  }, [cidSugerido, cidDescricao, gravidade, GRAVITY_CONFIG, diagDiferencial, anamnesis, meds, exames, orientacoesPaciente, criteriosRetorno]);

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
              name={tab.icon as 'document-text' | 'help-circle' | 'bulb' | 'library'}
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

            <AIIndicators
              gravidade={gravidade}
              cidSugerido={cidSugerido}
              cidDescricao={cidDescricao}
              confiancaCid={confiancaCid}
              alertasVermelhos={alertasVermelhos}
              diagDiferencial={diagDiferencial}
              gravityConfig={GRAVITY_CONFIG}
              confidenceConfig={CONFIDENCE_CONFIG}
              colors={colors}
              copyToClipboard={copyToClipboard}
            />

            <AISuggestionView
              anamnesis={anamnesis}
              hasAna={!!hasAna}
              meds={meds}
              exames={exames}
              interacoesCruzadas={interacoesCruzadas}
              expandedMeds={expandedMeds}
              toggleMedExpand={toggleMedExpand}
              lacunasAnamnese={lacunasAnamnese}
              exameFisicoDirigido={exameFisicoDirigido}
              orientacoesPaciente={orientacoesPaciente}
              criteriosRetorno={criteriosRetorno}
              colors={colors}
              copyToClipboard={copyToClipboard}
            />
          </>
        )}

        {/* Perguntas / Sugestões / Evidências tabs */}
        {(activeTab === 'perguntas' || activeTab === 'historico' || activeTab === 'evidencias') && (
          <AIMetadataPanel
            activeTab={activeTab}
            perguntasSugeridas={perguntasSugeridas}
            lacunasAnamnese={lacunasAnamnese}
            suggestions={suggestions}
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
        <Ionicons name="shield-checkmark-outline" size={12} color={colors.textMuted} />
        <Text style={S.footerText}>Copiloto clínico IA • Protocolos baseados em evidência • Decisão final exclusiva do médico</Text>
      </View>
    </View>
  );
}

export default DoctorAIPanel;
