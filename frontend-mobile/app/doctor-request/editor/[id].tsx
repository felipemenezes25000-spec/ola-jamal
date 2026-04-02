import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { nav } from '../../../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius, shadows, typography, doctorDS } from '../../../lib/themeDoctor';
import { useAppTheme } from '../../../lib/ui/useAppTheme';
import type { DesignColors } from '../../../lib/designSystem';
import { parseAiSuggestedExams } from '../../../lib/api';
import { useRequestEditor } from '../../../hooks/useRequestEditor';
import { PrescriptionKind } from '../../../types/database';
import { DoctorHeader } from '../../../components/ui/DoctorHeader';
import { DoctorCard } from '../../../components/ui/DoctorCard';
import { AppButton } from '../../../components/ui/AppButton';
import { SkeletonList, SkeletonLoader } from '../../../components/ui/SkeletonLoader';
import { AppEmptyState } from '../../../components/ui';
import { showToast } from '../../../components/ui/Toast';
import { FormattedAiSummary } from '../../../components/FormattedAiSummary';
import { ConductSection } from '../../../components/triage';
import { SignFormCard } from '../../../components/doctor-request/editor/SignFormCard';
import { ComplianceCard } from '../../../components/doctor-request/editor/ComplianceCard';

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;

const RISK_LABELS_PT: Record<string, string> = {
  low: 'Risco baixo',
  medium: 'Risco médio',
  high: 'Risco alto',
};
const URGENCY_LABELS_PT: Record<string, string> = {
  routine: 'Rotina',
  urgent: 'Urgente',
  emergency: 'Emergência',
};

function getRiskLabelPt(level: string | null | undefined): string {
  if (!level) return 'Risco não classificado';
  return RISK_LABELS_PT[level.toLowerCase()] ?? 'Risco não classificado';
}

function getUrgencyLabelPt(level: string | null | undefined): string {
  if (!level) return 'Não informado';
  return URGENCY_LABELS_PT[level.toLowerCase()] ?? 'Não informado';
}

/**
 * Gera HTML com PDF.js para WebView no Android.
 *
 * IMPORTANTE: NÃO injeta o base64 como string literal no JS.
 * String literals muito grandes (>128KB) são silenciosamente truncadas
 * pelo parser JS do Android WebView, causando tela branca sem erro.
 *
 * Em vez disso, passamos o base64 via postMessage após o carregamento do PDF.js.
 * O HTML fica leve e o base64 é enviado pelo canal de mensagem da WebView.
 */
function buildPdfEmbedHtml(colors: DesignColors): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3,user-scalable=yes"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:${colors.background};overflow-x:hidden}
canvas{display:block;width:100%!important;height:auto!important;margin-bottom:2px;background:${colors.white}}
#status{text-align:center;padding:32px;color:${colors.textMuted};font-family:sans-serif;font-size:14px}
#status.error{color:${colors.error}}
</style>
</head><body>
<div id="status">Carregando PDF.js...</div>
<div id="pages"></div>
<script src="${PDFJS_CDN_BASE}/pdf.min.js"><\/script>
<script>
var statusEl = document.getElementById('status');
var pagesEl = document.getElementById('pages');
var pdfReady = false;
var dataReady = false;
var pdfBase64 = null;

function showError(msg) {
  statusEl.className = 'error';
  statusEl.textContent = msg;
  statusEl.style.display = 'block';
}

