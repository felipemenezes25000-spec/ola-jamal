/**
 * ai-panel/AIIndicators.tsx — Gravity badge, CID card, red alerts,
 * differential diagnosis display for the consultation tab.
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiagDiferencial, PanelColors } from './types';
import { makeStyles } from './types';

interface AIIndicatorsProps {
  gravidade: string;
  cidSugerido: string;
  cidDescricao: string;
  confiancaCid: string;
  alertasVermelhos: string[];
  diagDiferencial: DiagDiferencial[];
  gravityConfig: Record<string, { color: string; label: string; icon: string }>;
  confidenceConfig: Record<string, { color: string; label: string }>;
  colors: PanelColors;
  copyToClipboard: (text: string, label: string) => void;
}

export function AIIndicators({
  gravidade,
  cidSugerido,
  cidDescricao,
  confiancaCid,
  alertasVermelhos,
  diagDiferencial,
  gravityConfig,
  confidenceConfig,
  colors,
  copyToClipboard,
}: AIIndicatorsProps) {
  const S = React.useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      {/* Gravity badge */}
      {gravidade && gravityConfig[gravidade] && (
        <View style={[S.gravityBadge, { backgroundColor: gravityConfig[gravidade].color + '12', borderColor: gravityConfig[gravidade].color + '40' }]}>
          <Ionicons name={gravityConfig[gravidade].icon as 'shield-checkmark' | 'alert-circle' | 'warning' | 'close-circle'} size={16} color={gravityConfig[gravidade].color} />
          <Text style={[S.gravityText, { color: gravityConfig[gravidade].color }]}>
            {gravityConfig[gravidade].label}
          </Text>
        </View>
      )}

      {/* CID card */}
      <View style={S.cidCard}>
        <View style={S.cidHeader}>
          <Ionicons name="medical" size={16} color={colors.primary} />
          <Text style={S.cidLabel}>HIPÓTESE DIAGNÓSTICA (CID)</Text>
          {confiancaCid && confidenceConfig[confiancaCid] && (
            <View style={[S.confidenceBadge, { backgroundColor: confidenceConfig[confiancaCid].color + '15' }]}>
              <View style={[S.confidenceDot, { backgroundColor: confidenceConfig[confiancaCid].color }]} />
              <Text style={[S.confidenceText, { color: confidenceConfig[confiancaCid].color }]}>
                {confidenceConfig[confiancaCid].label}
              </Text>
            </View>
          )}
        </View>
        {cidSugerido.length > 0 ? (
          <>
            <Text style={S.cidValue}>{cidSugerido}</Text>
            {cidDescricao ? <Text style={S.cidDescricao}>{cidDescricao}</Text> : null}
            <TouchableOpacity style={S.cidCopy} onPress={() => copyToClipboard(cidSugerido + (cidDescricao ? ` — ${cidDescricao}` : ''), 'CID')}>
              <Ionicons name="copy-outline" size={12} color={colors.primary} />
              <Text style={S.cidCopyText}>Copiar CID</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={S.cidPlaceholder}>Aguardando dados da transcrição para sugerir CID</Text>
        )}
      </View>

      {/* Red alerts */}
      {alertasVermelhos.length > 0 && (
        <View style={S.alertBlock}>
          <View style={S.secH}>
            <Ionicons name="alert-circle" size={14} color={colors.error} />
            <Text style={[S.secT, { color: colors.error }]}>ALERTAS</Text>
          </View>
          {alertasVermelhos.map((a, i) => (
            <Text key={i} style={S.alertText}>{'\u26A0\uFE0F'} {a}</Text>
          ))}
        </View>
      )}

      {/* Differential diagnosis */}
      {diagDiferencial.length > 0 && (
        <View style={S.sec}>
          <View style={S.secH}>
            <Ionicons name="git-branch" size={14} color={colors.primary} />
            <Text style={[S.secT, { color: colors.primary }]}>DIAGNÓSTICO DIFERENCIAL</Text>
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
                  <Text style={S.ddArg}>{'\u2713'} {dd.argumentos_a_favor}</Text>
                ) : null}
                {dd.argumentos_contra ? (
                  <Text style={S.ddArgContra}>{'\u2717'} {dd.argumentos_contra}</Text>
                ) : null}
                {dd.exames_confirmatorios ? (
                  <Text style={S.ddExames}>{'\uD83D\uDD2C'} {dd.exames_confirmatorios}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}
