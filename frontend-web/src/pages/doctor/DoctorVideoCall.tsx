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
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  getRequestById, getJoinToken, startConsultation, reportCallConnected,
  finishConsultation, saveConsultationSummary, getPatientProfile,
  type MedicalRequest, type PatientProfile,
} from '@/services/doctorApi';
import { useVideoSignaling } from '@/hooks/useSignalR';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, Brain, Mic, AlertTriangle,
  Save, PhoneOff, Shield,
  MessageSquare,
} from 'lucide-react';
import { VideoTopBar } from '@/components/doctor/video/VideoControls';
import { VideoFrameDaily } from '@/components/doctor/video/VideoFrameDaily';
import { TranscriptionPanel } from '@/components/doctor/video/TranscriptionPanel';
import { ConsultationStats } from '@/components/doctor/video/ConsultationStats';
import { DoctorAIPanel } from '@/components/doctor/video/DoctorAIPanel';

export default function DoctorVideoCall() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Consulta em andamento — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, []);

  const [request, setRequest] = useState<MedicalRequest | null>(null);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Consultation state
  const [consultationStarted, setConsultationStarted] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const [contractedMinutes, setContractedMinutes] = useState<number | null>(null);

  // AI panel: transcript | consulta (full DoctorAIPanel) | notes
  const [activeTab, setActiveTab] = useState('transcript');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Finish dialog
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // SignalR real-time
  const { connected: signalConnected, transcript, anamnesis, suggestions, evidence } = useVideoSignaling(requestId);

  // Parse anamnesis JSON (full object for DoctorAIPanel)
  const parsedAnamnesis: Record<string, unknown> | null = (() => {
    if (!anamnesis) return null;
    try { return JSON.parse(anamnesis) as Record<string, unknown>; }
    catch { return null; }
  })();

  // Count filled anamnesis fields (for stats)
  const filledFields = parsedAnamnesis
    ? Object.entries(parsedAnamnesis).filter(([, v]) => {
        if (v == null) return false;
        if (Array.isArray(v)) return v.some((x) => x && String(x).trim().length > 0);
        return String(v).trim().length > 0;
      }).length
    : 0;

  // Normalize evidence for DoctorAIPanel (backend may send PascalCase)
  const normalizedEvidence = (evidence as { title?: string; Title?: string; [k: string]: unknown }[]).map((e) => ({
    title: String(e.title ?? e.Title ?? ''),
    abstract: String(e.abstract ?? e.Abstract ?? ''),
    source: String(e.source ?? e.Source ?? ''),
    translatedAbstract: (e.translatedAbstract ?? e.TranslatedAbstract) as string | undefined,
    relevantExcerpts: (e.relevantExcerpts ?? e.RelevantExcerpts) as string[] | undefined,
    clinicalRelevance: (e.clinicalRelevance ?? e.ClinicalRelevance) as string | undefined,
    provider: String(e.provider ?? e.Provider ?? 'PubMed'),
    url: (e.url ?? e.Url) as string | undefined,
    conexaoComPaciente: (e.conexaoComPaciente ?? e.ConexaoComPaciente) as string | undefined,
    nivelEvidencia: (e.nivelEvidencia ?? e.NivelEvidencia) as string | undefined,
    motivoSelecao: (e.motivoSelecao ?? e.MotivoSelecao) as string | undefined,
  }));

  const normalizedSuggestions = (suggestions as unknown[]).map((s) =>
    typeof s === 'string' ? s : { text: (s as { text?: string }).text, suggestion: (s as { suggestion?: string }).suggestion }
  );

  // Timer
  useEffect(() => {
    if (consultationStarted) {
      timerRef.current = setInterval(() => setTimerSeconds(prev => prev + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [consultationStarted]);

  // Load data
  useEffect(() => {
    if (!requestId) return;
    setLoading(true);

    (async () => {
      try {
        const data = await getRequestById(requestId);
        setRequest(data);
        setContractedMinutes(data.contractedMinutes ?? null);

        if (data.patientId) {
          try { setPatient(await getPatientProfile(data.patientId)); } catch { /* paciente opcional */ }
        }

        // Start consultation if not already
        const needsStart = ['paid', 'consultation_ready'].some(
          s => data.status?.toLowerCase().includes(s.toLowerCase())
        );
        if (needsStart) {
          try {
            const result = await startConsultation(requestId);
            if (result.chronicWarning) {
              toast.warning(result.chronicWarning, { duration: 8000 });
            }
            setConsultationStarted(true);
          } catch { /* startConsultation já iniciado */ }
        } else if (data.status?.toLowerCase().includes('in_consultation')) {
          setConsultationStarted(true);
          // Recover timer if consultation already started
          if (data.consultationStartedAt) {
            const elapsed = Math.floor((Date.now() - new Date(data.consultationStartedAt).getTime()) / 1000);
            setTimerSeconds(Math.max(0, elapsed));
          }
        }

        // Get video room token
        try {
          const tokenData = await getJoinToken(requestId);
          setRoomUrl(tokenData.roomUrl ? `${tokenData.roomUrl}?t=${tokenData.token}` : null);
          setContractedMinutes(tokenData.contractedMinutes ?? data.contractedMinutes ?? null);
        } catch {
          if (data.videoRoomUrl) {
            setRoomUrl(data.videoRoomUrl);
          } else {
            setError('Não foi possível obter o link da videochamada');
          }
        }
      } catch {
        setError('Erro ao carregar dados da consulta');
      } finally {
        setLoading(false);
      }
    })();
  }, [requestId]);

  // Report call connected when iframe loads
  const handleIframeLoad = useCallback(() => {
    if (requestId) {
      reportCallConnected(requestId).catch(() => {});
    }
  }, [requestId]);

  // Save notes
  const handleSaveNotes = async () => {
    if (!requestId) return;
    setSavingNotes(true);
    try {
      await saveConsultationSummary(requestId, {
        anamnesis: parsedAnamnesis ? JSON.stringify(parsedAnamnesis as Record<string, unknown>) : undefined,
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
          anamnesis: parsedAnamnesis ? JSON.stringify(parsedAnamnesis as Record<string, unknown>) : undefined,
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
  const timeWarning = contractedMinutes && timerSeconds > contractedMinutes * 60 * 0.8;
  const timeExceeded = contractedMinutes && timerSeconds > contractedMinutes * 60;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-400">Preparando consulta inteligente...</p>
          <p className="text-gray-600 text-xs mt-2">Conectando IA clínica, transcrição e vídeo</p>
        </div>
      </div>
    );
  }

  if (error || !roomUrl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold mb-2">Videochamada indisponível</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {error || 'O link da videochamada não está disponível.'}
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate(`/pedidos/${requestId}`)} className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" /> Ver detalhes
              </Button>
              <Button variant="outline" onClick={() => navigate('/consultas')} className="w-full">
                Voltar às consultas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ── Top Bar ── */}
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

      {/* ── Main Content: Video + AI Panel ── */}
      <div className="flex-1 flex overflow-hidden">
        <VideoFrameDaily
          roomUrl={roomUrl}
          requestId={requestId ?? null}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onCallJoined={handleIframeLoad}
          consultationActive={consultationStarted}
        />

        {/* ── AI Clinical Panel ── */}
        <div className={`bg-gray-900 border-l border-gray-800 flex flex-col transition-all duration-300 ${isExpanded ? 'w-[60%]' : 'w-[40%]'}`}>
          {/* Patient alerts */}
          {patient?.allergies && patient.allergies.length > 0 && (
            <div className="px-4 py-2 bg-red-950/50 border-b border-red-900/50 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="text-xs text-red-300 font-medium">
                Alergias: {patient.allergies.join(', ')}
              </span>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="bg-gray-800/50 border-b border-gray-800 rounded-none px-2 shrink-0 flex-wrap">
              <TabsTrigger value="transcript" className="text-xs gap-1.5 data-[state=active]:bg-gray-700">
                <Mic className="h-3 w-3" /> Transcrição
                {transcript.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[9px]">
                    LIVE
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="consulta" className="text-xs gap-1.5 data-[state=active]:bg-gray-700">
                <Brain className="h-3 w-3" /> Consulta
                {filledFields > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px]">
                    {filledFields}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1.5 data-[state=active]:bg-gray-700">
                <MessageSquare className="h-3 w-3" /> Notas
              </TabsTrigger>
            </TabsList>

            {/* ── Transcript Tab ── */}
            <TabsContent value="transcript" className="flex-1 overflow-auto p-4 m-0 min-h-0">
              <TranscriptionPanel transcript={transcript} />
            </TabsContent>

            {/* ── Consulta Tab (full DoctorAIPanel: gravidade, CID, alertas, diferencial, anamnese, meds, exames, orientações, perguntas, evidências) ── */}
            <TabsContent value="consulta" className="flex-1 flex flex-col m-0 min-h-0 overflow-hidden">
              <DoctorAIPanel
                anamnesis={parsedAnamnesis}
                suggestions={normalizedSuggestions}
                evidence={normalizedEvidence}
              />
            </TabsContent>

            {/* ── Notes Tab ── */}
            <TabsContent value="notes" className="flex-1 overflow-auto p-4 m-0">
              <div className="space-y-4 h-full flex flex-col">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                    Notas do Médico / Conduta
                  </p>
                  <p className="text-[10px] text-gray-600 mb-3">
                    Suas notas são salvas no prontuário eletrônico. A IA pode ter gerado um rascunho baseado na consulta.
                  </p>
                  <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-300">
                      Oriente o paciente sobre como usar cada medicamento (dose, horários, duração) e quando retornar.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={doctorNotes}
                  onChange={e => setDoctorNotes(e.target.value)}
                  placeholder="Anotações sobre a consulta, conduta médica, orientações ao paciente..."
                  className="flex-1 min-h-[200px] bg-gray-800 border-gray-700 text-gray-200 placeholder:text-gray-600 resize-none"
                />
                <Button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="gap-2 w-full"
                  variant="outline"
                >
                  {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar notas no prontuário
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Finish Dialog ── */}
      <Dialog open={finishDialogOpen} onOpenChange={setFinishDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneOff className="h-5 w-5 text-red-500" />
              Encerrar Consulta
            </DialogTitle>
            <DialogDescription>
              Deseja finalizar a videoconsulta? Todos os dados (transcrição, anamnese, sugestões) serão salvos no prontuário.
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
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs">
              <div className="flex items-center gap-2 font-semibold text-blue-700 dark:text-blue-300 mb-1">
                <Shield className="h-3.5 w-3.5" />
                Conformidade CFM 2.454/2026
              </div>
              <p className="text-blue-600 dark:text-blue-400">
                Todos os dados de IA (transcrição, anamnese, sugestões) são registrados com rastreabilidade completa.
                A decisão clínica final é de responsabilidade do médico.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFinishDialogOpen(false)}>Continuar consulta</Button>
            <Button
              onClick={handleFinish}
              disabled={finishing}
              className="gap-2 bg-red-600 hover:bg-red-700"
            >
              {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
              Finalizar consulta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
