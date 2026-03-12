/**
 * ai-panel/AIMetadataPanel.tsx — Perguntas tab, Sugestões tab,
 * and Evidências tab rendering.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PerguntaSugerida, EvidenceItem, PanelColors } from './types';
import { makeStyles } from './types';

interface AIMetadataPanelProps {
  activeTab: 'perguntas' | 'evidencias';
  perguntasSugeridas: PerguntaSugerida[];
  lacunasAnamnese: string[];
  filteredEvidence: EvidenceItem[];
  expandedEvidence: Set<number>;
  toggleEvidenceExpand: (idx: number) => void;
  colors: PanelColors;
  copyToClipboard: (text: string, label: string) => void;
}

export function AIMetadataPanel({
  activeTab,
  perguntasSugeridas,
  lacunasAnamnese,
  filteredEvidence,
  expandedEvidence,
  toggleEvidenceExpand,
  colors,
  copyToClipboard,
}: AIMetadataPanelProps) {
  const S = React.useMemo(() => makeStyles(colors), [colors]);

  if (activeTab === 'perguntas') {
    return (
      <>
        {perguntasSugeridas.length > 0 ? (
          <View style={S.sec}>
            <View style={S.secH}>
              <Ionicons name="help-circle" size={14} color={colors.primary} />
              <Text style={[S.secT, { color: colors.primary }]}>PERGUNTE AO PACIENTE</Text>
              <View style={S.badge}><Ionicons name="sparkles" size={10} color={colors.primary} /><Text style={S.badgeTxt}>IA</Text></View>
            </View>
            <Text style={S.perguntaIntro}>
              Priorizadas por impacto clínico — a resposta de cada uma refina o diagnóstico
            </Text>
            {perguntasSugeridas.map((p, i) => {
              const prioColor = p.prioridade === 'alta' ? colors.primary
                : p.prioridade === 'media' ? colors.primaryLight : colors.textMuted;
              const prioLabel = p.prioridade === 'alta' ? 'CRÍTICA'
                : p.prioridade === 'media' ? 'IMPORTANTE' : 'COMPLEMENTAR';
              return (
                <View key={i} style={S.perguntaCard}>
                  <View style={S.perguntaHeader}>
                    <View style={[S.perguntaNumCircle, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[S.perguntaNum, { color: colors.primary }]}>{i + 1}</Text>
                    </View>
                    <View style={[S.perguntaPrioBadge, { backgroundColor: colors.primarySoft }]}>
                      <View style={[S.perguntaPrioDot, { backgroundColor: prioColor }]} />
                      <Text style={[S.perguntaPrioText, { color: prioColor }]}>{prioLabel}</Text>
                    </View>
                  </View>
                  <Text style={S.perguntaText}>"{p.pergunta}"</Text>
                  {p.objetivo ? (
                    <View style={S.perguntaObj}>
                      <Ionicons name="flag-outline" size={11} color={colors.primary} />
                      <Text style={S.perguntaObjText}>{p.objetivo}</Text>
                    </View>
                  ) : null}
                  {p.hipoteses_afetadas ? (
                    <View style={S.perguntaHip}>
                      <Ionicons name="git-branch-outline" size={11} color={colors.textSecondary} />
                      <Text style={S.perguntaHipText}>{p.hipoteses_afetadas}</Text>
                    </View>
                  ) : null}
                  {p.impacto_na_conduta ? (
                    <View style={S.perguntaImpacto}>
                      <Ionicons name="trending-up-outline" size={11} color={colors.primaryLight} />
                      <Text style={S.perguntaImpactoText}>{p.impacto_na_conduta}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={S.perguntaCopyBtn}
                    onPress={() => copyToClipboard(p.pergunta, 'Pergunta')}
                    accessibilityRole="button"
                    accessibilityLabel={`Copiar pergunta ${i + 1}`}
                  >
                    <Ionicons name="copy-outline" size={11} color={colors.primary} />
                    <Text style={S.perguntaCopyText}>Copiar</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={S.emptyState}>
            <Ionicons name="help-circle-outline" size={32} color={colors.warning} />
            <Text style={S.emptyTitle}>Perguntas sendo geradas...</Text>
            <Text style={S.emptySub}>
              Perguntas priorizadas por impacto clínico serão geradas assim que houver dados do transcript.
              Comece a conversa com o paciente para gerar perguntas sugeridas.
            </Text>
          </View>
        )}

        {lacunasAnamnese.length > 0 && (
          <View style={S.lacunasBlock}>
            <View style={S.secH}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.warning} />
              <Text style={[S.secT, { color: colors.warning }]}>INFORMAÇÕES FALTANDO</Text>
            </View>
            {lacunasAnamnese.map((l, i) => (
              <View key={i} style={S.lacunaItem}>
                <View style={S.lacunaDot} />
                <Text style={S.lacunaText}>{l}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={S.perguntaDisclaimer}>
          <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} />
          <Text style={S.perguntaDisclaimerText}>
            Sugestões baseadas nos dados disponíveis. O médico decide o que perguntar e quando.
          </Text>
        </View>
      </>
    );
  }

  // activeTab === 'evidencias'
  return (
    <View style={S.sec}>
      <View style={S.secH}>
        <Ionicons name="library" size={14} color={colors.primary} />
        <Text style={[S.secT, { color: colors.primary }]}>EVIDÊNCIAS CIENTÍFICAS</Text>
        <View style={S.badge}><Ionicons name="sparkles" size={10} color={colors.primary} /><Text style={S.badgeTxt}>IA</Text></View>
      </View>
      <Text style={S.evIntro}>
        Artigos de PubMed, Europe PMC e outras bases que apoiam hipótese diagnóstica e conduta para este caso.
      </Text>
      {filteredEvidence.length > 0 ? (
        filteredEvidence.map((e, i) => {
          const isExpanded = expandedEvidence.has(i);
          const nivelBadge = e.nivelEvidencia ? `Nível ${e.nivelEvidencia}` : '';
          return (
            <TouchableOpacity key={i} style={S.evItem} onPress={() => toggleEvidenceExpand(i)} activeOpacity={0.7}>
              <View style={S.evHeader}>
                <Text style={S.evTitle} numberOfLines={isExpanded ? undefined : 2}>{e.title}</Text>
                <View style={S.evHeaderRight}>
                  {nivelBadge ? (
                    <View style={S.evNivelBadge}>
                      <Text style={S.evNivelText}>{nivelBadge}</Text>
                    </View>
                  ) : null}
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </View>
              </View>
              {e.conexaoComPaciente ? (
                <View style={S.evConexao}>
                  <Ionicons name="person" size={11} color={colors.primary} />
                  <Text style={S.evConexaoText}>{e.conexaoComPaciente}</Text>
                </View>
              ) : null}
              {e.clinicalRelevance ? (
                <View style={S.evRelevance}>
                  <Ionicons name="medical" size={11} color={colors.primary} />
                  <Text style={S.evRelevanceText} numberOfLines={isExpanded ? undefined : 2}>{e.clinicalRelevance}</Text>
                </View>
              ) : (e.translatedAbstract ?? e.abstract) ? (
                <View style={S.evRelevance}>
                  <Ionicons name="document-text-outline" size={11} color={colors.textSecondary} />
                  <Text style={S.evAbstractPreview} numberOfLines={isExpanded ? undefined : 3}>
                    {e.translatedAbstract ?? e.abstract}
                  </Text>
                </View>
              ) : null}
              {isExpanded && e.relevantExcerpts?.map((excerpt, j) => (
                <View key={j} style={S.evExcerpt}>
                  <Text style={S.evExcerptText}>"{excerpt}"</Text>
                </View>
              ))}
              {isExpanded && e.motivoSelecao ? (
                <View style={S.evMotivo}>
                  <Ionicons name="checkmark-circle-outline" size={11} color={colors.textMuted} />
                  <Text style={S.evMotivoText}>{e.motivoSelecao}</Text>
                </View>
              ) : null}
              <View style={S.evFooter}>
                <Text style={S.evSource}>{e.source}</Text>
                <View style={[S.evProviderBadge,
                  e.provider === 'Europe PMC' ? S.evEuropePmc :
                  e.provider === 'Semantic Scholar' ? S.evSemantic :
                  e.provider === 'ClinicalTrials.gov' ? S.evClinicalTrials : S.evPubMed
                ]}>
                  <Text style={S.evProviderText}>{e.provider ?? 'PubMed'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={S.evEmptyCard}>
          <Ionicons name="library-outline" size={24} color={colors.primary} />
          <Text style={S.evEmptyTitle}>Evidências em breve</Text>
          <Text style={S.evEmptySub}>
            Artigos científicos serão buscados automaticamente quando houver hipótese diagnóstica (CID) e dados da consulta. A IA seleciona trechos relevantes e explica a conexão com o caso do paciente.
          </Text>
        </View>
      )}
    </View>
  );
}
