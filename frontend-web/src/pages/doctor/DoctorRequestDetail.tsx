import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  approveRequest, rejectRequest, acceptConsultation,
  cancelRequest, markRequestDelivered, generatePdf, getDocumentDownloadUrl,
  getPatientProfile, type PatientProfile,
} from '@/services/doctorApi';
import { getTypeLabel, getTypeIcon, getStatusInfo, normalizeStatus } from '@/lib/doctor-helpers';
import { AiCopilotCard } from '@/components/doctor/AiCopilotCard';
import { hasUsefulAiContent } from '@/lib/aiCopilotHelpers';
import { StatusTracker } from '@/components/doctor/StatusTracker';
import { ConsultationPostSection } from '@/components/doctor/ConsultationPostSection';
import { PatientSidePanel } from '@/components/doctor/PatientSidePanel';
import { AiCopilotSection } from '@/components/doctor/request/AiCopilotSection';
import { PrescriptionImageGallery } from '@/components/doctor/request/PrescriptionImageGallery';
import { ConductForm } from '@/components/doctor/request/ConductForm';
import { AnamnesisCard } from '@/components/doctor/request/AnamnesisCard';
import { MedicationsCard } from '@/components/doctor/request/MedicationsCard';
import { ExamsCard } from '@/components/doctor/request/ExamsCard';
import { TranscriptionCard } from '@/components/doctor/request/TranscriptionCard';
import { RequestActionsCard } from '@/components/doctor/request/RequestActionsCard';
import { AssistantBanner } from '@/components/doctor/AssistantBanner';
import { useDoctorRequestDetailQuery } from '@/hooks/useDoctorRequestDetailQuery';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, ArrowLeft, User, Calendar,
  Phone, Mail, AlertTriangle,
  Shield, ChevronRight, Stethoscope,
} from 'lucide-react';

