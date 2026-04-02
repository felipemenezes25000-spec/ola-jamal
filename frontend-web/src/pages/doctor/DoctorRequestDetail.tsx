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
  Phone, AlertTriangle,
  Shield, ChevronRight, Stethoscope, Heart,
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

  const { data: request, isLoading: loading, refetch } = useDoctorRequestDetailQuery(id);

  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);

  useEffect(() => {
    document.title = id ? `Pedido #${id.slice(0, 8)} — RenoveJa+` : 'Pedido — RenoveJa+';
    return () => { document.title = 'RenoveJa+'; };
  }, [id]);

  useEffect(() => {
    if (!request?.patientId) return;
    let cancelled = false;
    getPatientProfile(request.patientId)
      .then((p) => { if (!cancelled) setPatient(p); })
      .catch(() => { if (!cancelled) setPatient(null); });
    return () => { cancelled = true; };
  }, [request?.patientId]);

  // ── Action handlers ──

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

  // ── Loading / error states ──

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
        {/* Main content */}
        <div className="flex-1 min-w-0 lg:flex-[0_0_60%] overflow-y-auto">
          <div className="space-y-5 max-w-4xl">

            {/* ── Dark header (#0C4A6E) ── */}
            <div className="rounded-xl bg-sky-900 text-white p-4 sm:p-5">
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/pedidos')}
                  aria-label="Voltar"
                  className="text-white hover:bg-white/10 shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-white/10 shrink-0">
                    <Icon className="h-5 w-5 text-white" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">
                      {getTypeLabel(reqType)}
                    </h1>
                    <p className="text-xs sm:text-sm text-sky-200">
                      {new Date(request.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold shrink-0 ${statusInfo.bgColor} ${statusInfo.color}`}>
                  {statusInfo.label}
                </div>
              </div>
            </div>

            {/* ── Status tracker ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <StatusTracker status={request.status} type={reqType} />
            </motion.div>

            {/* ── Dra. Renova assistant ── */}
            <AssistantBanner requestId={request.id} requestStatus={request.status} requestType={reqType} onNavigate={(route) => navigate(route)} />

            {/* ── Main content grid: stacks on mobile, side-by-side on desktop ── */}
            <div className="grid gap-5 lg:grid-cols-3">
              {/* Main column */}
              <div className="lg:col-span-2 space-y-5">

                {/* ── Patient card ── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="shadow-sm overflow-hidden">
                    <CardContent className="p-4 sm:p-5">
                      {/* Avatar + name + prontuario button */}
                      <div className="flex items-center gap-3 sm:gap-4 mb-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0 relative">
                          <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                          {patient?.avatarUrl && (
                            <img
                              src={patient.avatarUrl}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base truncate">{request.patientName}</p>
                          {patient?.birthDate && (
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const b = new Date(patient.birthDate!);
                                const t = new Date();
                                const age = t.getFullYear() - b.getFullYear();
                                const m = t.getMonth() - b.getMonth();
                                const finalAge = (m < 0 || (m === 0 && t.getDate() < b.getDate())) ? age - 1 : age;
                                return `${finalAge} anos`;
                              })()}
                              {patient.gender && (
                                <> · {patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : patient.gender}</>
                              )}
                            </p>
                          )}
                        </div>
                        {request.patientId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/paciente/${request.patientId}`)}
                            className="gap-1 shrink-0 text-xs sm:text-sm"
                          >
                            Prontuário <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Info chips: type, urgency, UBS, CNS, phone */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Icon className="h-3 w-3" aria-hidden />
                          {getTypeLabel(reqType)}
                        </Badge>
                        {request.aiUrgency && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              request.aiUrgency.toLowerCase() === 'emergency'
                                ? 'bg-red-100 text-red-700'
                                : request.aiUrgency.toLowerCase() === 'urgent'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {request.aiUrgency.toLowerCase() === 'routine' ? 'Rotina' : request.aiUrgency.toLowerCase() === 'urgent' ? 'Urgente' : request.aiUrgency.toLowerCase() === 'emergency' ? 'Emergência' : request.aiUrgency}
                          </Badge>
                        )}
                        {patient?.phone && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Phone className="h-3 w-3" aria-hidden />
                            {patient.phone}
                          </Badge>
                        )}
                        {patient?.birthDate && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Calendar className="h-3 w-3" aria-hidden />
                            {new Date(patient.birthDate).toLocaleDateString('pt-BR')}
                          </Badge>
                        )}
                      </div>

                      {/* Allergies */}
                      {patient?.allergies && patient.allergies.length > 0 && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800">
                          <p className="text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1 mb-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Alergias
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-300">{patient.allergies.join(', ')}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Anamnese (consultations) */}
                {reqType === 'consultation' && request.consultationAnamnesis && (
                  <AnamnesisCard consultationAnamnesis={request.consultationAnamnesis} />
                )}

                {/* ── AI Copilot section (purple border) ── */}
                <AiCopilotSection request={request} />

                {/* Prescription / exam images */}
                {(request.prescriptionImages?.length ?? 0) > 0 && (
                  <PrescriptionImageGallery images={request.prescriptionImages!} label="Imagens da receita" iconBgColor="bg-primary/10" />
                )}
                {(request.examImages?.length ?? 0) > 0 && (
                  <PrescriptionImageGallery images={request.examImages!} label="Imagens do exame" iconBgColor="bg-amber-100" />
                )}

                {/* Symptoms */}
                {symptomsList.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <Card className="shadow-sm">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Sintomas relatados</p>
                        <div className="flex flex-wrap gap-2">
                          {symptomsList.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}


                {/* ── Medications list (numbered) ── */}
                {Array.isArray(request.medications) && request.medications.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <MedicationsCard medications={request.medications} />
                  </motion.div>
                )}

                {/* Conduct (consultations) */}
                {reqType === 'consultation' && (
                  <ConductForm
                    requestId={request.id}
                    initialNotes={request.doctorConductNotes ?? ''}
                    initialIncludeInPdf={request.includeConductInPdf ?? false}
                    aiSuggestion={request.aiConductSuggestion}
                    onSaved={async () => { await refetch(); }}
                  />
                )}

                {/* Transcription */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                  <TranscriptionCard transcript={request.consultationTranscript ?? ''} />
                </motion.div>

                {/* AI suggestion (prescription/exam) */}
                {request.aiConductSuggestion && reqType !== 'consultation' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
                    <Card className="shadow-sm border-violet-200 bg-violet-50/30 dark:bg-violet-950/10 dark:border-violet-500/40">
                      <CardContent className="p-4 sm:p-5 flex gap-3">
                        <Stethoscope className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" aria-hidden />
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{request.aiConductSuggestion}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* Exams */}
                {Array.isArray(request.exams) && request.exams.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
                    <ExamsCard exams={request.exams} />
                  </motion.div>
                )}

                {/* Post-consultation */}
                {reqType === 'consultation' && normalizeStatus(request.status) === 'consultation_finished' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                    <ConsultationPostSection request={request} requestId={id!} />
                  </motion.div>
                )}

                {/* Signed document */}
                {request.signedDocumentUrl && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <Card className="shadow-sm border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
                      <CardContent className="p-4 sm:p-5 flex items-center gap-4 flex-wrap">
                        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                          <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Documento assinado digitalmente</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">Certificado ICP-Brasil</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={handleDownloadPdf} className="shrink-0">
                          Ver PDF
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}

                {/* ── SUS banner ── */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3 dark:bg-emerald-950/20 dark:border-emerald-800">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 shrink-0">
                      <Heart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Atendimento gratuito via SUS
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Este serviço é 100% gratuito pelo Sistema Único de Saúde.
                      </p>
                    </div>
                  </div>
                </motion.div>

              </div>{/* end main column */}

              {/* ── Actions sidebar ── */}
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

            </div>{/* end grid */}
          </div>
        </div>{/* end main content */}

        {/* Patient side panel */}
        <PatientSidePanel
          patientId={request.patientId}
          currentRequestId={id ?? undefined}
          collapsed={sidePanelCollapsed}
          onCollapsedChange={setSidePanelCollapsed}
        />
      </div>

      {/* Reject dialog */}
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
