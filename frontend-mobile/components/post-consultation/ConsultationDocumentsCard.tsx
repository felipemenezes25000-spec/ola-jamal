/**
 * ConsultationDocumentsCard — Mostra documentos da pós-consulta para o paciente.
 * Cards coloridos por tipo (receita=azul, exame=verde, atestado=âmbar)
 * com botões Baixar e Compartilhar para cada documento.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import {
  getConsultationDocuments,
  getDocumentDownloadUrlById,
  type ConsultationDocument,
} from '../../lib/api-requests';


interface Props {
  requestId: string;
  requestType: string;
}

export function ConsultationDocumentsCard({ requestId, requestType }: Props) {
  const { colors } = useAppTheme();
  const S = useMemo(() => makeStyles(colors), [colors]);

  const [docs, setDocs] = useState<ConsultationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (requestType !== 'consultation') { setLoading(false); return; }
    getConsultationDocuments(requestId)
      .then((result) => { if (Array.isArray(result)) setDocs(result); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [requestId, requestType]);

  const handleDownload = async (doc: ConsultationDocument) => {
    setDownloading(doc.id);
    try {
      const url = await getDocumentDownloadUrlById(doc.id);
      if (Sharing && FileSystem) {
        const fileName = `renoveja_${doc.documentType}_${doc.id.slice(0, 8)}.pdf`;
        const localUri = FileSystem.cacheDirectory + fileName;
        const download = await FileSystem.downloadAsync(url, localUri);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(download.uri, {
            mimeType: 'application/pdf',
            dialogTitle: doc.label,
          });
          return;
        }
      }
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Erro', 'Não foi possível baixar o documento.');
    } finally {
      setDownloading(null);
    }
  };

  const handleView = async (doc: ConsultationDocument) => {
    try {
      const url = await getDocumentDownloadUrlById(doc.id);
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o documento.');
    }
  };

  const handleDownloadAll = async () => {
    const signed = docs.filter(d => d.status === 'signed');
    for (const doc of signed) {
      await handleDownload(doc);
    }
  };

  if (loading) {
    return (
      <View style={S.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (docs.length === 0) return null;

  const signedCount = docs.filter(d => d.status === 'signed').length;

  return (
    <View style={S.container}>
      <View style={S.header}>
        <View style={S.headerIcon}>
          <Ionicons name="documents" size={16} color={colors.primary} />
        </View>
        <Text style={S.headerTitle}>Documentos da consulta</Text>
        <View style={S.badge}>
          <Text style={S.badgeText}>{docs.length}</Text>
        </View>
      </View>

      {docs.map((doc) => {
        const isSigned = doc.status === 'signed';
        const isDownloading = downloading === doc.id;
        const isDispensed = doc.dispensedCount > 0;

        // Calcular validade
        let validityLabel = '';
        if (doc.expiresAt) {
          const daysLeft = Math.ceil((new Date(doc.expiresAt).getTime() - Date.now()) / 86400000);
          if (daysLeft <= 0) validityLabel = 'Vencido';
          else if (daysLeft <= 30) validityLabel = `Vence em ${daysLeft}d`;
          else validityLabel = `Até ${new Date(doc.expiresAt).toLocaleDateString('pt-BR')}`;
        }

        return (
          <View key={doc.id} style={S.card}>
            <View style={[S.cardDot, { backgroundColor: doc.color }]} />
            <View style={S.cardBody}>
              <Text style={S.cardLabel}>{doc.label}</Text>
              <Text style={S.cardStatus}>
                {isSigned
                  ? isDispensed
                    ? `Dispensado (${doc.dispensedCount}x)`
                    : 'Assinado digitalmente'
                  : 'Aguardando assinatura'}
              </Text>
              {validityLabel !== '' && (
                <Text style={[S.cardValidity, validityLabel === 'Vencido' && { color: '#DC2626' }]}>
                  {validityLabel}
                </Text>
              )}
              {doc.accessCode && isSigned && (
                <Text style={S.cardCode}>Código: {doc.accessCode}</Text>
              )}
            </View>
            {isSigned && (
              <View style={S.cardActions}>
                <TouchableOpacity
                  style={S.actionBtn}
                  onPress={() => handleDownload(doc)}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator size={14} color={colors.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.actionBtn}
                  onPress={() => handleView(doc)}
                >
                  <Ionicons name="eye-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={S.wppActionBtn}
                  onPress={() => {/* TODO: implementar envio WhatsApp */}}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#22C55E" />
                </TouchableOpacity>
              </View>
            )}
            {!isSigned && (
              <View style={S.pendingBadge}>
                <Ionicons name="time-outline" size={14} color="#E88D1A" />
              </View>
            )}
          </View>
        );
      })}

      {signedCount > 1 && (
        <TouchableOpacity style={S.downloadAllBtn} onPress={handleDownloadAll}>
          <Ionicons name="download" size={16} color={colors.white} />
          <Text style={S.downloadAllText}>Baixar todos ({signedCount})</Text>
        </TouchableOpacity>
      )}

      {signedCount > 0 && (
        <TouchableOpacity
          style={S.wppAllBtn}
          onPress={() => {/* TODO: implementar envio WhatsApp em lote */}}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#22C55E" />
          <Text style={S.wppAllText}>Enviar por WhatsApp</Text>
        </TouchableOpacity>
      )}

      <View style={S.footer}>
        <Ionicons name="shield-checkmark-outline" size={12} color={colors.textMuted} />
        <Text style={S.footerText}>
          Documentos assinados digitalmente com certificado ICP-Brasil. QR Code verificável.
        </Text>
      </View>
    </View>
  );
}

