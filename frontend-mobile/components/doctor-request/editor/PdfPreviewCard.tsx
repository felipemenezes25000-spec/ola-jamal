import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type { DesignColors } from '../../../lib/designSystem';
import { DoctorCard } from '../../ui/DoctorCard';

interface PdfPreviewCardProps {
  pdfUri: string | null;
  pdfLoading: boolean;
  pdfViewHeight: number;
  colors: DesignColors;
  onRefresh: () => void;
  onWebViewRef?: (ref: WebView | null) => void;
  buildPdfHtml: () => string;
}

export const PdfPreviewCard = React.memo(function PdfPreviewCard({
  pdfUri, pdfLoading, pdfViewHeight, colors, onRefresh, onWebViewRef, buildPdfHtml,
}: PdfPreviewCardProps) {
  const webViewRef = useRef<WebView | null>(null);

  const handleRef = useCallback((ref: WebView | null) => {
    webViewRef.current = ref;
    onWebViewRef?.(ref);
  }, [onWebViewRef]);

  return (
    <DoctorCard style={styles.card} noPadding={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="document-outline" size={18} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Preview do Documento</Text>
          {!pdfUri && !pdfLoading && (
            <View style={[styles.draftBadge, { backgroundColor: colors.textMuted }]}>
              <Text style={[styles.draftBadgeText, { color: colors.white }]}>RASCUNHO</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.refreshBtn, { backgroundColor: colors.primarySoft }]}
          activeOpacity={0.7}
          disabled={pdfLoading}
        >
          {pdfLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={[styles.refreshText, { color: colors.primary }]}>Atualizar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* PDF Content */}
      {pdfLoading ? (
        <View style={[styles.placeholder, { height: 200, backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Gerando preview...</Text>
        </View>
      ) : pdfUri ? (
        <View style={[styles.pdfContainer, { height: pdfViewHeight }]}>
          {Platform.OS === 'web' ? (
            <iframe src={pdfUri} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 } as any} title="PDF Preview" />
          ) : (
            <View style={styles.webviewWrap}>
              <WebView
                ref={handleRef}
                source={{ html: buildPdfHtml() }}
                style={[styles.webview, { height: pdfViewHeight }]}
                onLoadEnd={() => {
                  if (pdfUri && webViewRef.current) {
                    const base64 = pdfUri.replace('data:application/pdf;base64,', '');
                    webViewRef.current.postMessage(base64);
                  }
                }}
                javaScriptEnabled
                domStorageEnabled
                scalesPageToFit={false}
                scrollEnabled
                nestedScrollEnabled
                originWhitelist={['*']}
              />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.placeholder, { height: 200, backgroundColor: colors.background }]}>
          <Ionicons name="document-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
            Salve o documento para gerar o preview
          </Text>
          <TouchableOpacity onPress={onRefresh} style={[styles.retryBtn, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Gerar agora</Text>
          </TouchableOpacity>
        </View>
      )}
    </DoctorCard>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: 1.5 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  draftBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  draftBadgeText: { fontSize: 12, fontWeight: '600' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  refreshText: { fontSize: 13, fontWeight: '600' },
  pdfContainer: { overflow: 'hidden', borderRadius: 8, marginTop: 4 },
  webviewWrap: { width: '100%', flex: 1, overflow: 'hidden', borderRadius: 8 },
  webview: { width: '100%' },
  placeholder: { justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  placeholderText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  retryText: { fontSize: 14, fontWeight: '600' },
});
