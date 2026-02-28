import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, shadows, typography, doctorDS } from '../../../lib/themeDoctor';
import {
  getRequestById,
  signRequest,
  getPreviewPdf,
  updatePrescriptionContent,
  validatePrescription,
} from '../../../lib/api';
import { RequestResponseDto, PrescriptionKind } from '../../../types/database';
import { searchCid } from '../../../lib/cid-medications';
import { DoctorHeader } from '../../../components/ui/DoctorHeader';
import { DoctorCard } from '../../../components/ui/DoctorCard';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { SkeletonList, SkeletonLoader } from '../../../components/ui/SkeletonLoader';
import { showToast } from '../../../components/ui/Toast';
import { FormattedAiSummary } from '../../../components/FormattedAiSummary';

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: colors.successLight, text: colors.success },
  medium: { bg: colors.warningLight, text: '#D97706' },
  high: { bg: colors.errorLight, text: colors.destructive },
};
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

function parseAiMedications(aiExtractedJson: string | null): string[] {
  if (!aiExtractedJson) return [];
  try {
    const obj = JSON.parse(aiExtractedJson);
    const arr = obj?.medications;
    if (Array.isArray(arr)) {
      return arr.map((m: any) => String(m || '').trim()).filter(Boolean);
    }
  } catch { }
  return [];
}