function tryRender() {
  if (!pdfReady || !dataReady || !pdfBase64) return;
  statusEl.textContent = 'Renderizando...';
  try {
    var bin = atob(pdfBase64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    pdfjsLib.getDocument({data: bytes}).promise.then(function(pdf) {
      statusEl.style.display = 'none';
      var scale = 2;
      function rp(n) {
        return pdf.getPage(n).then(function(p) {
          var vp = p.getViewport({scale: scale});
          var c = document.createElement('canvas');
          c.width = vp.width;
          c.height = vp.height;
          pagesEl.appendChild(c);
          return p.render({canvasContext: c.getContext('2d'), viewport: vp}).promise;
        });
      }
      var chain = Promise.resolve();
      for (var n = 1; n <= pdf.numPages; n++) {
        chain = chain.then(rp.bind(null, n));
      }
      chain.catch(function(e) { showError('Erro ao renderizar: ' + e.message); });
    }).catch(function(e) {
      showError('Erro ao abrir PDF: ' + e.message);
    });
  } catch(e) {
    showError('Erro ao decodificar: ' + e.message);
  }
}

// Verifica se PDF.js carregou
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_CDN_BASE}/pdf.worker.min.js';
  pdfReady = true;
  statusEl.textContent = 'Aguardando dados do PDF...';
  tryRender();
} else {
  // PDF.js pode não ter carregado ainda (CDN lento)
  var checkInterval = setInterval(function() {
    if (typeof pdfjsLib !== 'undefined') {
      clearInterval(checkInterval);
      pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_CDN_BASE}/pdf.worker.min.js';
      pdfReady = true;
      tryRender();
    }
  }, 200);
  // Timeout de 15s para o CDN
  setTimeout(function() {
    clearInterval(checkInterval);
    if (!pdfReady) showError('Não foi possível carregar PDF.js. Verifique a conexão e toque em Atualizar.');
  }, 15000);
}