function makeStyles(c: DesignColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: c.surfaceSecondary,
      borderRadius: 16, padding: 16, gap: 12,
    },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    headerIcon: {
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: c.primaryGhost,
      justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
      fontSize: 15, fontWeight: '700', color: c.text, flex: 1,
    },
    badge: {
      backgroundColor: c.primary, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    badgeText: {
      fontSize: 12, fontWeight: '700', color: c.white,
    },

    // Card
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border,
      minHeight: 62,
    },
    cardDot: {
      width: 10, height: 10, borderRadius: 5,
    },
    cardBody: { flex: 1 },
    cardLabel: {
      fontSize: 14, fontWeight: '600', color: c.text,
    },
    cardStatus: {
      fontSize: 12, color: c.textMuted, marginTop: 2,
    },
    cardValidity: {
      fontSize: 11, color: '#D97706', fontWeight: '500', marginTop: 2,
    },
    cardCode: {
      fontSize: 11, color: c.primary, fontWeight: '600', marginTop: 3,
      fontFamily: 'monospace',
    },
    cardActions: {
      flexDirection: 'row', gap: 6,
    },
    actionBtn: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: c.primaryGhost,
      justifyContent: 'center', alignItems: 'center',
    },
    pendingBadge: {
      width: 32, height: 32, borderRadius: 10,
      backgroundColor: '#FEF3C7',
      justifyContent: 'center', alignItems: 'center',
    },
    wppActionBtn: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: '#F0FDF4',
      justifyContent: 'center', alignItems: 'center',
    },

    // Download all
    downloadAllBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 48, borderRadius: 14,
      backgroundColor: c.primary,
    },
    downloadAllText: {
      fontSize: 14, fontWeight: '600', color: c.white,
    },
    wppAllBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, height: 48, borderRadius: 14,
      borderWidth: 1.5, borderColor: '#22C55E', backgroundColor: '#F7FDF9',
    },
    wppAllText: {
      fontSize: 14, fontWeight: '500', color: '#166534',
    },

    // Footer
    footer: {
      flexDirection: 'row', gap: 6, alignItems: 'flex-start',
      paddingTop: 4,
    },
    footerText: {
      fontSize: 11, color: c.textMuted, lineHeight: 16, flex: 1,
    },
  });
}