/**
 * Converte Blob → base64 de forma compatível com Web e React Native.
 *
 * Em React Native, FileReader.readAsDataURL() não funciona de forma confiável
 * com Blobs retornados por fetch().blob(). A abordagem segura é:
 *   1. Converter o Blob para ArrayBuffer (funciona em todas as plataformas)
 *   2. Converter os bytes para base64 manualmente
 *
 * No Web, FileReader funciona, mas usamos arrayBuffer por consistência.
 *
 * React Native (Hermes): blob.arrayBuffer() does NOT exist.
 * Use FileReader which works on both web and native.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  // React Native (Hermes): blob.arrayBuffer() does NOT exist.
  // Use FileReader which works on both web and native.
  if (Platform.OS !== 'web') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // dataUrl = "data:application/pdf;base64,XXXX..."
        const base64 = dataUrl?.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });
  }

  // Web: arrayBuffer is available
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
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
function buildPdfEmbedHtml(): string {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3,user-scalable=yes"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#f8f9fa;overflow-x:hidden}
canvas{display:block;width:100%!important;height:auto!important;margin-bottom:2px;background:#fff}
#status{text-align:center;padding:32px;color:#64748b;font-family:sans-serif;font-size:14px}
#status.error{color:#dc2626}
</style>
</head><body>
<div id="status">Carregando PDF.js...</div>
<div id="pages"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"><\/script>
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
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  pdfReady = true;
  statusEl.textContent = 'Aguardando dados do PDF...';
  tryRender();
} else {
  // PDF.js pode não ter carregado ainda (CDN lento)
  var checkInterval = setInterval(function() {
    if (typeof pdfjsLib !== 'undefined') {
      clearInterval(checkInterval);
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [medications, setMedications] = useState<string[]>([]);
  const [prescriptionKind, setPrescriptionKind] = useState<PrescriptionKind>('simple');
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(new Set());
  const [cidQuery, setCidQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  const [signFormDoctorProfileBlocked, setSignFormDoctorProfileBlocked] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfBlobUrlRef = useRef<string | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  /** Ao abrir o formulário de assinatura, rola até o final para que o TextInput da senha fique visível. */
  useEffect(() => {
    if (showSignForm && scrollViewRef.current) {
      // Pequeno delay para o layout do form renderizar antes de rolar
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [showSignForm]);

  /** Ao abrir o formulário de assinatura, verifica se o perfil do médico está completo para evitar tentativa inútil. */
  useEffect(() => {
    if (!showSignForm || !requestId) return;
    let cancelled = false;
    validatePrescription(requestId)
      .then((v) => {
        if (cancelled) return;
        const needs = (v.missingFields ?? []).some(
          (f) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        setSignFormDoctorProfileBlocked(!v.valid && needs);
      })
      .catch(() => {
        if (!cancelled) setSignFormDoctorProfileBlocked(false);
      });
    return () => { cancelled = true; };
  }, [showSignForm, requestId]);

  const loadRequest = useCallback(async () => {
    if (!requestId) return;
    try {
      const data = await getRequestById(requestId);
      setRequest(data);
      const meds = data.medications?.filter(Boolean) ?? [];
      setMedications(meds.length > 0 ? meds : []);
      setNotes(data.notes ?? '');
      setPrescriptionKind((data.prescriptionKind as PrescriptionKind) || 'simple');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  const loadPdfPreview = useCallback(async () => {
    if (!requestId) return;
    setPdfLoading(true);
    try {
      const blob = await getPreviewPdf(requestId);
      if (!blob || blob.size === 0) {
        setPdfUri(null);
        showToast({ message: 'Preview não disponível. Verifique se há medicamentos na receita.', type: 'warning' });
        return;
      }
      if (__DEV__) console.info('[PDF_PREVIEW] Blob recebido:', { size: blob.size, type: blob.type });
      if (Platform.OS === 'web') {
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
          pdfBlobUrlRef.current = null;
        }
        const url = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = url;
        setPdfUri(url);
      } else {
        const base64 = await blobToBase64(blob);
        if (!base64 || base64.length < 100) {
          if (__DEV__) console.warn('[PDF_PREVIEW] base64 vazio ou muito pequeno:', base64?.length);
          setPdfUri(null);
          showToast({ message: 'Erro ao processar o PDF. Tente novamente.', type: 'error' });
          return;
        }
        if (__DEV__) console.info('[PDF_PREVIEW] base64 gerado com sucesso:', { length: base64.length });
        setPdfUri(`data:application/pdf;base64,${base64}`);
      }
    } catch (e: any) {
      setPdfUri(null);
      console.warn('Erro ao carregar preview PDF:', e?.message);
      showToast({ message: e?.message || 'Não foi possível carregar o preview da receita.', type: 'error' });
    } finally {
      setPdfLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    if (request?.requestType === 'prescription') {
      loadPdfPreview();
    }
    return () => {
      if (Platform.OS === 'web' && pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
    };
  }, [request?.id, request?.requestType, loadPdfPreview]);

  /**
   * Quando pdfUri muda (ex.: após Salvar ou Atualizar), re-envia o base64 à WebView.
   * Se a WebView já recebeu onLoad, o postMessage atualiza os dados.
   * Como fallback, usamos key={pdfUri} na WebView para forçar remount.
   */
  useEffect(() => {
    if (Platform.OS !== 'web' && pdfUri && webViewRef.current) {
      const base64 = pdfUri.replace(/^data:application\/pdf;base64,/, '');
      // Pequeno delay para garantir que a WebView está pronta
      const timer = setTimeout(() => {
        webViewRef.current?.postMessage(base64);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pdfUri]);

  const handleSave = async () => {
    const meds = medications.map((m) => m.trim()).filter(Boolean);
    if (meds.length === 0) {
      showToast({ message: 'Adicione ao menos um medicamento à receita.', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await updatePrescriptionContent(requestId, {
        medications: meds,
        notes: notes.trim() || undefined,
        prescriptionKind,
      });
      await loadRequest();
      await loadPdfPreview();
      showToast({ message: 'Alterações salvas. Preview atualizado.', type: 'success' });
    } catch (e: any) {
      showToast({ message: e?.message || 'Falha ao salvar.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!certPassword.trim()) {
      showToast({ message: 'Digite a senha do certificado.', type: 'warning' });
      return;
    }
    setSigning(true);
    try {
      await updatePrescriptionContent(requestId, {
        medications: medications.map((m) => m.trim()).filter(Boolean),
        notes: notes.trim() || undefined,
        prescriptionKind,
      });
      const validation = await validatePrescription(requestId);
      if (!validation.valid) {
        const needsPatientProfile = (validation.missingFields ?? []).some(
          (f) => f.includes('paciente.sexo') || f.includes('paciente.data_nascimento') || f.includes('paciente.endereço')
        );
        const needsDoctorProfile = (validation.missingFields ?? []).some(
          (f) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        const checklist = (validation.messages ?? []).join('\n• ');
        const action = needsPatientProfile
          ? 'O paciente precisa completar sexo, data de nascimento ou endereço no perfil.'
          : needsDoctorProfile
            ? 'Para assinar receita simples, é obrigatório preencher endereço e telefone profissional no seu perfil de médico.'
            : 'Corrija os campos indicados antes de assinar.';
        Alert.alert(
          'Receita incompleta',
          `${action}\n\n• ${checklist}`,
          needsDoctorProfile
            ? [
                { text: 'IR AO MEU PERFIL', onPress: () => router.push('/(doctor)/profile' as any) },
                { text: 'OK', style: 'cancel' },
              ]
            : [{ text: 'OK' }]
        );
        setSigning(false);
        return;
      }
      await signRequest(requestId, { pfxPassword: certPassword });
      setShowSignForm(false);
      setCertPassword('');
      showToast({ message: 'Documento assinado digitalmente!', type: 'success' });
      router.back();
    } catch (e: any) {
      if (e?.missingFields?.length || e?.messages?.length) {
        const checklist = (e.messages ?? [e.message]).join('\n• ');
        const needsDoctorProfile = (e.missingFields ?? []).some(
          (f: string) => f.includes('médico.endereço') || f.includes('médico.telefone')
        );
        Alert.alert(
          'Receita incompleta',
          needsDoctorProfile
            ? `Para assinar, preencha endereço e telefone profissional no seu perfil de médico.\n\n• ${checklist}`
            : `Verifique os campos obrigatórios:\n\n• ${checklist}`,
          needsDoctorProfile
            ? [
                { text: 'IR AO MEU PERFIL', onPress: () => router.push('/(doctor)/profile' as any) },
                { text: 'OK', style: 'cancel' },
              ]
            : [{ text: 'OK' }]
        );
      } else {
        showToast({ message: e?.message || 'Senha incorreta ou erro na assinatura.', type: 'error' });
      }
    } finally {
      setSigning(false);
    }
  };

  const suggestedFromAi = useMemo(() => {
    const fromAi = parseAiMedications(request?.aiExtractedJson ?? null);
    const accepted = new Set(medications);
    return fromAi.filter((m) => !accepted.has(m) && !rejectedSuggestions.has(m));
  }, [request?.aiExtractedJson, medications, rejectedSuggestions]);

  const cidResults = useMemo(() => searchCid(cidQuery), [cidQuery]);

  const acceptSuggestion = (med: string) => {
    setMedications((prev) => (prev.includes(med) ? prev : [...prev, med]));
  };
  const rejectSuggestion = (med: string) => {
    setRejectedSuggestions((prev) => new Set(prev).add(med));
  };
  const addFromCid = (med: string) => {
    setMedications((prev) => (prev.includes(med) ? prev : [...prev, med]));
  };
  const addCustom = () => setMedications((prev) => [...prev, '']);
  const removeMedication = (i: number) =>
    setMedications((prev) => prev.filter((_, idx) => idx !== i));
  const updateMedication = (i: number, value: string) =>
    setMedications((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });

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

  if (request.requestType !== 'prescription') {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <DoctorHeader title="Editor" onBack={() => router.back()} />
        <View style={st.center}>
          <Ionicons name="document-text-outline" size={56} color={colors.textMuted} />
          <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, fontFamily: typography.fontFamily.regular }}>
            Editor disponível apenas para receitas.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const pdfViewHeight = Math.max(320, Math.min(500, windowHeight - 220));

  const bottomBarPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 56) : Math.max(insets.bottom, 16);

  /** Botão "Assinar Digitalmente" só aparece após aprovação e pagamento (status paid). */
  const canSign = request?.status === 'paid' && request?.requestType !== 'consultation';

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <DoctorHeader
        title="Editar Receita"
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
            <Ionicons name="help-circle-outline" size={22} color="#fff" />
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

          {/* PDF Preview — logo abaixo dos dados para sempre aparecer na tela */}
          <DoctorCard style={[st.cardMargin, st.pdfCard]}>
            <View style={st.pdfHeader}>
              <Ionicons name="document-text" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={st.pdfTitle}>Preview da Receita</Text>
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
                    source={{ html: buildPdfEmbedHtml(), baseUrl: 'https://cdnjs.cloudflare.com' }}
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
                  Adicione medicamentos e salve para gerar o preview.
                </Text>
                <TouchableOpacity onPress={loadPdfPreview} style={st.retryBtn} activeOpacity={0.7}>
                  <Text style={st.retryBtnText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            )}
          </DoctorCard>

          {/* Prescription Kind */}
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

          {/* AI Analysis */}
          {request.aiSummaryForDoctor && (
            <DoctorCard style={[st.cardMargin, st.aiCard]}>
              <View style={st.aiHeader}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={st.aiTitle}>COPILOTO IA</Text>
                {request.aiRiskLevel && (
                  <View style={[st.riskBadge, { backgroundColor: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.bg || colors.muted }]}>
                    <Text style={[st.riskText, { color: RISK_COLORS[request.aiRiskLevel.toLowerCase()]?.text || colors.text }]}>
                      {RISK_LABELS_PT[request.aiRiskLevel.toLowerCase()] || request.aiRiskLevel}
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
                  <Text style={st.urgencyText}>Urgência: {URGENCY_LABELS_PT[request.aiUrgency.toLowerCase()] || request.aiUrgency}</Text>
                </View>
              )}
            </DoctorCard>
          )}

          {/* AI Suggestions */}
          {suggestedFromAi.length > 0 && (
            <DoctorCard style={st.cardMargin}>
              <Text style={st.sectionTitle}>SUGESTÕES DA IA</Text>
              <View style={st.aiDisclaimer}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={st.aiDisclaimerText}>Sugestões — decisão final do médico.</Text>
              </View>
              {suggestedFromAi.map((med, i) => (
                <View key={`sug-${i}`} style={st.suggestionRow}>
                  <Text style={st.suggestionText} numberOfLines={2}>{med}</Text>
                  <View style={st.plusMinusRow}>
                    <TouchableOpacity onPress={() => acceptSuggestion(med)} style={st.plusMinusBtn} hitSlop={8}>
                      <Ionicons name="add-circle" size={28} color={colors.success} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => rejectSuggestion(med)} style={st.plusMinusBtn} hitSlop={8}>
                      <Ionicons name="remove-circle" size={28} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </DoctorCard>
          )}

          {/* CID Search */}
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

          {/* Medications List */}
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

          {/* Sign Form */}
          {showSignForm && (
            <DoctorCard style={[st.cardMargin, st.signFormCard]}>
              {signFormDoctorProfileBlocked && (
                <View style={st.profileBlockedBanner}>
                  <Ionicons name="warning" size={18} color="#B45309" />
                  <Text style={st.profileBlockedBannerText}>
                    Complete endereço e telefone profissional no seu perfil para poder assinar.
                  </Text>
                  <TouchableOpacity
                    style={st.profileBlockedBannerBtn}
                    onPress={() => { setShowSignForm(false); setSignFormDoctorProfileBlocked(false); router.push('/(doctor)/profile' as any); }}
                    activeOpacity={0.8}
                  >
                    <Text style={st.profileBlockedBannerBtnText}>IR AO MEU PERFIL</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={st.signFormHeader}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={st.signFormTitle}>ASSINATURA DIGITAL</Text>
              </View>
              <Text style={st.signFormDesc}>
                Ao assinar, você confirma que revisou toda a receita. A assinatura digital é válida conforme ITI/ICP-Brasil.
              </Text>
              <Text style={st.signLabel}>Senha do certificado A1:</Text>
              <TextInput
                style={st.input}
                value={certPassword}
                onChangeText={setCertPassword}
                placeholder="Senha"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                returnKeyType="done"
                onSubmitEditing={handleSign}
                placeholderTextColor={colors.textMuted}
                onFocus={() => {
                  // No Android, garantir que o campo fica visível quando o teclado abre
                  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 400);
                }}
              />
              <View style={st.signBtns}>
                <TouchableOpacity
                  style={st.cancelSignBtn}
                  onPress={() => { setShowSignForm(false); setCertPassword(''); setSignFormDoctorProfileBlocked(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={st.cancelSignText}>Cancelar</Text>
                </TouchableOpacity>
                <PrimaryButton label="Assinar e enviar" onPress={handleSign} loading={signing} style={st.signConfirmBtn} />
              </View>
            </DoctorCard>
          )}
        </ScrollView>

        {/* Bottom Action Bar — botões em coluna para texto em uma linha. Assinar só após aprovado e pago. */}
        {!showSignForm && (
          <View style={[st.bottomBar, { paddingBottom: bottomBarPadding }]}>
            <PrimaryButton
              label="Salvar e atualizar"
              onPress={handleSave}
              loading={saving}
              style={st.bottomBarButton}
            />
            {canSign && (
              <PrimaryButton
                label="Assinar digitalmente"
                onPress={() => setShowSignForm(true)}
                style={st.bottomBarButton}
              />
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
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
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 18, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text, flex: 1, textAlign: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: doctorDS.screenPaddingHorizontal },

  helpBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  helpBtnText: { fontSize: 12, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: '#fff' },

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

  // PDF Preview
  pdfCard: { borderWidth: 1.5, borderColor: colors.primary + '30' },
  pdfHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pdfTitle: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.text },
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
  riskText: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700' },
  aiDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: 'rgba(0,119,182,0.06)', borderRadius: 6 },
  aiDisclaimerText: { fontSize: 11, fontFamily: typography.fontFamily.regular, color: colors.textMuted, fontStyle: 'italic' },
  aiSummary: { fontSize: 15, fontFamily: typography.fontFamily.regular, color: colors.text, lineHeight: 24, letterSpacing: 0.2 },
  urgencyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  urgencyText: { fontSize: 13, fontFamily: typography.fontFamily.regular, color: colors.textSecondary },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 11, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.8, marginBottom: spacing.sm, textTransform: 'uppercase' as any },
  hint: { fontSize: 12, fontFamily: typography.fontFamily.regular, color: colors.textMuted, marginBottom: spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontSize: 14, fontFamily: typography.fontFamily.semibold, fontWeight: '600', color: colors.primary },

  // Suggestions
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
    borderLeftColor: '#B45309',
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
    color: '#fff',
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
  btnText: { fontSize: 16, fontFamily: typography.fontFamily.bold, fontWeight: '700', color: '#fff' },
});
