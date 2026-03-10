import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  getRequestById, approveRequest, rejectRequest, acceptConsultation,
  getPatientProfile, type MedicalRequest, type PatientProfile,
} from '@/services/doctorApi';
import { getTypeLabel, getTypeIcon, getStatusInfo, normalizeStatus } from '@/lib/doctor-helpers';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, ArrowLeft, User, Calendar, CheckCircle2, XCircle, Pen, Video,
  Phone, Mail, AlertTriangle, Clock, Pill, ClipboardList, Brain, Shield, ChevronRight,
  Stethoscope,
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
  const [request, setRequest] = useState<MedicalRequest | null>(null);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getRequestById(id)
      .then(async (data) => {
        setRequest(data);
        if (data.patientId) {
          try {
            const p = await getPatientProfile(data.patientId);
            setPatient(p);
          } catch { /* no patient data */ }
        }
      })
      .catch(() => toast.error('Erro ao carregar pedido'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading('approve');
    try {
      await approveRequest(id);
      toast.success('Pedido aprovado');
      const updated = await getRequestById(id);
      setRequest(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setActionLoading('reject');
    try {
      await rejectRequest(id, rejectReason);
      toast.success('Pedido recusado');
      setRejectOpen(false);
      const updated = await getRequestById(id);
      setRequest(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao recusar');
    } finally {
      setActionLoading('');
    }
  };

  const handleAcceptConsultation = async () => {
    if (!id) return;
    setActionLoading('accept');
    try {
      await acceptConsultation(id);
      toast.success('Consulta aceita');
      const updated = await getRequestById(id);
      setRequest(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aceitar');
    } finally {
      setActionLoading('');
    }
  };

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
  const Icon = getTypeIcon(request.type);
  const symptomsList = normalizeSymptoms(request.symptoms);
  const statusNorm = normalizeStatus(request.status);

  const canApprove = ['submitted', 'pending'].includes(statusNorm);
  const canReject = ['submitted', 'pending', 'in_review', 'approved_pending_payment', 'approved', 'paid'].includes(statusNorm);
  const canEdit = ['paid'].includes(statusNorm);
  const canVideo = request.type === 'consultation' && ['consultation_accepted', 'consultation_ready', 'in_consultation'].includes(statusNorm);
  const canAcceptConsult = request.type === 'consultation' && statusNorm === 'paid';

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Back + header */}
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
                <h1 className="text-xl font-bold tracking-tight">{getTypeLabel(request.type)}</h1>
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

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Patient info */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" aria-hidden />
                    Paciente
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/paciente/${request.patientId}`)}
                        className="ml-auto gap-1"
                      >
                        Prontuário
                        <ChevronRight className="h-3.5 w-3.5" />
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
                          <span>{new Date(patient.birthDate).toLocaleDateString('pt-BR')}</span>
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

            {/* Description / symptoms */}
            {(request.description || symptomsList.length > 0) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
                      Detalhes do Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {request.description && <p className="text-sm">{request.description}</p>}
                    {symptomsList.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Sintomas relatados</p>
                        <div className="flex flex-wrap gap-2">
                          {symptomsList.map((s, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Medications */}
            {Array.isArray(request.medications) && request.medications.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Pill className="h-4 w-4 text-primary" aria-hidden />
                      Medicamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {request.medications.map((med, i) => {
                        const item = typeof med === 'object' && med && 'name' in med
                          ? med as { name?: string; dosage?: string; frequency?: string; duration?: string; notes?: string }
                          : { name: String(med), dosage: '—', frequency: '—', duration: '—' };
                        return (
                          <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                            <p className="font-medium text-sm">{item.name || '—'}</p>
                            <div className="grid grid-cols-3 gap-2 mt-1.5 text-xs text-muted-foreground">
                              <span>Dose: {item.dosage ?? '—'}</span>
                              <span>Freq: {item.frequency ?? '—'}</span>
                              <span>Duração: {item.duration ?? '—'}</span>
                            </div>
                            {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* AI Suggestion */}
            {request.aiConductSuggestion && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="shadow-sm border-primary/20 bg-primary/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" aria-hidden />
                      Sugestão da IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm whitespace-pre-wrap">{request.aiConductSuggestion}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Signed document */}
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
                    <Button size="sm" variant="outline" asChild>
                      <a href={request.signedDocumentUrl} target="_blank" rel="noreferrer">Ver PDF</a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Actions sidebar */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="shadow-sm sticky top-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ações</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {canApprove && (
                    <Button
                      className="w-full gap-2"
                      onClick={handleApprove}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Aprovar
                    </Button>
                  )}

                  {canReject && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5"
                      onClick={() => setRejectOpen(true)}
                      disabled={!!actionLoading}
                    >
                      <XCircle className="h-4 w-4" />
                      Recusar
                    </Button>
                  )}

                  {canAcceptConsult && (
                    <Button
                      className="w-full gap-2"
                      onClick={handleAcceptConsultation}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
                      Aceitar Consulta
                    </Button>
                  )}

                  {canEdit && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => navigate(`/pedidos/${id}/editor`)}
                    >
                      <Pen className="h-4 w-4" />
                      Editar & Assinar
                    </Button>
                  )}

                  {canVideo && (
                    <Button
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => navigate(`/video/${id}`)}
                    >
                      <Video className="h-4 w-4" />
                      Iniciar Vídeo
                    </Button>
                  )}

                  {!canApprove && !canReject && !canEdit && !canVideo && !canAcceptConsult && (
                    <div className="text-center py-4">
                      <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Sem ações disponíveis</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
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
              {actionLoading === 'reject' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
