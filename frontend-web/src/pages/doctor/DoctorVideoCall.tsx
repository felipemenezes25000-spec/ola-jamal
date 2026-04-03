/**
 * DoctorVideoCall — Tela de Videoconsulta Inteligente
 *
 * Layout split-screen:
 * - Esquerda: iframe Daily.co com vídeo
 * - Direita: Painel clínico com IA em tempo real
 *   - Timer da consulta
 *   - Transcrição ao vivo (Daily.co)
 *   - Anamnese estruturada (Gemini/GPT-4o)
 *   - Sugestões de conduta
 *   - Evidências científicas
 *   - Notas do médico
 *   - Botão de finalizar consulta
 *
 * Design spec:
 * - Full-screen dark background (#0B1120)
 * - Top bar: "AO VIVO" green dot + text, timer, menu
 * - AI Panel: dark bg (#15202E), purple accent (#8B5CF6)
 * - Responsive: phone landscape, tablet, desktop
 * - Dark mode only for video call
 *
 * Integra com:
 * - POST /api/requests/{id}/start-consultation
 * - POST /api/requests/{id}/report-call-connected
 * - POST /api/requests/{id}/finish-consultation
 * - POST /api/requests/{id}/save-consultation-summary
 * - POST /api/video/join-token
 * - SignalR /hubs/video (TranscriptUpdate, AnamnesisUpdate, SuggestionUpdate, EvidenceUpdate)
 * - GET /api/requests/{id}/recordings
 *
 * Resolução CFM 2.454/2026: IA como ferramenta de auxílio, decisão final humana.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getRequestById,
  getJoinToken,
  startConsultation,
  reportCallConnected,
  finishConsultation,
  saveConsultationSummary,
  getPatientProfile,
  type MedicalRequest,
  type PatientProfile,
} from '@/services/doctorApi';
import { useVideoSignaling } from '@/hooks/useSignalR';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  Brain,
  AlertTriangle,
  Save,
  PhoneOff,
  Shield,
  MessageSquare,
  Video,
  X,
} from 'lucide-react';
import { VideoTopBar } from '@/components/doctor/video/VideoControls';
import { VideoFrameDaily } from '@/components/doctor/video/VideoFrameDaily';
import { ConsultationStats } from '@/components/doctor/video/ConsultationStats';
import { DoctorAIPanel } from '@/components/doctor/video/DoctorAIPanel';

export default function DoctorVideoCall() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Consulta em andamento — RenoveJá+';
    return () => {
      document.title = 'RenoveJá+';
    };
  }, []);

  const [lgpdDismissed, setLgpdDismissed] = useState(false);
  const [request, setRequest] = useState<MedicalRequest | null>(null);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [meetingToken, setMeetingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Consultation state
  const [consultationStarted, setConsultationStarted] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [contractedMinutes, setContractedMinutes] = useState<number | null>(
    null
  );

  // AI panel: consulta (full DoctorAIPanel) | notes
  const [activeTab, setActiveTab] = useState('consulta');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Finish dialog
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Guard: prevent StrictMode double-mount from calling startConsultation twice
  const startingRef = useRef(false);

  // SignalR real-time
  const {
    connected: signalConnected,
    transcript,
    anamnesis,
    suggestions,
    evidence,
  } = useVideoSignaling(requestId);

  // Parse anamnesis JSON (full object for DoctorAIPanel)
  const parsedAnamnesis: Record<string, unknown> | null = useMemo(() => {
    if (!anamnesis) return null;
    try {
      return JSON.parse(anamnesis) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [anamnesis]);

  // Count filled anamnesis fields (for stats)
  const filledFields = parsedAnamnesis
    ? Object.entries(parsedAnamnesis).filter(([, v]) => {
        if (v == null) return false;
        if (Array.isArray(v))
          return v.some((x) => x && String(x).trim().length > 0);
        return String(v).trim().length > 0;
      }).length
    : 0;

  const normalizedSuggestions = (suggestions as unknown[]).map((s) =>
    typeof s === 'string'
      ? s
      : {
          text: (s as { text?: string }).text,
          suggestion: (s as { suggestion?: string }).suggestion,
        }
  );

  // Timer
  useEffect(() => {
    if (consultationStarted) {
      timerRef.current = setInterval(
        () => setTimerSeconds((prev) => prev + 1),
        1000
      );
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [consultationStarted]);

  // Load data
  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const data = await getRequestById(requestId);
        setRequest(data);
        setContractedMinutes(data.contractedMinutes ?? null);

        if (data.patientId) {
          try {
            setPatient(await getPatientProfile(data.patientId));
          } catch {
            /* paciente opcional */
          }
        }

        // Start consultation if not already (guard prevents StrictMode double-fire)
        const statusLower = (data.status ?? '').toLowerCase();
        const needsStart = [
          'paid',
          'consultation_accepted',
          'consultation_ready',
        ].includes(statusLower);
        if (needsStart && !startingRef.current) {
          startingRef.current = true;
          try {
            const result = await startConsultation(requestId);
            if (result.chronicWarning) {
              toast.warning(result.chronicWarning, { duration: 8000 });
            }
            if (!cancelled) setConsultationStarted(true);
          } catch {
            /* startConsultation já iniciado — backend retorna sucesso idempotente */
          } finally {
            startingRef.current = false;
          }
        } else if (data.status?.toLowerCase().includes('in_consultation')) {
          setConsultationStarted(true);
          // Recover timer if consultation already started
          if (data.consultationStartedAt) {
            const elapsed = Math.floor(
              (Date.now() - new Date(data.consultationStartedAt).getTime()) /
                1000
            );
            setTimerSeconds(Math.max(0, elapsed));
          }
        }

        // Get video room token
        try {
          const tokenData = await getJoinToken(requestId);
          setRoomUrl(tokenData.roomUrl ?? null);
          setMeetingToken(tokenData.token ?? null);
          setContractedMinutes(
            tokenData.contractedMinutes ?? data.contractedMinutes ?? null
          );
        } catch {
          setError('Não foi possível obter o link da videochamada');
        }
      } catch {
        if (!cancelled) setError('Erro ao carregar dados da consulta');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      startingRef.current = false;
    };
  }, [requestId]);

  // Report call connected when iframe loads
  const handleIframeLoad = useCallback(() => {
    if (requestId) {
      reportCallConnected(requestId).catch(() => {});
    }
  }, [requestId]);

  // Bug #2: Handle left-meeting (voluntary leave or unexpected disconnection)
  const handleCallLeft = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (consultationStarted && requestId) {
      try {
        await finishConsultation(requestId, { conductNotes: '' });
      } catch {
        // best-effort — navigate to summary regardless
      }
      toast.info('Videochamada encerrada.');
      navigate(`/resumo-consulta/${requestId}`);
    } else if (requestId) {
      toast.info('Videochamada encerrada.');
      navigate(`/pedidos/${requestId}`);
    }
  }, [consultationStarted, requestId, navigate]);

  // Save notes
  const handleSaveNotes = async () => {
    if (!requestId) return;
    setSavingNotes(true);
    try {
      await saveConsultationSummary(requestId, {
        anamnesis: parsedAnamnesis
          ? JSON.stringify(parsedAnamnesis as Record<string, unknown>)
          : undefined,
        plan: doctorNotes || undefined,
      });
      toast.success('Notas salvas');
    } catch {
      toast.error('Erro ao salvar notas');
    } finally {
      setSavingNotes(false);
    }
  };

  // Finish consultation
  const handleFinish = async () => {
    if (!requestId) return;
    setFinishing(true);
    try {
      // Save notes first
      if (doctorNotes) {
        await saveConsultationSummary(requestId, {
          anamnesis: parsedAnamnesis
            ? JSON.stringify(parsedAnamnesis as Record<string, unknown>)
            : undefined,
          plan: doctorNotes,
        });
      }
      await finishConsultation(requestId, { conductNotes: doctorNotes });
      toast.success('Consulta finalizada com sucesso');
      setFinishDialogOpen(false);
      navigate(`/resumo-consulta/${requestId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar');
    } finally {
      setFinishing(false);
    }
  };

  // Warning if time running out
  const timeWarning =
    contractedMinutes && timerSeconds > contractedMinutes * 60 * 0.8;
  const timeExceeded =
    contractedMinutes && timerSeconds > contractedMinutes * 60;

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] min-h-screen items-center justify-center bg-[#0B1120]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#8B5CF6]" />
          <p className="text-gray-400">Preparando consulta inteligente...</p>
          <p className="mt-2 text-xs text-gray-600">
            Conectando IA clínica, transcrição e vídeo
          </p>
        </div>
      </div>
    );
  }

  if (error || !roomUrl || !meetingToken) {
    return (
      <div className="flex min-h-[100dvh] min-h-screen items-center justify-center bg-[#0B1120] p-4">
        <Card className="w-full max-w-md border-white/5 bg-[#15202E] shadow-lg">
          <CardContent className="p-6 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 sm:h-16 sm:w-16">
              <AlertTriangle className="h-7 w-7 text-amber-500 sm:h-8 sm:w-8" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-gray-100">
              Videochamada indisponível
            </h2>
            <p className="mb-6 text-sm text-gray-400">
              {error || 'O link da videochamada não está disponível.'}
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate(`/pedidos/${requestId}`)}
                className="w-full gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"
              >
                <ArrowLeft className="h-4 w-4" /> Ver detalhes
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/consultas')}
                className="w-full border-white/10 text-gray-300 hover:bg-white/5"
              >
                Voltar às consultas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] h-screen flex-col overflow-hidden bg-[#0B1120]">
      {/* -- Top Bar -- */}
      <VideoTopBar
        consultationStarted={consultationStarted}
        timerSeconds={timerSeconds}
        contractedMinutes={contractedMinutes}
        patientName={request?.patientName}
        roomUrl={roomUrl}
        signalConnected={signalConnected}
        timeExceeded={!!timeExceeded}
        timeWarning={!!timeWarning}
        onFinish={() => setFinishDialogOpen(true)}
        onBack={() => navigate(`/pedidos/${requestId}`)}
      />

      {/* LGPD: aviso de gravação */}
      {!lgpdDismissed && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
          <Video className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span className="flex-1 text-xs font-medium text-amber-200">
            Esta consulta está sendo gravada e transcrita para fins de
            prontuário, conforme LGPD.
          </span>
          <button
            onClick={() => setLgpdDismissed(true)}
            className="text-white/40 transition-colors hover:text-white/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* -- Main Content: Video + AI Panel -- */}
      {/* flex-col on small screens for responsive layout */}
      <div className="flex min-h-0 flex-1 overflow-hidden max-md:flex-col">
        <VideoFrameDaily
          roomUrl={roomUrl}
          meetingToken={meetingToken}
          requestId={requestId ?? null}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onCallJoined={handleIframeLoad}
          onCallLeft={handleCallLeft}
          consultationActive={consultationStarted}
        />

        {/* -- AI Clinical Panel -- */}
        {/* Responsive: full width on small screens, percentage width on desktop */}
        <div
          className={`flex flex-col border-l border-white/5 bg-[#15202E] transition-all duration-300 ${
            isExpanded ? 'w-[60%]' : 'w-[40%]'
          } min-h-0 max-md:!w-full max-md:flex-1 max-md:border-l-0 max-md:border-t max-md:border-white/5`}
        >
          {/* Patient alerts */}
          {patient?.allergies && patient.allergies.length > 0 && (
            <div className="flex shrink-0 items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-3 py-2 sm:px-4">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="truncate text-xs font-medium text-red-300">
                Alergias: {patient.allergies.join(', ')}
              </span>
            </div>
          )}

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="h-auto shrink-0 flex-wrap gap-1 rounded-none border-b border-white/5 bg-[#0B1120]/50 px-2 py-1.5">
              <TabsTrigger
                value="consulta"
                className="h-auto gap-1 px-2.5 py-1.5 text-[11px] data-[state=active]:bg-[#8B5CF6] data-[state=active]:text-white sm:gap-1.5 sm:text-xs"
              >
                <Brain className="h-3 w-3" /> Consulta
                {filledFields > 0 && (
                  <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-[#8B5CF6]">
                    {filledFields}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="h-auto gap-1 px-2.5 py-1.5 text-[11px] data-[state=active]:bg-[#8B5CF6] data-[state=active]:text-white sm:gap-1.5 sm:text-xs"
              >
                <MessageSquare className="h-3 w-3" /> Notas
              </TabsTrigger>
            </TabsList>

            {/* -- Consulta Tab (full DoctorAIPanel) -- */}
            <TabsContent
              value="consulta"
              className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <DoctorAIPanel
                anamnesis={parsedAnamnesis}
                suggestions={normalizedSuggestions}
                evidence={
                  evidence as import('@/components/doctor/video/ai-panel/types').EvidenceItem[]
                }
                consultationType={request?.consultationType}
              />
            </TabsContent>

            {/* -- Notes Tab -- */}
            <TabsContent
              value="notes"
              className="m-0 flex-1 overflow-auto p-3 sm:p-4"
            >
              <div className="flex h-full flex-col space-y-3 sm:space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
                    Notas do Médico / Conduta
                  </p>
                  <p className="mb-3 text-[10px] text-gray-600">
                    Suas notas são salvas no prontuário eletrônico. A IA pode
                    ter gerado um rascunho baseado na consulta.
                  </p>
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/10 p-2.5 sm:mb-4 sm:p-3">
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5CF6]" />
                    <p className="text-xs text-gray-300">
                      Oriente o paciente sobre como usar cada medicamento (dose,
                      horários, duração) e quando retornar.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Anotações sobre a consulta, conduta médica, orientações ao paciente..."
                  className="min-h-[150px] flex-1 resize-none border-white/10 bg-[#0B1120] text-gray-200 placeholder:text-gray-600 focus:border-[#8B5CF6]/50 focus:ring-[#8B5CF6]/20 sm:min-h-[200px]"
                />
                <Button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="w-full gap-2 border border-[#8B5CF6]/30 bg-[#8B5CF6]/20 text-[#8B5CF6] hover:bg-[#8B5CF6]/30"
                  variant="outline"
                >
                  {savingNotes ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar notas no prontuário
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* -- Finish Dialog -- */}
      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent className="border-white/10 bg-[#15202E] text-gray-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-100">
              <PhoneOff className="h-5 w-5 text-red-500" />
              Encerrar Consulta
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Deseja finalizar a videoconsulta? Todos os dados (transcrição,
              anamnese, sugestões) serão salvos no prontuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Summary of what was captured */}
            <ConsultationStats
              timerSeconds={timerSeconds}
              transcriptLength={transcript.length}
              filledAnamnesisFields={filledFields}
              suggestionsCount={suggestions.length}
            />

            {/* CFM compliance notice */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 text-xs">
              <div className="mb-1 flex items-center gap-2 font-semibold text-blue-300">
                <Shield className="h-3.5 w-3.5" />
                Conformidade CFM 2.454/2026
              </div>
              <p className="text-blue-400/80">
                Todos os dados de IA (transcrição, anamnese, sugestões) são
                registrados com rastreabilidade completa. A decisão clínica
                final é de responsabilidade do médico.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setFinishDialogOpen(false)}
              className="text-gray-400 hover:bg-white/5 hover:text-gray-200"
            >
              Continuar consulta
            </Button>
            <Button
              onClick={handleFinish}
              disabled={finishing}
              className="gap-2 bg-red-600 text-white hover:bg-red-700"
            >
              {finishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4" />
              )}
              Finalizar consulta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
