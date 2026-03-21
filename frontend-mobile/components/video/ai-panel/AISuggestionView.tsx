/**
 * ai-panel/AISuggestionView.tsx — Anamnesis fields, lacunas, physical exam,
 * medications, drug interactions, exams, and patient orientations.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MedSugerido, ExameSugerido, InteracaoCruzada, PanelColors } from './types';
import { ANA_FIELDS, parseMed, parseExam, makeStyles } from './types';

interface AISuggestionViewProps {
  anamnesis: Record<string, unknown> | null;
  hasAna: boolean;
  meds: MedSugerido[];
  exames: ExameSugerido[];
  interacoesCruzadas: InteracaoCruzada[];
  expandedMeds: Set<number>;
  toggleMedExpand: (idx: number) => void;
  lacunasAnamnese: string[];
  exameFisicoDirigido: string;
  orientacoesPaciente: string[];
  criteriosRetorno: string[];
  colors: PanelColors;
  copyToClipboard: (text: string, label: string) => void;
}

export function AISuggestionView({
  anamnesis,
  hasAna,
  meds,
  exames,
  interacoesCruzadas,
  expandedMeds,
  toggleMedExpand,
  lacunasAnamnese,
  exameFisicoDirigido,
  orientacoesPaciente,
  criteriosRetorno,
  colors,
  copyToClipboard,
}: AISuggestionViewProps) {
  const S = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      {/* Anamnesis fields */}
      {hasAna && (
        <View style={S.sec}>
          <View style={S.secH}>
            <Ionicons name="document-text" size={14} color={colors.primary} />
            <Text style={S.secT}>ANAMNESE</Text>
            <View style={S.badge}><Ionicons name="sparkles" size={10} color={colors.primary} /><Text style={S.badgeTxt}>IA</Text></View>
          </View>
          {ANA_FIELDS.map(({ key, label, icon }) => {
            const v = anamnesis?.[key];
            const isEmpty = !v || (typeof v === 'string' && !(v as string).trim())
              || (Array.isArray(v) && (v as unknown[]).every((x) => !x || (typeof x === 'string' && !(x as string).trim())));
            const d = isEmpty
              ? null
              : Array.isArray(v)
                ? (v as unknown[]).map((x) => (typeof x === 'string' ? x : String(x))).filter(Boolean).join(', ')
                : String(v).trim();
            const displayText = d && d.length > 0 ? d : '— Aguardando transcrição';
            const isPlaceholder = !d || d.length === 0;
            const isAlert = key === 'alergias';
            return (
              <View key={key} style={S.af}>
                <View style={S.afL}>
                  <Ionicons name={icon as any} size={11} color={isAlert ? colors.error : colors.textMuted} />
                  <Text style={[S.afLT, isAlert && { color: colors.error }]}>{label}</Text>
                </View>
                <Text style={[S.afV, isPlaceholder && { color: colors.textMuted, fontStyle: 'italic' }]}>{displayText}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Lacunas */}
      {lacunasAnamnese.length > 0 && (
        <View style={S.sec}>
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

      {/* Physical exam guidance */}
      {exameFisicoDirigido.length > 0 && (
        <View style={S.examFisicoBlock}>
          <View style={S.secH}>
            <Ionicons name="fitness" size={14} color={colors.accent} />
            <Text style={[S.secT, { color: colors.accent }]}>EXAME FÍSICO DIRIGIDO</Text>
          </View>
          <Text style={S.examFisicoText}>{exameFisicoDirigido}</Text>
        </View>
      )}

      {/* Medications */}
      {meds.length > 0 && (
        <View style={S.sec}>
          <View style={S.secH}>
            <Ionicons name="medkit" size={14} color={colors.primary} />
            <Text style={[S.secT, { color: colors.primary }]}>MEDICAMENTOS ({meds.length})</Text>
          </View>
          {meds.map((m, i) => {
            const med = parseMed(m);
            const parts = [med.dose, med.via, med.posologia, med.duracao].filter(Boolean);
            const linha = parts.length > 0 ? parts.join(' \u2022 ') : '';
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
                {med.indicacao ? <Text style={S.medIndicacao}>{'\u21B3'} {med.indicacao}</Text> : null}
                {med.melhora_esperada ? <Text style={[S.medIndicacao, { color: colors.success, fontWeight: '600' }]}>{'\u2728'} {med.melhora_esperada}</Text> : null}
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
          <Text style={S.disclaimer}>Sugestões baseadas em protocolos clínicos • Interações verificadas • Decisão final do médico prescritor</Text>
        </View>
      )}

      {/* Drug interactions */}
      {interacoesCruzadas.length > 0 && (
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
                  {ic.medicamento_a} {'\u00D7'} {ic.medicamento_b}
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

      {/* Exams */}
      {exames.length > 0 && (
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
                {exam.codigo_tuss ? <Text style={S.examTuss}>TUSS: {exam.codigo_tuss}</Text> : null}
                {exam.o_que_afere ? <Text style={S.examDetail}>Avalia: {exam.o_que_afere}</Text> : null}
                {exam.indicacao ? <Text style={S.examIndicacao}>{'\u21B3'} {exam.indicacao}</Text> : null}
                {exam.interpretacao_esperada ? (
                  <View style={S.examInterpretacao}>
                    <Ionicons name="analytics-outline" size={11} color={colors.accent} />
                    <Text style={S.examInterpretacaoText}>Esperado: {exam.interpretacao_esperada}</Text>
                  </View>
                ) : null}
                {exam.preparo_paciente ? <Text style={S.examPreparo}>{'\uD83D\uDCCB'} Preparo: {exam.preparo_paciente}</Text> : null}
                {exam.prazo_resultado ? <Text style={S.examDetail}>{'\u23F1'} Resultado: {exam.prazo_resultado}</Text> : null}
              </View>
            );
          })}
          <Text style={S.disclaimer}>Exames priorizados por diagnóstico diferencial • Código TUSS quando disponível • Decisão final do médico</Text>
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
                <Text key={i} style={S.orientText}>{'\u2022'} {o}</Text>
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
                <Text key={i} style={S.criterioText}>{'\u26A0\uFE0F'} {c}</Text>
              ))}
            </>
          )}
          <TouchableOpacity
            style={S.copyOrientBtn}
            onPress={() => {
              const text = [
                ...orientacoesPaciente.map(o => `\u2022 ${o}`),
                '',
                'Sinais de alarme:',
                ...criteriosRetorno.map(c => `\u26A0\uFE0F ${c}`),
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
  );
}