// Recebe base64 do React Native via postMessage
document.addEventListener('message', function(e) {
  pdfBase64 = e.data;
  dataReady = true;
  tryRender();
});
window.addEventListener('message', function(e) {
  pdfBase64 = e.data;
  dataReady = true;
  tryRender();
});
<\/script>
</body></html>`;
}

export default function PrescriptionEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = (Array.isArray(id) ? id[0] : id) ?? '';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { colors } = useAppTheme({ role: 'doctor' });
  const st = useMemo(() => makeStyles(colors), [colors]);
  const RISK_COLORS = useMemo<Record<string, { bg: string; text: string }>>(() => ({
    low: { bg: colors.successLight, text: colors.success },
    medium: { bg: colors.warningLight, text: colors.warning },
    high: { bg: colors.errorLight, text: colors.destructive },
  }), [colors]);
  const webViewRef = useRef<WebView | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const editor = useRequestEditor({ requestId, router });
  const {
    request,
    loading,
    loadError,
    medications,
    exams,
    setExams,
    prescriptionKind,
    setPrescriptionKind,
    editingSuggestionIndex,
    editingSuggestionValue,
    setEditingSuggestionValue,
    cidQuery,
    setCidQuery,
    notes,
    setNotes,
    conductNotes,
    setConductNotes,
    includeInPdf,
    setIncludeInPdf,
    saving,
    signing,
    certPassword,
    setCertPassword,
    showSignForm,
    setShowSignForm,
    signFormDoctorProfileBlocked,
    setSignFormDoctorProfileBlocked,
    pdfUri,
    pdfLoading,
    complianceValidation,
    loadPdfPreview,
    handleSave,
    handleSign,
    suggestedFromAi,
    cidResults,
    acceptSuggestion,
    acceptAllSuggestions,
    rejectSuggestion,
    startEditSuggestion,
    confirmEditSuggestion,
    cancelEditSuggestion,
    addFromCid,
    addCustom,
    removeMedication,
    updateMedication,
    retryLoad,
  } = editor;

  /** Ao abrir o formulário de assinatura, rola até o final para que o TextInput da senha fique visível. */
  useEffect(() => {
    if (showSignForm && scrollViewRef.current) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [showSignForm]);

  if (!loading && loadError && !request) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <DoctorHeader title="Editor" onBack={() => router.back()} />
        <AppEmptyState
          icon="alert-circle-outline"
          title="Erro ao carregar pedido"
          subtitle="Verifique sua conexão e tente novamente."
          actionLabel="Tentar novamente"
          onAction={retryLoad}
        />
      </SafeAreaView>
    );
  }

  if (loading || !request) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <DoctorHeader title="Carregando..." onBack={() => router.back()} />
        <View style={{ padding: spacing.md }}>
          <SkeletonLoader width="60%" height={20} style={{ marginBottom: 12 }} />
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (request.requestType !== 'prescription' && request.requestType !== 'exam') {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <DoctorHeader title="Editor" onBack={() => router.back()} />
        <View style={st.center}>
          <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, fontFamily: typography.fontFamily.regular }}>
            Editor disponível apenas para receitas e exames.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isExam = request.requestType === 'exam';

  const pdfViewHeight = Math.max(280, Math.round(windowHeight * 0.45));

  const bottomBarPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 56) : Math.max(insets.bottom, 16);

  /** Botão "Assinar Digitalmente" só aparece após aprovação (status paid/approved). */
  const canSign = request?.status === 'paid' || request?.status === 'approved';

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <DoctorHeader
        title={isExam ? 'Editar Pedido de Exame' : 'Editar Receita'}
        onBack={() => router.back()}
        right={
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Me ajuda',
                'Preview: salve a receita para gerar o PDF. Toque no preview para rolar e dar zoom (pinça).\n\nPaciente e médico: confira os dados no topo. Para assinar digitalmente, use o botão ao final da tela.',
                [{ text: 'OK' }]
              )
            }
            style={st.helpBtn}
            hitSlop={12}
          >
            <Ionicons name="help-circle-outline" size={22} color={colors.white} />
            <Text style={st.helpBtnText}>Me ajuda</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          ref={scrollViewRef}
          style={st.scroll}
          contentContainerStyle={[st.scrollContent, { paddingBottom: 160 + bottomBarPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {/* Paciente e Médico */}
          <DoctorCard style={st.cardMargin}>
            <Text style={st.sectionTitle}>DADOS DO ATENDIMENTO</Text>
            <View style={st.dataRow}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} />
              <Text style={st.dataLabel}>Paciente: </Text>
              <Text style={st.dataValue}>{request.patientName || '—'}</Text>
            </View>
            <View style={st.dataRow}>
              <Ionicons name="medkit-outline" size={18} color={colors.textMuted} />
              <Text style={st.dataLabel}>Médico: </Text>
              <Text style={st.dataValue}>{request.doctorName || '—'}</Text>
            </View>
          </DoctorCard>

          {/* Checklist de compliance — pendências visíveis durante edição */}
          <ComplianceCard validation={complianceValidation} colors={colors} />

          {/* PDF Preview — logo abaixo dos dados para sempre aparecer na tela */}
          <DoctorCard style={[st.cardMargin, st.pdfCard]}>
            <View style={st.pdfHeader}>
              <Ionicons name="document-text" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <View style={st.pdfTitleRow}>
                  <Text style={st.pdfTitle}>{isExam ? 'Preview do Pedido de Exame' : 'Preview da Receita'}</Text>
                  {complianceValidation && !complianceValidation.valid && (
                    <View style={st.draftBadge}>
                      <Text style={st.draftBadgeText}>Rascunho</Text>
                    </View>
                  )}
                </View>
                {prescriptionKind === 'antimicrobial' && (
                  <Text style={st.validityText}>Validade: 10 dias (RDC 471/2021)</Text>
                )}
              </View>
              <TouchableOpacity onPress={loadPdfPreview} disabled={pdfLoading} style={st.refreshBtn} activeOpacity={0.7}>
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <Text style={st.refreshBtnText}>Atualizar</Text>
              </TouchableOpacity>
            </View>
            {pdfLoading ? (
              <View style={[st.pdfPlaceholder, { minHeight: pdfViewHeight }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={st.pdfPlaceholderText}>Gerando preview...</Text>
              </View>
            ) : pdfUri ? (
              <View style={[st.pdfContainer, { height: pdfViewHeight }]}>
                {Platform.OS === 'web' ? (
                  <View style={st.iframeWrapper}>
                    {/* object/embed mais confiável que iframe para PDF em todos os navegadores */}
                    {/* @ts-ignore - object/embed são válidos no web */}
                    <object
                      data={pdfUri}
                      type="application/pdf"
                      style={{
                        width: '100%',
                        height: pdfViewHeight,
                        border: 'none',
                        borderRadius: 8,
                        backgroundColor: colors.background,
                      }}
                      title="Preview da receita"
                    >
                      <embed
                        src={pdfUri}
                        type="application/pdf"
                        style={{
                          width: '100%',
                          height: pdfViewHeight,
                          border: 'none',
                          borderRadius: 8,
                          backgroundColor: colors.background,
                        }}
                      />
                    </object>
                  </View>
                ) : (
                  <WebView
                    key={pdfUri}
                    ref={webViewRef}
                    source={{ html: buildPdfEmbedHtml(colors), baseUrl: 'https://cdnjs.cloudflare.com' }}
                    style={[st.webview, { height: pdfViewHeight }]}
                    scrollEnabled
                    nestedScrollEnabled
                    originWhitelist={['*']}
                    javaScriptEnabled
                    domStorageEnabled
                    thirdPartyCookiesEnabled
                    mixedContentMode="compatibility"
                    allowFileAccess
                    allowFileAccessFromFileURLs
                    allowUniversalAccessFromFileURLs
                    startInLoadingState
                    onLoad={() => {
                      // Envia o base64 via postMessage — evita inline gigante no HTML
                      if (pdfUri && webViewRef.current) {
                        const base64 = pdfUri.replace(/^data:application\/pdf;base64,/, '');
                        webViewRef.current.postMessage(base64);
                      }
                    }}
                    renderLoading={() => (
                      <View style={[st.pdfPlaceholder, { minHeight: pdfViewHeight, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={st.pdfPlaceholderText}>Renderizando PDF...</Text>
                      </View>
                    )}
                    onError={(e) => console.warn('WebView error:', e.nativeEvent)}
                    onHttpError={(e) => console.warn('WebView HTTP error:', e.nativeEvent)}
                  />
                )}
              </View>
            ) : (
              <View style={[st.pdfPlaceholder, { minHeight: 160 }]}>
                <Ionicons name="document-outline" size={40} color={colors.textMuted} />
                <Text style={st.pdfPlaceholderText}>
                  {isExam ? 'Salve os exames para gerar o preview.' : 'Adicione medicamentos e salve para gerar o preview.'}
                </Text>
                <TouchableOpacity onPress={loadPdfPreview} style={st.retryBtn} activeOpacity={0.7}>
                  <Text style={st.retryBtnText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            )}
          </DoctorCard>

          {/* Prescription Kind — apenas para receitas */}
          {!isExam && (
          <DoctorCard style={st.cardMargin}>
            <Text style={st.sectionTitle}>TIPO DE RECEITA</Text>
            <Text style={st.hint}>Selecione o modelo (CFM, RDC 471/2021, ANVISA/SNCR)</Text>
            <View style={st.kindRow}>
              {(['simple', 'antimicrobial', 'controlled_special'] as PrescriptionKind[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[st.kindOption, prescriptionKind === k && st.kindOptionActive]}
                  onPress={() => setPrescriptionKind(k)}
                  activeOpacity={0.7}
                >
                  <Text style={[st.kindOptionText, prescriptionKind === k && st.kindOptionTextActive]}>
                    {k === 'simple' ? 'Simples' : k === 'antimicrobial' ? 'Antimicrobiano' : 'Controle especial'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </DoctorCard>
          )}

          {/* AI Analysis */}
          {request.aiSummaryForDoctor && (
            <DoctorCard style={[st.cardMargin, st.aiCard]}>
              <View style={st.aiHeader}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={st.aiTitle}>COPILOTO IA</Text>
                {request.aiRiskLevel && (
                  <View style={[st.riskBadge, { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || colors.textMuted }]}>
                    <Text style={[st.riskText, { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text }]}>
                      {getRiskLabelPt(request.aiRiskLevel)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={st.aiDisclaimer}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={st.aiDisclaimerText}>Sugestões geradas por IA — decisão final do médico.</Text>
              </View>
              <FormattedAiSummary text={request.aiSummaryForDoctor} />
              {request.aiUrgency && (
                <View style={st.urgencyRow}>
                  <Ionicons name="time" size={16} color={colors.textSecondary} />
                  <Text style={st.urgencyText}>Urgência: {getUrgencyLabelPt(request.aiUrgency)}</Text>
                </View>
              )}
            </DoctorCard>
          )}

          {/* Rascunho IA (OCR) — sugestões extraídas da foto — apenas para receitas */}
          {!isExam && suggestedFromAi.length > 0 && (
            <DoctorCard style={st.cardMargin}>
              <View style={st.sectionHeader}>
                <Text style={st.sectionTitle}>RASCUNHO IA (OCR)</Text>
                <TouchableOpacity onPress={acceptAllSuggestions} style={st.acceptAllBtn} activeOpacity={0.7}>
                  <Ionicons name="checkmark-done" size={18} color={colors.success} />
                  <Text style={st.acceptAllBtnText}>Aceitar tudo</Text>
                </TouchableOpacity>
              </View>
              <View style={st.aiDisclaimer}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={st.aiDisclaimerText}>Dra. Renoveja leu a foto e sugeriu. Decisão final é sua.</Text>
              </View>
              {suggestedFromAi.map((med, i) => (
                <View key={`sug-${i}`} style={st.suggestionRow}>
                  {editingSuggestionIndex === i ? (
                    <>
                      <TextInput
                        style={[st.medInput, { flex: 1, marginRight: spacing.sm }]}
                        value={editingSuggestionValue}
                        onChangeText={setEditingSuggestionValue}
                        placeholder="Editar medicamento"
                        placeholderTextColor={colors.textMuted}
                        autoFocus
                      />
                      <TouchableOpacity onPress={confirmEditSuggestion} style={st.plusMinusBtn} hitSlop={8}>
                        <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={cancelEditSuggestion} style={st.plusMinusBtn} hitSlop={8}>
                        <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={st.suggestionText} numberOfLines={2}>{med}</Text>
                      <View style={st.plusMinusRow}>
                        <TouchableOpacity onPress={() => acceptSuggestion(med)} style={st.plusMinusBtn} hitSlop={8} accessibilityLabel="Aceitar item">
                          <Ionicons name="add-circle" size={28} color={colors.success} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => startEditSuggestion(med, i)} style={st.plusMinusBtn} hitSlop={8} accessibilityLabel="Editar item">
                          <Ionicons name="create-outline" size={26} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => rejectSuggestion(med)} style={st.plusMinusBtn} hitSlop={8} accessibilityLabel="Ignorar item">
                          <Ionicons name="remove-circle" size={28} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              ))}
            </DoctorCard>
          )}

          {/* CID Search — apenas para receitas */}
          {!isExam && (
          <DoctorCard style={st.cardMargin}>
            <Text style={st.sectionTitle}>BUSCAR POR CID</Text>
            <Text style={st.hint}>Digite o CID ou nome da condição para ver medicamentos sugeridos</Text>
            <TextInput
              style={st.input}
              value={cidQuery}
              onChangeText={setCidQuery}
              placeholder="Ex: J00, G43, gastrite..."
              placeholderTextColor={colors.textMuted}
            />
            {cidResults.length > 0 && (
              <View style={st.cidResults}>
                {cidResults.map((cid) => (
                  <View key={cid.cid} style={st.cidItem}>
                    <Text style={st.cidLabel}>{cid.cid} – {cid.description}</Text>
                    {cid.medications.map((med, j) => (
                      <View key={j} style={st.cidMedRow}>
                        <Text style={st.cidMedText} numberOfLines={1}>{med}</Text>
                        <TouchableOpacity onPress={() => addFromCid(med)} style={st.plusBtn} hitSlop={8}>
                          <Ionicons name="add-circle" size={24} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </DoctorCard>
          )}

          {/* Exams List — apenas para exames */}
          {isExam && (
          <DoctorCard style={st.cardMargin}>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>EXAMES SOLICITADOS</Text>
              <TouchableOpacity onPress={() => setExams((p) => [...p, ''])} style={st.addBtn} activeOpacity={0.7}>
                <Ionicons name="add-circle" size={22} color={colors.primary} />
                <Text style={st.addBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            <Text style={st.hint}>Liste os exames solicitados (um por linha)</Text>
            {exams.map((ex, i) => (
              <View key={i} style={st.medRow}>
                <TextInput
                  style={st.medInput}
                  value={ex}
                  onChangeText={(v) => setExams((p) => { const n = [...p]; n[i] = v; return n; })}
                  placeholder={`Exame ${i + 1}`}
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity onPress={() => setExams((p) => p.filter((_, idx) => idx !== i))} style={st.removeBtn} hitSlop={8}>
                  <Ionicons name="remove-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </DoctorCard>
          )}

          {/* Medications List — apenas para receitas */}
          {!isExam && (
          <DoctorCard style={st.cardMargin}>
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>MEDICAMENTOS NA RECEITA</Text>
              <TouchableOpacity onPress={addCustom} style={st.addBtn} activeOpacity={0.7}>
                <Ionicons name="add-circle" size={22} color={colors.primary} />
                <Text style={st.addBtnText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
            <Text style={st.hint}>
              Formato: Nome — posologia — quantidade (ex: Dipirona 500mg — 1cp 6/6h — 20 comprimidos)
            </Text>
            {medications.length === 0 ? (
              <Text style={st.emptyHint}>Nenhum medicamento. Use + nas sugestões, busque por CID ou adicione.</Text>
            ) : (
              medications.map((med, i) => (
                <View key={i} style={st.medRow}>
                  <TextInput
                    style={st.medInput}
                    value={med}
                    onChangeText={(v) => updateMedication(i, v)}
                    placeholder={`Medicamento ${i + 1}`}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity onPress={() => removeMedication(i)} style={st.removeBtn} hitSlop={8}>
                    <Ionicons name="remove-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </DoctorCard>
          )}

          {/* Notes */}
          <DoctorCard style={st.cardMargin}>
            <Text style={st.sectionTitle}>OBSERVAÇÕES GERAIS</Text>
            <TextInput
              style={st.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: Uso contínuo, evitar álcool, etc."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </DoctorCard>

          {/* Conduta médica (Dra. Renoveja) */}
          <DoctorCard style={st.cardMargin}>
            <ConductSection
              value={conductNotes}
              onChangeText={setConductNotes}
              aiSuggestion={request.aiConductSuggestion}
              suggestedExams={parseAiSuggestedExams(request.aiSuggestedExams)}
              includeInPdf={includeInPdf}
              onTogglePdf={setIncludeInPdf}
              autoObservation={request.autoObservation}
            />
          </DoctorCard>

          {/* Sign Form */}
          {showSignForm && (
            <SignFormCard
              certPassword={certPassword}
              onChangeCertPassword={setCertPassword}
              onSign={handleSign}
              onCancel={() => { setShowSignForm(false); setCertPassword(''); setSignFormDoctorProfileBlocked(false); }}
              signing={signing}
              profileBlocked={signFormDoctorProfileBlocked}
              onGoToProfile={() => { setShowSignForm(false); setSignFormDoctorProfileBlocked(false); nav.push(router, '/(doctor)/profile'); }}
              colors={colors}
              scrollRef={scrollViewRef}
            />
          )}
        </ScrollView>

        {/* Bottom Action Bar — botões em coluna para texto em uma linha. Assinar só após aprovado. */}
        {!showSignForm && (
          <View style={[st.bottomBar, { paddingBottom: bottomBarPadding }]}>
            <AppButton
              title="Salvar e atualizar"
              variant="doctorPrimary"
              onPress={handleSave}
              loading={saving}
              style={st.bottomBarButton}
            />
            {canSign && (
              complianceValidation && !complianceValidation.valid ? (
                <TouchableOpacity
                  style={[st.signDisabledBtn]}
                  onPress={() => {
                    const count = complianceValidation.messages?.length ?? 0;
                    showToast({
                      message: count > 0 ? `Faltam ${count} campo(s) obrigatório(s). Veja a lista acima.` : 'Complete os campos obrigatórios.',
                      type: 'warning',
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
                  <Text style={st.signDisabledBtnText}>
                    Assinar digitalmente (Faltam {complianceValidation.messages?.length ?? 0} campos)
                  </Text>
                </TouchableOpacity>
              ) : (
                <AppButton
                  title="Assinar digitalmente"
                  variant="doctorPrimary"
                  onPress={() => setShowSignForm(true)}
                  style={st.bottomBarButton}
                />
              )
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },

  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: doctorDS.screenPaddingHorizontal },

  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  helpBtnText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.white },

  dataRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  dataLabel: { fontSize: 13, fontFamily: typography.fontFamily.medium, color: colors.textMuted, fontWeight: '500' },
  dataValue: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, flex: 1 },

  cardMargin: { marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },

  // Compliance checklist
  complianceCard: { borderLeftWidth: 4, borderLeftColor: colors.warning, backgroundColor: colors.warningLight },
  complianceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  complianceTitle: { fontSize: 14, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text },
  complianceHint: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.sm },
  complianceItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 4 },
  complianceItemText: { flex: 1, fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.text },

  // PDF Preview
  pdfCard: { borderWidth: 1.5, borderColor: colors.primary + '30' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pdfTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  pdfTitle: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text },
  draftBadge: { backgroundColor: colors.textMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  draftBadgeText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.white },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.primarySoft, borderRadius: borderRadius.sm },
  refreshBtnText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  pdfContainer: { marginTop: spacing.sm, overflow: 'hidden', borderRadius: 8 },
  iframeWrapper: { width: '100%', flex: 1, overflow: 'hidden', borderRadius: 8 },
  webview: { width: '100%', height: 500 },
  pdfPlaceholder: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, borderRadius: 8 },
  pdfPlaceholderText: { fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  retryBtn: { marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.md, backgroundColor: colors.primarySoft, borderRadius: 8 },
  retryBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },
  validityText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, color: colors.success, marginTop: 2, fontWeight: '600' },

  // AI Card
  aiCard: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.accent },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs, flexWrap: 'wrap' },
  aiTitle: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1 },
  riskBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 },
  riskText: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(0,119,182,0.06)', borderRadius: 6 },
  aiDisclaimerText: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummary: { fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 24, letterSpacing: 0.2 },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  urgencyText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm, textTransform: 'uppercase' as any },
  hint: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },

  // Suggestions / OCR draft
  acceptAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.successLight, borderRadius: borderRadius.sm },
  acceptAllBtnText: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.success },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  suggestionText: { flex: 1, minWidth: 0, fontSize: 14, fontFamily: typography.fontFamily.regular, color: colors.text, marginRight: spacing.sm },
  plusMinusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plusMinusBtn: { padding: 4, flexShrink: 0 },

  // CID
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cidResults: { marginTop: spacing.xs },
  cidItem: { marginBottom: spacing.md },
  cidLabel: { fontSize: 13, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary, marginBottom: spacing.xs },
  cidMedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  cidMedText: { flex: 1, fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },
  plusBtn: { padding: 4 },

  // Medications
  emptyHint: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  medInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: { padding: 8 },

  // Notes
  notesInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: typography.fontFamily.regular,
    color: colors.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Kind selector
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kindOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  kindOptionText: { fontSize: 14, fontFamily: typography.fontFamily.medium, fontWeight: '500', color: colors.text },
  kindOptionTextActive: { color: colors.primary, fontWeight: '700', fontFamily: typography.fontFamily.bold },

  // Sign Form
  signFormCard: { borderWidth: 1.5, borderColor: colors.primary + '40' },
  profileBlockedBanner: {
    backgroundColor: colors.warningLight,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  profileBlockedBannerText: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  profileBlockedBannerBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  profileBlockedBannerBtnText: {
    fontSize: 12,
    fontFamily: typography.fontFamily.bold,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.4,
  },
  signFormHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  signFormTitle: { fontSize: 12, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  signFormDesc: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  signLabel: { fontSize: 14, fontFamily: typography.fontFamily.medium, color: colors.textSecondary, marginBottom: spacing.sm },
  signBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelSignBtn: { flex: 1, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelSignText: { fontFamily: typography.fontFamily.semibold, color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  signConfirmBtn: { flex: 1, flexDirection: 'row', backgroundColor: colors.primary, padding: spacing.md, borderRadius: borderRadius.card, alignItems: 'center', justifyContent: 'center', gap: 6, ...shadows.button },

  // Bottom Action Bar — botões em coluna, largura total, texto em uma linha
  bottomBar: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: doctorDS.screenPaddingHorizontal,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    ...shadows.sm,
  },
  bottomBarButton: {
    width: '100%',
    minHeight: 52,
  },
  signDisabledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signDisabledBtnText: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    fontWeight: '500',
    color: colors.textMuted,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.card,
    ...shadows.button,
  },
  saveBtn: { backgroundColor: colors.primary },
  signPrimaryBtn: { flex: 1 },
  bottomPrimaryBtn: { flex: 1 },
  bottomPrimaryBtnFull: { flex: 1, minWidth: 0 },
  btnText: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.white },
  });
}
