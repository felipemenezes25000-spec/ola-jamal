/**
 * DoctorVideoCall — Tela de Videoconsulta Inteligente
 *
 * Layout split-screen:
 * - Esquerda: iframe Daily.co com vídeo
 * - Direita: Painel clínico com IA em tempo real
 *   - Timer da consulta
 *   - Transcrição ao vivo (Whisper)
 *   - Anamnese estruturada (GPT-4o)
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
import { Badge } from '@/components/ui/badge';
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
import { motion } from 'framer-motion';
import {
  Loader2, ArrowLeft, User, ExternalLink, FileText,
  Brain, Mic, Sparkles, AlertTriangle,
  CheckCircle2, Save, PhoneOff, Heart, Activity,
  Stethoscope, Shield,
  MessageSquare, Lightbulb, GraduationCap,
} from 'lucide-react';
import { VideoTopBar, VideoFrame } from '@/components/doctor/video/VideoControls';
import { TranscriptionPanel } from '@/components/doctor/video/TranscriptionPanel';
import { ConsultationStats } from '@/components/doctor/video/ConsultationStats';

interface AnamnesisData {
  queixa_principal?: string;
  historia_doenca_atual?: string;
  antecedentes_pessoais?: string;
  medicamentos_em_uso?: string;
  alergias?: string;
  habitos?: string;
  exame_fisico_observacional?: string;
  hipoteses_diagnosticas?: string;
  conduta_sugerida?: string;
  [key: string]: string | undefined;
}

const ANAMNESIS_LABELS: Record<string, { label: string; icon: typeof Heart }> = {
  queixa_principal: { label: 'Queixa Principal', icon: AlertTriangle },
  historia_doenca_atual: { label: 'HDA', icon: FileText },
  antecedentes_pessoais: { label: 'Antecedentes', icon: Heart },
  medicamentos_em_uso: { label: 'Medicamentos', icon: Activity },
  alergias: { label: 'Alergias', icon: AlertTriangle },
  habitos: { label: 'Hábitos', icon: User },
  exame_fisico_observacional: { label: 'Exame Observacional', icon: Stethoscope },
  hipoteses_diagnosticas: { label: 'Hipóteses', icon: Brain },
  conduta_sugerida: { label: 'Conduta Sugerida', icon: Lightbulb },
};

export default function DoctorVideoCall() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

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

  // AI panel
  const [activeTab, setActiveTab] = useState('transcript');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Finish dialog
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // SignalR real-time
  const { connected: signalConnected, transcript, anamnesis, suggestions, evidence } = useVideoSignaling(requestId);

  // Parse anamnesis JSON
  const parsedAnamnesis: AnamnesisData | null = (() => {
    if (!anamnesis) return null;
    try { return JSON.parse(anamnesis); }
    catch { return null; }
  })();

  // Count filled anamnesis fields
  const filledFields = parsedAnamnesis
    ? Object.entries(parsedAnamnesis).filter(([, v]) => v && String(v).trim().length > 0).length
    : 0;

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
        const needsStart = ['paid', 'consultation_accepted', 'consultation_ready'].some(
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
        anamnesis: parsedAnamnesis ? JSON.stringify(parsedAnamnesis) : undefined,
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
          anamnesis: parsedAnamnesis ? JSON.stringify(parsedAnamnesis) : undefined,
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
        <VideoFrame
          roomUrl={roomUrl}
          isExpanded={isExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onIframeLoad={handleIframeLoad}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="bg-gray-800/50 border-b border-gray-800 rounded-none px-2 shrink-0">
              <TabsTrigger value="transcript" className="text-xs gap-1.5 data-[state=active]:bg-gray-700">
                <Mic className="h-3 w-3" /> Transcrição
                {transcript.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 text-[9px]">
                    LIVE
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="anamnesis" className="text-xs gap-1.5 data-[state=active]:bg-gray-700">
                <Brain className="h-3 w-3" /> Anamnese
                {filledFields > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px]">
                    {filledFields}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="suggestions" className="text-xs gap-1.5 data-[state=active]:bg-gray-700">
                <Lightbulb className="h-3 w-3" /> Sugestões
                {suggestions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-900/50 text-amber-400 text-[9px]">
                    {suggestions.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs gap-1.5 data-[state=active]:bg-gray-700">
                <MessageSquare className="h-3 w-3" /> Notas
              </TabsTrigger>
            </TabsList>

            {/* ── Transcript Tab ── */}
            <TabsContent value="transcript" className="flex-1 overflow-auto p-4 m-0">
              <TranscriptionPanel transcript={transcript} />
            </TabsContent>

            {/* ── Anamnesis Tab ── */}
            <TabsContent value="anamnesis" className="flex-1 overflow-auto p-4 m-0">
              {!parsedAnamnesis ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
                    <Brain className="h-8 w-8 text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">Anamnese será gerada automaticamente</p>
                  <p className="text-xs text-gray-600 mt-1 max-w-xs">
                    Após 200 caracteres de transcrição, a IA começa a estruturar
                    a anamnese em tempo real com GPT-4o.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                      Anamnese Estruturada por IA
                    </p>
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-800 gap-1">
                      <Sparkles className="h-2.5 w-2.5" /> Auto-atualizada
                    </Badge>
                  </div>
                  {Object.entries(ANAMNESIS_LABELS).map(([key, { label, icon: Icon }]) => {
                    const value = parsedAnamnesis[key];
                    if (!value) return null;
                    return (
                      <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-xl bg-gray-800/50 border border-gray-800"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                            {label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed">{value}</p>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Suggestions Tab ── */}
            <TabsContent value="suggestions" className="flex-1 overflow-auto p-4 m-0">
              {suggestions.length === 0 && evidence.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
                    <Lightbulb className="h-8 w-8 text-gray-600" />
                  </div>
                  <p className="text-sm text-gray-400 font-medium">Sugestões aparecerão aqui</p>
                  <p className="text-xs text-gray-600 mt-1 max-w-xs">
                    A IA analisa a consulta e sugere perguntas, exames e condutas baseadas em evidências.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
                        Sugestões da IA
                      </p>
                      <div className="space-y-2">
                        {(suggestions as (string | { text?: string; suggestion?: string })[]).map((s, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/30"
                          >
                            <div className="flex items-start gap-2">
                              <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                              <p className="text-sm text-gray-300">{typeof s === 'string' ? s : s.text || s.suggestion || JSON.stringify(s)}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {evidence.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3 flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5" /> Evidências Científicas
                      </p>
                      <div className="space-y-2">
                        {(evidence as { title?: string; source?: string; provider?: string; translatedAbstract?: string; clinicalRelevance?: string; url?: string }[]).map((e, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-3 rounded-xl bg-blue-950/30 border border-blue-900/30"
                          >
                            <p className="text-sm font-medium text-blue-300 mb-1">{e.title}</p>
                            {e.source && (
                              <p className="text-[10px] text-blue-500 mb-1.5">{e.source} • {e.provider}</p>
                            )}
                            {e.translatedAbstract && (
                              <p className="text-xs text-gray-400 line-clamp-3">{e.translatedAbstract}</p>
                            )}
                            {e.clinicalRelevance && (
                              <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> {e.clinicalRelevance}
                              </p>
                            )}
                            {e.url && (
                              <a href={e.url} target="_blank" rel="noreferrer"
                                className="text-[10px] text-blue-400 hover:underline mt-1 inline-flex items-center gap-1">
                                Ver fonte <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
