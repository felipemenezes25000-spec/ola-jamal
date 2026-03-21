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
  denominadorComum?: string;
  primaryCid?: string;
  primaryHipotese?: string;
  alertasVermelhos: string[];
  diagDiferencial: DiagDiferencial[];
  gravityConfig: Record<string, { color: string; label: string; icon: string }>;
  colors: PanelColors;
  copyToClipboard: (text: string, label: string) => void;
}

export function AIIndicators({
  gravidade,
  denominadorComum,
  primaryCid = '',
  primaryHipotese = '',
  alertasVermelhos,
  diagDiferencial,
  gravityConfig,
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

      {/* Denominador comum (categoria ampla) */}
      {denominadorComum ? (
        <View style={[S.cidCard, { backgroundColor: colors.primarySoft + '60', borderColor: colors.primary + '30' }]}>
          <View style={S.cidHeader}>
            <Ionicons name="layers-outline" size={14} color={colors.primary} />
            <Text style={[S.cidLabel, { fontSize: 10 }]}>DENOMINADOR COMUM</Text>
          </View>
          <Text style={[S.cidValue, { fontSize: 13 }]}>{denominadorComum}</Text>
        </View>
      ) : null}

      {/* Primary hypothesis card */}
      {primaryCid ? (
        <View style={[S.cidCard, { backgroundColor: colors.primarySoft, borderColor: colors.primary + '40' }]}>
          <View style={S.cidHeader}>
            <Ionicons name="medical" size={14} color={colors.primary} />
            <Text style={S.cidLabel}>HIPÓTESE PRINCIPAL</Text>
          </View>
          <Text style={S.cidValue}>{primaryHipotese}{primaryCid ? ` (${primaryCid})` : ''}</Text>
          {diagDiferencial.length > 0 && diagDiferencial[0].probabilidade ? (
            <View style={[S.confidenceBadge, { backgroundColor: (diagDiferencial[0].probabilidade === 'alta' ? colors.success : diagDiferencial[0].probabilidade === 'media' ? colors.warning : colors.textMuted) + '15' }]}>
              <View style={[S.confidenceDot, { backgroundColor: diagDiferencial[0].probabilidade === 'alta' ? colors.success : diagDiferencial[0].probabilidade === 'media' ? colors.warning : colors.textMuted }]} />
              <Text style={[S.confidenceText, { color: diagDiferencial[0].probabilidade === 'alta' ? colors.success : diagDiferencial[0].probabilidade === 'media' ? colors.warning : colors.textMuted }]}>
                {diagDiferencial[0].probabilidade_percentual != null ? `${diagDiferencial[0].probabilidade_percentual}%` : diagDiferencial[0].probabilidade}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={S.cidCopy}
            onPress={() => copyToClipboard(`${primaryHipotese} (${primaryCid})`, 'Hipótese principal')}
          >
            <Ionicons name="copy-outline" size={11} color={colors.primary} />
            <Text style={S.cidCopyText}>Copiar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
            const probLabel = dd.probabilidade_percentual != null
              ? `${dd.probabilidade_percentual}%`
              : dd.probabilidade;
            return (
              <View key={i} style={S.ddItem}>
                <View style={S.ddHeader}>
                  <View style={[S.ddProbDot, { backgroundColor: probColor }]} />
                  <Text style={S.ddHipotese}>{dd.hipotese}</Text>
                  {probLabel ? (
                    <View style={S.badge}>
                      <Text style={S.badgeTxt}>{probLabel}</Text>
                    </View>
                  ) : null}
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
