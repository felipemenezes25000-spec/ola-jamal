import { useNavigate } from 'react-router-dom';
import {
  Loader2, CheckCircle2, XCircle, Pen, Video, Stethoscope,
  FileOutput, Download, PackageCheck, Ban, Clock, FileText, ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { normalizeStatus } from '@/lib/doctor-helpers';
import type { MedicalRequest } from '@/services/doctorApi';

interface Props {
  request: MedicalRequest;
  id: string;
  actionLoading: string;
  onApprove: () => void;
  onRejectOpen: () => void;
  onAcceptConsult: () => void;
  onGenPdf: () => void;
  onDownloadPdf: () => void;
  onDeliver: () => void;
  onCancel: () => void;
}

export function RequestActionsCard({
  request, id, actionLoading,
  onApprove, onRejectOpen, onAcceptConsult,
  onGenPdf, onDownloadPdf, onDeliver, onCancel,
}: Props) {
  const navigate = useNavigate();
  const statusNorm = normalizeStatus(request.status);
  const reqType = (request.type ?? '').toLowerCase();
  const isConsultation = reqType === 'consultation';

  // ── Condições de ação ──
  const canApprove       = !isConsultation && ['submitted', 'pending'].includes(statusNorm);
  const canReject        = ['submitted', 'pending', 'in_review', 'searching_doctor', 'approved_pending_payment', 'approved', 'paid'].includes(statusNorm);
  const canEdit          = statusNorm === 'paid' && !isConsultation;
  const canAcceptConsult = isConsultation && ['searching_doctor', 'submitted', 'pending'].includes(statusNorm);
  const canVideo         = isConsultation && ['paid', 'consultation_accepted', 'consultation_ready', 'in_consultation'].includes(statusNorm);
  const canPostConsult   = isConsultation && statusNorm === 'consultation_finished';
  const canSummary       = isConsultation && statusNorm === 'consultation_finished';
  const canCancel        = ['submitted', 'pending', 'in_review', 'searching_doctor'].includes(statusNorm);
  const canDeliver       = statusNorm === 'signed';
  const canGenPdf        = statusNorm === 'paid' && reqType === 'prescription';
  const canDownload      = !!request.signedDocumentUrl || statusNorm === 'signed' || statusNorm === 'delivered';

  const noActions = !canApprove && !canReject && !canEdit && !canVideo &&
    !canAcceptConsult && !canCancel && !canDeliver && !canGenPdf && !canDownload &&
    !canPostConsult && !canSummary;

  return (
    <Card className="shadow-sm sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ações</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {canApprove && (
          <Button className="w-full gap-2" onClick={onApprove} disabled={!!actionLoading}>
            {actionLoading === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Aprovar
          </Button>
        )}
        {canAcceptConsult && (
          <Button className="w-full gap-2" onClick={onAcceptConsult} disabled={!!actionLoading}>
            {actionLoading === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
            Aceitar Consulta
          </Button>
        )}
        {canReject && (
          <Button variant="outline" className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={onRejectOpen} disabled={!!actionLoading}>
            <XCircle className="h-4 w-4" />Recusar
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/pedidos/${id}/editor`)}>
            <Pen className="h-4 w-4" />Editar &amp; Assinar
          </Button>
        )}
        {canVideo && (
          <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate(`/video/${id}`)}>
            <Video className="h-4 w-4" />Iniciar Vídeo
          </Button>
        )}
        {canPostConsult && (
          <Button className="w-full gap-2" onClick={() => navigate(`/pos-consulta/${id}`)}>
            <FileText className="h-4 w-4" />Emitir Documentos
          </Button>
        )}
        {canSummary && (
          <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/resumo-consulta/${id}`)}>
            <ClipboardList className="h-4 w-4" />Ver Resumo
          </Button>
        )}
        {canGenPdf && (
          <Button variant="outline" className="w-full gap-2" onClick={onGenPdf} disabled={!!actionLoading}>
            {actionLoading === 'genpdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileOutput className="h-4 w-4" />}
            Gerar PDF
          </Button>
        )}
        {canDownload && (
          <Button variant="outline" className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30" onClick={onDownloadPdf} disabled={!!actionLoading}>
            {actionLoading === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar documento
          </Button>
        )}
        {canDeliver && (
          <Button variant="outline" className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30" onClick={onDeliver} disabled={!!actionLoading}>
            {actionLoading === 'deliver' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Marcar entregue
          </Button>
        )}
        {canCancel && (
          <Button variant="outline" className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={onCancel} disabled={!!actionLoading}>
            {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Cancelar pedido
          </Button>
        )}
        {noActions && (
          <div className="text-center py-4">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sem ações disponíveis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