/** Normaliza symptoms para array (backend pode retornar string ou string[]). */
function normalizeSymptoms(symptoms: unknown): string[] {
  if (Array.isArray(symptoms)) return symptoms.filter((s): s is string => typeof s === 'string');
  if (typeof symptoms === 'string' && symptoms.trim())
    return symptoms.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export default function DoctorRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── TanStack Query — substituiu useState+useEffect+fetch manual ──
  const { data: request, isLoading: loading, refetch } = useDoctorRequestDetailQuery(id);

  // Estados secundários
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);

  useEffect(() => {
    document.title = id ? `Pedido #${id.slice(0, 8)} — RenoveJá+` : 'Pedido — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, [id]);

  // Busca perfil do paciente quando o pedido carregar
  useEffect(() => {
    if (!request?.patientId) return;
    getPatientProfile(request.patientId)
      .then(setPatient)
      .catch(() => setPatient(null));
  }, [request?.patientId]);

  // ── Action handlers — usam refetch() em vez de setRequest ──

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading('approve');
    try {
      await approveRequest(id);
      toast.success('Pedido aprovado');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar');
    } finally { setActionLoading(''); }
  };

  const handleReject = async () => {
    if (!id) return;
    setActionLoading('reject');
    try {
      await rejectRequest(id, rejectReason);
      toast.success('Pedido recusado');
      setRejectOpen(false);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao recusar');
    } finally { setActionLoading(''); }
  };

  const handleAcceptConsultation = async () => {
    if (!id) return;
    setActionLoading('accept');
    try {
      await acceptConsultation(id);
      toast.success('Consulta aceita');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aceitar');
    } finally { setActionLoading(''); }
  };

  const handleCancel = async () => {
    if (!id) return;
    setActionLoading('cancel');
    try {
      await cancelRequest(id);
      toast.success('Pedido cancelado');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar');
    } finally { setActionLoading(''); }
  };

  const handleMarkDelivered = async () => {
    if (!id) return;
    setActionLoading('deliver');
    try {
      await markRequestDelivered(id);
      toast.success('Pedido marcado como entregue');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao marcar entrega');
    } finally { setActionLoading(''); }
  };

  const handleGeneratePdf = async () => {
    if (!id) return;
    setActionLoading('genpdf');
    try {
      const result = await generatePdf(id);
      toast.success(result.message || 'PDF gerado com sucesso');
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar PDF');
    } finally { setActionLoading(''); }
  };

  const handleDownloadPdf = async () => {
    if (!id || !request) return;
    setActionLoading('download');
    try {
      const url = request.signedDocumentUrl || await getDocumentDownloadUrl(id);
      if (!url) { toast.error('URL de download não disponível'); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('Download iniciado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao baixar documento');
    } finally { setActionLoading(''); }
  };

  // ── Renders de estado ──

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DoctorLayout>
    );
  }

  if (!request) {
    return (
      <DoctorLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Pedido não encontrado</p>
          <Button variant="ghost" onClick={() => navigate('/pedidos')} className="mt-4">
            Voltar aos pedidos
          </Button>
        </div>
      </DoctorLayout>
    );
  }

  const statusInfo = getStatusInfo(request.status);
  const reqType = (request.type ?? '').toLowerCase();
  const Icon = getTypeIcon(reqType);
  const symptomsList = normalizeSymptoms(request.symptoms);

  return (
    <DoctorLayout>
      <div className="flex min-h-screen">
        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0 lg:flex-[0_0_60%] overflow-y-auto">
          <div className="space-y-6 max-w-4xl pr-4">

            {/* Cabeçalho */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/pedidos')} aria-label="Voltar">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-muted">
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight">{getTypeLabel(reqType)}</h1>
                    <p className="text-sm text-muted-foreground">
                      {new Date(request.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-xl border ${statusInfo.bgColor}`}>
                <span className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
              </div>
            </div>

            {/* Status tracker */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <StatusTracker status={request.status} type={reqType} />
            </motion.div>

            {/* Dra. Renova */}
            <AssistantBanner requestId={request.id} requestStatus={request.status} requestType={reqType} onNavigate={(route) => navigate(route)} />

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Coluna principal */}
              <div className="lg:col-span-2 space-y-5">

                {/* Paciente */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                          {patient?.avatarUrl
                            ? <img src={patient.avatarUrl} alt="" className="w-full h-full object-cover" />
                            : <User className="h-6 w-6 text-primary" />}
                        </div>
                        <div>
                          <p className="font-semibold">{request.patientName}</p>
                          {request.patientEmail && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {request.patientEmail}
                            </p>
                          )}
                        </div>
                        {request.patientId && (
                          <Button variant="outline" size="sm" onClick={() => navigate(`/paciente/${request.patientId}`)} className="ml-auto gap-1">
                            Prontuário <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      {patient && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {patient.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                              <span>{patient.phone}</span>
                            </div>
                          )}
                          {patient.birthDate && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                              <span>
                                {new Date(patient.birthDate).toLocaleDateString('pt-BR')}
                                {(() => {
                                  const b = new Date(patient.birthDate!);
                                  const t = new Date();
                                  const age = t.getFullYear() - b.getFullYear();
                                  const m = t.getMonth() - b.getMonth();
                                  return ` (${(m < 0 || (m === 0 && t.getDate() < b.getDate())) ? age - 1 : age} anos)`;
                                })()}
                              </span>
                            </div>
                          )}
                          {patient.gender && (
                            <div className="flex items-center gap-2 text-sm">
                              <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                              <span>{patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : patient.gender}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {patient?.allergies && patient.allergies.length > 0 && (
                        <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                          <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Alergias
                          </p>
                          <p className="text-sm text-red-600">{patient.allergies.join(', ')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Anamnese (consultas) */}
                {reqType === 'consultation' && request.consultationAnamnesis && (
                  <AnamnesisCard consultationAnamnesis={request.consultationAnamnesis} />
                )}

                {/* Link care plan */}
                {/* IA — resumo, risco, urgência */}
                <AiCopilotSection request={request} />

                {/* Imagens receita / exame */}
                {(request.prescriptionImages?.length ?? 0) > 0 && (
                  <PrescriptionImageGallery images={request.prescriptionImages!} label="Imagens da receita" iconBgColor="bg-primary/10" />
                )}
                {(request.examImages?.length ?? 0) > 0 && (
                  <PrescriptionImageGallery images={request.examImages!} label="Imagens do exame" iconBgColor="bg-amber-100" />
                )}

                {/* Detalhes / sintomas */}
                {(request.description || symptomsList.length > 0) && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="shadow-sm">
                      <CardContent className="p-5 space-y-3">
                        {request.description && <p className="text-sm">{request.description}</p>}
                        {symptomsList.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Sintomas relatados</p>
                            <div className="flex flex-wrap gap-2">
                              {symptomsList.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* IA copilot card (fallback se AiCopilotSection não renderizou) */}
                {hasUsefulAiContent(request.aiSummaryForDoctor, request.aiRiskLevel, request.aiUrgency) && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <AiCopilotCard aiSummaryForDoctor={request.aiSummaryForDoctor} aiRiskLevel={request.aiRiskLevel} aiUrgency={request.aiUrgency} />
                  </motion.div>
                )}

                {/* Imagens legado removidas — PrescriptionImageGallery acima já renderiza */}

                {/* Medicamentos — componente extraído */}
                {Array.isArray(request.medications) && request.medications.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <MedicationsCard medications={request.medications} />
                  </motion.div>
                )}

                {/* Conduta (consultas) */}
                {reqType === 'consultation' && (
                  <ConductForm
                    requestId={request.id}
                    initialNotes={request.doctorConductNotes ?? ''}
                    initialIncludeInPdf={request.includeConductInPdf ?? false}
                    aiSuggestion={request.aiConductSuggestion}
                    onSaved={async () => { await refetch(); }}
                  />
                )}

                {/* Transcrição — componente extraído */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                  <TranscriptionCard transcript={request.consultationTranscript ?? ''} />
                </motion.div>

                {/* Evidências científicas — componente extraído */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>                </motion.div>

                {/* Sugestão IA (receita/exame) */}
                {request.aiConductSuggestion && reqType !== 'consultation' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
                    <Card className="shadow-sm border-primary/20 bg-primary/[0.02]">
                      <CardContent className="p-5 flex gap-3">
                        <Stethoscope className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden />
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{request.aiConductSuggestion}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Exames — componente extraído */}
                {Array.isArray(request.exams) && request.exams.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
                    <ExamsCard exams={request.exams} />
                  </motion.div>
                )}

                {/* Pós-consulta */}
                {reqType === 'consultation' && normalizeStatus(request.status) === 'consultation_finished' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                    <ConsultationPostSection request={request} requestId={id!} />
                  </motion.div>
                )}

                {/* Documento assinado */}
                {request.signedDocumentUrl && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <Card className="shadow-sm border-emerald-200 bg-emerald-50/50">
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-emerald-100">
                          <Shield className="h-5 w-5 text-emerald-600" aria-hidden />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-emerald-800">Documento assinado digitalmente</p>
                          <p className="text-xs text-emerald-600">Certificado ICP-Brasil</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
                          Ver PDF
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

              </div>{/* fim coluna principal */}

              {/* Sidebar de ações — componente extraído */}
              <div className="space-y-4">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <RequestActionsCard
                    request={request}
                    id={id!}
                    actionLoading={actionLoading}
                    onApprove={handleApprove}
                    onRejectOpen={() => setRejectOpen(true)}
                    onAcceptConsult={handleAcceptConsultation}
                    onGenPdf={handleGeneratePdf}
                    onDownloadPdf={handleDownloadPdf}
                    onDeliver={handleMarkDelivered}
                    onCancel={handleCancel}
                  />
                </motion.div>
              </div>

            </div>{/* fim grid */}
          </div>
        </div>{/* fim conteúdo principal */}

        {/* Prontuário lateral */}
        <PatientSidePanel
          patientId={request.patientId}
          currentRequestId={id ?? undefined}
          collapsed={sidePanelCollapsed}
          onCollapsedChange={setSidePanelCollapsed}
        />
      </div>

      {/* Dialog de rejeição */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Pedido</DialogTitle>
            <DialogDescription>Informe o motivo da recusa (opcional)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Textarea
              id="reject-reason"
              placeholder="Ex: Dados insuficientes, necessita exame complementar..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading === 'reject' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
