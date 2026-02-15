import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Modal, Pressable, Linking, Platform, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import { Card } from '../../components/Card';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ZoomableImage } from '../../components/ZoomableImage';
import { WebView } from 'react-native-webview';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { StatusBadge } from '../../components/StatusBadge';
import { Loading } from '../../components/Loading';
import { fetchRequestById, approveRequest, rejectRequest, signRequest, generatePdf, getPreviewPdf, assignToQueue, acceptConsultation, reanalyzeAsDoctor, updatePrescriptionContent, updateExamContent } from '../../lib/api';
import { RequestResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../../constants/theme';

const RECEITA_TEMPLATE = `MEDICAMENTOS IDENTIFICADOS:
• [Nome] - [dosagem, ex: 1cp 12/12h]
• [Outro medicamento] - [posologia]

MÉDICO ANTERIOR: [nome ou não identificado]
OBSERVAÇÕES: [observações ou nenhuma]`;

const EXAME_TEMPLATE = `EXAMES SOLICITADOS:
• [Exame 1]
• [Exame 2]

INDICAÇÃO CLÍNICA: [motivo/sintomas]
OBSERVAÇÕES: [outras informações]`;

export default function DoctorRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<RequestResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [pfxPassword, setPfxPassword] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [fullScreenImages, setFullScreenImages] = useState<string[]>([]);
  const [fullScreenIndex, setFullScreenIndex] = useState(0);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveMedications, setApproveMedications] = useState('');
  const [approveExams, setApproveExams] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [showTemplate, setShowTemplate] = useState<'receita' | 'exame' | null>(null);
  const [pdfPreviewUri, setPdfPreviewUri] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMedications, setEditMedications] = useState('');
  const [editExams, setEditExams] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => { load(); }, [id]);

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copiado!', 'Texto copiado para a área de transferência.');
  };

  const handlePreviewPdf = async () => {
    if (!request) return;
    setActionLoading('preview');
    try {
      const blob = await getPreviewPdf(request.id);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const base64 = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const data = (reader.result as string)?.split(',')[1] ?? null;
            resolve(data);
          };
          reader.readAsDataURL(blob);
        });
        if (!base64) throw new Error('Falha ao processar o PDF.');
        const dir = FileSystem.cacheDirectory?.replace(/\/$/, '') || FileSystem.documentDirectory?.replace(/\/$/, '') || '';
        const filePath = `${dir}/preview-receita-${request.id}.pdf`;
        await FileSystem.writeAsStringAsync(filePath, base64, { encoding: 'base64' });
        const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
        setPdfPreviewUri(uri);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível gerar o preview. Verifique os medicamentos e tente novamente.');
    } finally {
      setActionLoading('');
    }
  };
  const load = async () => { try { if (id) setRequest(await fetchRequestById(id)); } catch {} finally { setLoading(false); } };

  const openApproveModal = () => {
    if (request?.requestType === 'prescription') {
      const meds = request.medications?.join('\n') ?? request.aiSummaryForDoctor ?? '';
      setApproveMedications(meds);
      setApproveExams('');
    } else if (request?.requestType === 'exam') {
      const ex = request.exams?.join('\n') ?? request.aiSummaryForDoctor ?? '';
      setApproveExams(ex);
      setApproveMedications('');
    }
    setApproveNotes(request?.notes ?? '');
    setShowApproveModal(true);
  };

  const openEditModal = () => {
    if (request) {
      setEditMedications(request.medications?.join('\n') ?? '');
      setEditExams(request.exams?.join('\n') ?? '');
      setEditNotes(request?.notes ?? '');
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!request) return;
    setActionLoading('edit');
    try {
      if (request.requestType === 'prescription') {
        const meds = editMedications.split('\n').map((m) => m.trim()).filter(Boolean);
        await updatePrescriptionContent(request.id, { medications: meds, notes: editNotes.trim() || undefined });
        Alert.alert('Salvo', 'Medicamentos e notas atualizados. Pré-visualize novamente antes de assinar.');
      } else if (request.requestType === 'exam') {
        const exs = editExams.split('\n').map((e) => e.trim()).filter(Boolean);
        await updateExamContent(request.id, { exams: exs, notes: editNotes.trim() || undefined });
        Alert.alert('Salvo', 'Exames e notas atualizados. Pode assinar o documento.');
      }
      setShowEditModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleApprove = async () => {
    if (!request) return;
    setActionLoading('approve');
    try {
      const data: { medications?: string[]; exams?: string[]; notes?: string } = {};
      if (request.requestType === 'prescription' && approveMedications.trim()) {
        data.medications = approveMedications.split('\n').map((m) => m.trim()).filter(Boolean);
      }
      if (request.requestType === 'exam' && approveExams.trim()) {
        data.exams = approveExams.split('\n').map((e) => e.trim()).filter(Boolean);
      }
      if (approveNotes.trim()) data.notes = approveNotes.trim();
      await approveRequest(request.id, data);
      setShowApproveModal(false);
      Alert.alert('Aprovado', 'Solicitação aprovada com sucesso.');
      load();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!request || !rejectReason) { Alert.alert('Atenção', 'Informe o motivo'); return; }
    setActionLoading('reject');
    try {
      await rejectRequest(request.id, rejectReason);
      Alert.alert('Rejeitado', 'Solicitação rejeitada.');
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setActionLoading(''); setShowReject(false); }
  };

  const handleSignClick = () => {
    if (!request) return;
    if ((request.requestType === 'prescription' || request.requestType === 'exam') && request.status === 'paid') {
      setPfxPassword('');
      setShowSignModal(true);
    } else {
      handleSign('');
    }
  };

  const handleSign = async (password: string) => {
    if (!request) return;
    setActionLoading('sign');
    try {
      if (request.requestType === 'prescription') {
        try { await generatePdf(request.id); } catch {}
      }
      await signRequest(request.id, {
        pfxPassword: password || undefined,
        signatureData: undefined,
        signedDocumentUrl: undefined,
      });
      setShowSignModal(false);
      setPfxPassword('');
      Alert.alert('Assinado', 'Documento assinado digitalmente.');
      load();
    } catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setActionLoading(''); }
  };

  const handleAssign = async () => {
    if (!request) return;
    setActionLoading('assign');
    try { await assignToQueue(request.id); Alert.alert('Sucesso', 'Solicitação atribuída.'); load(); }
    catch (e: any) { Alert.alert('Erro', e.message); }
    finally { setActionLoading(''); }
  };

  if (loading) return <SafeAreaView style={styles.container}><Loading color={colors.primary} /></SafeAreaView>;
  if (!request) return <SafeAreaView style={styles.container}><Text style={styles.err}>Não encontrado</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.primaryDark} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Revisar Solicitação</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Patient info */}
        <Card style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}><Ionicons name="person" size={20} color={colors.white} /></View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{request.patientName || 'Paciente'}</Text>
              <Text style={styles.patientMeta}>{request.requestType === 'prescription' ? 'Receita' : request.requestType === 'exam' ? 'Exame' : 'Consulta'}{request.prescriptionType ? ` • ${request.prescriptionType}` : ''}</Text>
            </View>
            <StatusBadge status={request.status} size="sm" />
          </View>
        </Card>

        {/* AI Summary com botão Copiar */}
        {request.aiSummaryForDoctor && (
          <Card style={[styles.card, { backgroundColor: '#FFF7ED' }]}>
            <View style={[styles.aiRow, { justifyContent: 'space-between' }]}>
              <View style={styles.aiRow}>
                <Ionicons name="sparkles" size={18} color={colors.secondary} />
                <Text style={styles.aiTitle}>Resumo da IA</Text>
              </View>
              <TouchableOpacity onPress={() => copyToClipboard(request.aiSummaryForDoctor || '')} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
                <Text style={styles.copyBtnText}>Copiar</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.aiText}>{request.aiSummaryForDoctor}</Text>
            {request.aiRiskLevel && (
              <View style={styles.aiMeta}>
                <Text style={styles.aiMetaText}>Risco: {request.aiRiskLevel}</Text>
                <Text style={styles.aiMetaText}>Urgência: {request.aiUrgency || 'Normal'}</Text>
              </View>
            )}
          </Card>
        )}

        {/* Modelos de prontuário para copiar e colar */}
        {(request.requestType === 'prescription' || request.requestType === 'exam') && (
          <Card style={styles.card}>
            <TouchableOpacity onPress={() => setShowTemplate(showTemplate ? null : request.requestType === 'prescription' ? 'receita' : 'exame')} style={styles.templateHeader}>
              <Text style={styles.sectionLabel}>Modelo de prontuário</Text>
              <Ionicons name={showTemplate ? 'chevron-up' : 'chevron-down'} size={20} color={colors.gray500} />
            </TouchableOpacity>
            {showTemplate && (
              <View style={styles.templateBox}>
                <Text style={styles.templateText} selectable>
                  {request.requestType === 'prescription' ? RECEITA_TEMPLATE : EXAME_TEMPLATE}
                </Text>
                <Button
                  title="Copiar modelo"
                  variant="outline"
                  size="sm"
                  onPress={() => copyToClipboard(request.requestType === 'prescription' ? RECEITA_TEMPLATE : EXAME_TEMPLATE)}
                  icon={<Ionicons name="copy-outline" size={16} color={colors.primary} />}
                  style={{ marginTop: spacing.sm }}
                />
              </View>
            )}
          </Card>
        )}

        {/* Reanalisar IA - quando não há resumo ou quando falhou */}
        {request.doctorId && (request.requestType === 'prescription' || request.requestType === 'exam') &&
          ((request.requestType === 'prescription' && request.prescriptionImages?.length) || (request.requestType === 'exam' && (request.examImages?.length || request.exams?.length || request.symptoms))) && (
          <Button
            title={request.aiSummaryForDoctor ? 'Reanalisar com IA' : 'Analisar com IA'}
            variant="outline"
            size="sm"
            onPress={async () => {
              setActionLoading('reanalyze');
              try {
                await reanalyzeAsDoctor(request.id);
                load();
              } catch (e: any) { Alert.alert('Erro', e.message); }
              finally { setActionLoading(''); }
            }}
            loading={actionLoading === 'reanalyze'}
            icon={<Ionicons name="sparkles" size={18} color={colors.secondary} />}
            style={{ marginBottom: spacing.md }}
          />
        )}

        {/* Prescription images - toque para abrir em tela cheia */}
        {request.prescriptionImages && request.prescriptionImages.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Imagens da Receita (toque para ampliar)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {request.prescriptionImages.map((url, i) => (
                <TouchableOpacity key={i} onPress={() => { setFullScreenImages(request.prescriptionImages || []); setFullScreenIndex(i); setFullScreenImage(url); }} activeOpacity={0.9}>
                  <Image source={{ uri: url }} style={styles.previewImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Exam images - toque para abrir em tela cheia */}
        {request.examImages && request.examImages.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Imagens do Exame (toque para ampliar)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {request.examImages.map((url, i) => (
                <TouchableOpacity key={i} onPress={() => { setFullScreenImages(request.examImages || []); setFullScreenIndex(i); setFullScreenImage(url); }} activeOpacity={0.9}>
                  <Image source={{ uri: url }} style={styles.previewImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Modal para imagem em tela cheia com zoom (pinch e duplo toque) */}
        <Modal visible={!!fullScreenImage} transparent animationType="fade">
          <GestureHandlerRootView style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {fullScreenImage && <ZoomableImage uri={fullScreenImage} key={fullScreenImage} />}
            </View>
            {fullScreenImages.length > 1 && (
              <View style={styles.modalNav}>
                <TouchableOpacity
                  style={[styles.modalNavBtn, fullScreenIndex === 0 && styles.modalNavBtnDisabled]}
                  onPress={() => {
                    const next = fullScreenIndex - 1;
                    if (next >= 0) { setFullScreenIndex(next); setFullScreenImage(fullScreenImages[next]); }
                  }}
                  disabled={fullScreenIndex === 0}
                >
                  <Ionicons name="chevron-back" size={32} color={fullScreenIndex === 0 ? colors.gray500 : colors.white} />
                </TouchableOpacity>
                <Text style={styles.modalNavLabel}>{fullScreenIndex + 1} / {fullScreenImages.length}</Text>
                <TouchableOpacity
                  style={[styles.modalNavBtn, fullScreenIndex >= fullScreenImages.length - 1 && styles.modalNavBtnDisabled]}
                  onPress={() => {
                    const next = fullScreenIndex + 1;
                    if (next < fullScreenImages.length) { setFullScreenIndex(next); setFullScreenImage(fullScreenImages[next]); }
                  }}
                  disabled={fullScreenIndex >= fullScreenImages.length - 1}
                >
                  <Ionicons name="chevron-forward" size={32} color={fullScreenIndex >= fullScreenImages.length - 1 ? colors.gray500 : colors.white} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setFullScreenImage(null); setFullScreenImages([]); }} activeOpacity={0.8}>
              <Ionicons name="close-circle" size={40} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.modalHint}>Pinch para zoom • Duplo toque para ampliar/reduzir</Text>
          </GestureHandlerRootView>
        </Modal>

        {/* Modal pré-visualização PDF */}
        {pdfPreviewUri && (
          <Modal visible animationType="slide">
            <SafeAreaView style={styles.pdfModalContainer}>
              <View style={styles.pdfModalHeader}>
                <Text style={styles.pdfModalTitle}>Pré-visualização do PDF</Text>
                <TouchableOpacity onPress={() => setPdfPreviewUri(null)} style={styles.pdfModalClose}>
                  <Ionicons name="close" size={28} color={colors.gray700} />
                </TouchableOpacity>
              </View>
              <WebView
                source={{ uri: pdfPreviewUri }}
                style={styles.pdfWebView}
                scalesPageToFit
                bounces={false}
              />
            </SafeAreaView>
          </Modal>
        )}

        {/* Medications */}
        {request.medications && request.medications.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Medicamentos</Text>
            {(request.medications as string[]).map((med, i) => (
              <View key={i} style={styles.medItem}>
                <Ionicons name="medical" size={16} color={colors.primary} />
                <Text style={styles.medText}>{med}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Exams */}
        {request.exams && request.exams.length > 0 && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Exames Solicitados</Text>
            {request.exams.map((exam, i) => (
              <View key={i} style={styles.medItem}>
                <Ionicons name="flask" size={16} color={colors.primary} />
                <Text style={styles.medText}>{exam}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Symptoms */}
        {request.symptoms && (
          <Card style={styles.card}>
            <Text style={styles.sectionLabel}>Sintomas</Text>
            <Text style={styles.symptomsText}>{request.symptoms}</Text>
          </Card>
        )}

        {/* Modal senha do certificado (assinatura digital) */}
        {showSignModal && (
          <Card style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
            <Text style={styles.sectionLabel}>Senha do Certificado Digital</Text>
            <Text style={[styles.aiText, { marginBottom: spacing.sm }]}>
              {request?.requestType === 'exam'
                ? 'Informe a senha do seu certificado PFX para assinar digitalmente o pedido de exame.'
                : 'Informe a senha do seu certificado PFX para assinar digitalmente a receita.'}
            </Text>
            <Input
              label="Senha do certificado"
              placeholder="Senha do arquivo .pfx"
              value={pfxPassword}
              onChangeText={setPfxPassword}
              secureTextEntry
            />
            <View style={[styles.rejectBtns, { marginTop: spacing.md }]}>
              <Button title="Cancelar" variant="ghost" size="sm" onPress={() => { setShowSignModal(false); setPfxPassword(''); }} />
              <Button title="Assinar" size="sm" onPress={() => handleSign(pfxPassword)} loading={actionLoading === 'sign'} disabled={!pfxPassword.trim()} />
            </View>
          </Card>
        )}

        {/* Editar medicamentos/exames antes de assinar (quando já pago) */}
        {showEditModal && (
          <Card style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
            <Text style={styles.sectionLabel}>
              {request?.requestType === 'exam' ? 'Editar exames e notas (antes de assinar)' : 'Editar medicamentos e notas (antes de assinar)'}
            </Text>
            <Text style={[styles.aiText, { marginBottom: spacing.sm }]}>
              {request?.requestType === 'exam'
                ? 'Altere os exames ou notas. Depois assine o documento.'
                : 'Altere os medicamentos ou notas. Depois pré-visualize o PDF novamente para confirmar.'}
            </Text>
            {request?.requestType === 'exam' ? (
              <Input
                label="Exames (um por linha)"
                placeholder="Ex: Hemograma\nGlicemia\nTSH"
                value={editExams}
                onChangeText={setEditExams}
                multiline
                numberOfLines={6}
                style={{ minHeight: 120, textAlignVertical: 'top' }}
              />
            ) : (
              <Input
                label="Medicamentos (um por linha)"
                placeholder={'Ex: Dipirona 500mg - 1cp 6/6h\nOmeprazol 20mg - 1cp em jejum'}
                value={editMedications}
                onChangeText={setEditMedications}
                multiline
                numberOfLines={6}
                style={{ minHeight: 120, textAlignVertical: 'top' }}
              />
            )}
            <Input label="Observações (opcional)" placeholder="Notas para o PDF..." value={editNotes} onChangeText={setEditNotes} multiline numberOfLines={2} style={{ minHeight: 60, textAlignVertical: 'top', marginTop: spacing.sm }} />
            <View style={[styles.rejectBtns, { marginTop: spacing.md }]}>
              <Button title="Cancelar" variant="ghost" size="sm" onPress={() => setShowEditModal(false)} />
              <Button title="Salvar" size="sm" onPress={handleSaveEdit} loading={actionLoading === 'edit'} />
            </View>
          </Card>
        )}

        {/* Approve modal - medicamentos/exames para preencher o PDF */}
        {showApproveModal && (
          <Card style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
            <Text style={styles.sectionLabel}>
              {request?.requestType === 'prescription' ? 'Medicamentos (um por linha)' : 'Exames solicitados (um por linha)'}
            </Text>
            <Text style={[styles.aiText, { marginBottom: spacing.sm }]}>
              Copie da análise da IA acima ou preencha manualmente. Serão usados no PDF.
            </Text>
            <Input
              label={request?.requestType === 'prescription' ? 'Medicamentos' : 'Exames'}
              placeholder={request?.requestType === 'prescription' ? 'Ex: Dipirona 500mg - 1cp 6/6h\nOmeprazol 20mg - 1cp em jejum' : 'Ex: Hemograma\nGlicemia\nTSH'}
              value={request?.requestType === 'prescription' ? approveMedications : approveExams}
              onChangeText={request?.requestType === 'prescription' ? setApproveMedications : setApproveExams}
              multiline
              numberOfLines={6}
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
            <Input label="Observações (opcional)" placeholder="Notas para o PDF..." value={approveNotes} onChangeText={setApproveNotes} multiline numberOfLines={2} style={{ minHeight: 60, textAlignVertical: 'top', marginTop: spacing.sm }} />
            <View style={[styles.rejectBtns, { marginTop: spacing.md }]}>
              <Button title="Cancelar" variant="ghost" size="sm" onPress={() => setShowApproveModal(false)} />
              <Button title="Aprovar" size="sm" onPress={handleApprove} loading={actionLoading === 'approve'} />
            </View>
          </Card>
        )}

        {/* Reject form */}
        {showReject && (
          <Card style={[styles.card, { backgroundColor: colors.errorLight }]}>
            <Input label="Motivo da rejeição" placeholder="Explique por que está rejeitando..." value={rejectReason} onChangeText={setRejectReason} multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} />
            <View style={styles.rejectBtns}>
              <Button title="Cancelar" variant="ghost" size="sm" onPress={() => setShowReject(false)} />
              <Button title="Confirmar Rejeição" variant="danger" size="sm" onPress={handleReject} loading={actionLoading === 'reject'} />
            </View>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {!request.doctorId && ['submitted', 'paid'].includes(request.status) && (
            <Button title="Aceitar na Fila" onPress={handleAssign} loading={actionLoading === 'assign'} fullWidth icon={<Ionicons name="add-circle" size={20} color={colors.white} />} />
          )}
          {['submitted', 'in_review'].includes(request.status) && request.doctorId && (
            <>
              <Button title="Aprovar" onPress={openApproveModal} loading={actionLoading === 'approve'} fullWidth icon={<Ionicons name="checkmark-circle" size={20} color={colors.white} />} />
              <Button title="Rejeitar" variant="outline" onPress={() => setShowReject(true)} fullWidth style={{ marginTop: spacing.sm, borderColor: colors.error }} icon={<Ionicons name="close-circle" size={20} color={colors.error} />} />
            </>
          )}
          {request.status === 'paid' && request.doctorId && request.requestType === 'prescription' && (
            <>
              <Button title="Pré-visualizar PDF" variant="outline" onPress={handlePreviewPdf} loading={actionLoading === 'preview'} fullWidth icon={<Ionicons name="document-text-outline" size={20} color={colors.primary} />} />
              <Button title="Editar medicamentos / notas" variant="outline" onPress={openEditModal} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="create-outline" size={20} color={colors.primary} />} />
              <Button title="Assinar Digitalmente" onPress={handleSignClick} loading={actionLoading === 'sign'} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="create" size={20} color={colors.white} />} />
            </>
          )}
          {request.status === 'paid' && request.doctorId && request.requestType === 'exam' && (
            <>
              <Button title="Editar exames / notas" variant="outline" onPress={openEditModal} fullWidth icon={<Ionicons name="create-outline" size={20} color={colors.primary} />} />
              <Button title="Assinar Digitalmente" onPress={handleSignClick} loading={actionLoading === 'sign'} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="create" size={20} color={colors.white} />} />
            </>
          )}
          {request.requestType === 'consultation' && ['searching_doctor'].includes(request.status) && (
            <Button title="Aceitar Consulta" onPress={async () => {
              setActionLoading('accept');
              try {
                const result = await acceptConsultation(request.id);
                Alert.alert('Sucesso', 'Consulta aceita. Sala de vídeo criada.', [
                  { text: 'Entrar na videochamada', onPress: () => router.push(`/video/${request.id}`) },
                  { text: 'OK', onPress: () => load() },
                ]);
                load();
              } catch (e: any) { Alert.alert('Erro', e.message); }
              finally { setActionLoading(''); }
            }} loading={actionLoading === 'accept'} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="videocam" size={20} color={colors.white} />} />
          )}
          {request.requestType === 'consultation' && request.doctorId && ['consultation_ready', 'in_consultation'].includes(request.status) && (
            <Button title="Entrar na Videochamada" onPress={() => router.push(`/video/${request.id}`)} fullWidth style={{ marginTop: spacing.sm }} icon={<Ionicons name="videocam" size={20} color={colors.white} />} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { ...typography.h4, color: colors.primaryDarker },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  err: { ...typography.body, color: colors.error, textAlign: 'center', marginTop: 100 },
  card: { marginBottom: spacing.md },
  patientRow: { flexDirection: 'row', alignItems: 'center' },
  patientAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  patientInfo: { flex: 1 },
  patientName: { ...typography.bodySemiBold, color: colors.gray800 },
  patientMeta: { ...typography.caption, color: colors.gray500 },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  aiTitle: { ...typography.bodySmallMedium, color: colors.secondaryDark },
  aiText: { ...typography.bodySmall, color: colors.gray700 },
  aiMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  aiMetaText: { ...typography.caption, color: colors.gray500 },
  sectionLabel: { ...typography.bodySemiBold, color: colors.primaryDarker, marginBottom: spacing.sm },
  imagesScroll: { flexDirection: 'row' },
  previewImg: { width: 120, height: 160, borderRadius: borderRadius.md, marginRight: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { flex: 1, width: '100%', justifyContent: 'center' },
  fullScreenImg: { width: '100%', height: '80%' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  modalHint: { ...typography.caption, color: colors.gray400, marginBottom: 40 },
  modalNav: { position: 'absolute', bottom: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  modalNavBtn: { padding: spacing.sm },
  modalNavBtnDisabled: { opacity: 0.4 },
  modalNavLabel: { ...typography.bodySmall, color: colors.gray400 },
  medItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  medText: { ...typography.bodySmall, color: colors.gray700 },
  symptomsText: { ...typography.bodySmall, color: colors.gray700 },
  rejectBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  actions: { marginTop: spacing.md },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  copyBtnText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  templateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  templateBox: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray200 },
  templateText: { ...typography.bodySmall, color: colors.gray700, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: spacing.sm },
  pdfModalContainer: { flex: 1, backgroundColor: colors.white },
  pdfModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  pdfModalTitle: { ...typography.h4, color: colors.primaryDarker },
  pdfModalClose: { padding: spacing.sm },
  pdfWebView: { flex: 1, width: Dimensions.get('window').width },
});
