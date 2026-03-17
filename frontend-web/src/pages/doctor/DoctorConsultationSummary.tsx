/**
 * Resumo da Consulta — Exibido após o médico encerrar a videochamada.
 * Alinhado ao mobile: anamnese, sugestões IA, transcrição, nota clínica editável.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getRequestById, saveConsultationSummary } from '@/services/doctorApi';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, FileText, Lightbulb, Mic, Copy, CheckCircle2,
  Sparkles, AlertTriangle,
} from 'lucide-react';

function parseAnamnesis(json: string | null | undefined): Record<string, unknown> | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseSuggestions(json: string | null | undefined): string[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export default function DoctorConsultationSummary() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<Awaited<ReturnType<typeof getRequestById>> | null>(null);
  const [clinicalNote, setClinicalNote] = useState('');
  const [expandedTranscript, setExpandedTranscript] = useState(false);
  const [copied, setCopied] = useState(false);
  const initialSaveDone = useRef(false);

  const anamnesis = parseAnamnesis(request?.consultationAnamnesis);
  const suggestions = parseSuggestions(request?.consultationAiSuggestions);
  const transcript = request?.consultationTranscript ?? '';
  const hasAnamnesis = anamnesis && Object.keys(anamnesis).length > 0;
  const hasSuggestions = suggestions.length > 0;
  const hasTranscript = transcript.length > 0;

  const saveToRecord = useCallback(async (anamnesisJson: string | null, plan: string) => {
    if (!requestId) return;
    try {
      await saveConsultationSummary(requestId, {
        anamnesis: anamnesisJson ?? undefined,
        plan: plan.trim() || undefined,
      });
    } catch {
      // Silencioso
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    getRequestById(requestId)
      .then((r) => {
        setRequest(r);
        setClinicalNote(r.notes ?? '');
      })
      .catch(() => {
        toast.error('Não foi possível carregar o resumo');
        navigate('/consultas');
      })
      .finally(() => setLoading(false));
  }, [requestId, navigate]);

  useEffect(() => {
    if (!request || !requestId || initialSaveDone.current) return;
    initialSaveDone.current = true;
    saveToRecord(request.consultationAnamnesis ?? null, request.notes ?? '');
  }, [request, requestId, saveToRecord]);

  const handleCopy = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success('Transcrição copiada');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNoteChange = (v: string) => {
    setClinicalNote(v);
  };

  const handleSaveNote = async () => {
    if (!requestId) return;
    try {
      await saveToRecord(request?.consultationAnamnesis ?? null, clinicalNote);
      toast.success('Nota salva');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  if (loading) {
    return (
      <DoctorLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Carregando resumo...</p>
        </div>
      </DoctorLayout>
    );
  }

  if (!request) {
    return (
      <DoctorLayout>
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Consulta não encontrada</p>
          <Button onClick={() => navigate('/consultas')}>Voltar</Button>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/pedidos/${requestId}`)} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Resumo da Consulta</h1>
              <p className="text-sm text-muted-foreground">{request.patientName ?? 'Paciente'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">IA</span>
          </div>
        </div>

        {/* Anamnese */}
        {hasAnamnesis && anamnesis && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Anamnese estruturada
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(anamnesis, null, 2)}
            </CardContent>
          </Card>
        )}

        {/* Sugestões IA */}
        {hasSuggestions && (
          <Card className="shadow-sm border-amber-200/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                <Lightbulb className="h-4 w-4" /> Sugestões clínicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions.map((s, i) => {
                const isDanger = s.startsWith('🚨');
                return (
                  <div key={i} className={`flex gap-2 p-3 rounded-lg ${isDanger ? 'bg-destructive/10' : 'bg-amber-50'}`}>
                    {isDanger ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> : <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                    <p className={`text-sm ${isDanger ? 'text-destructive' : 'text-amber-800'}`}>{s.replace('🚨 ', '')}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Nota clínica editável */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Nota clínica
            </CardTitle>
            <p className="text-xs text-muted-foreground">Salva automaticamente no prontuário</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={clinicalNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Digite ou edite a nota clínica..."
              className="min-h-[100px]"
            />
            <Button size="sm" onClick={handleSaveNote}>Salvar nota</Button>
          </CardContent>
        </Card>

        {/* Transcrição */}
        {hasTranscript && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4" /> Transcrição
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </CardHeader>
            <CardContent>
              <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!expandedTranscript ? 'line-clamp-8' : ''}`}>
                {transcript}
              </p>
              {!expandedTranscript && transcript.length > 300 && (
                <Button variant="link" size="sm" className="mt-2 p-0 h-auto" onClick={() => setExpandedTranscript(true)}>
                  Expandir...
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!hasAnamnesis && !hasSuggestions && !hasTranscript && (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">Sem dados da IA</p>
              <p className="text-xs text-muted-foreground mt-1">A transcrição e anamnese não foram geradas. Verifique se a gravação foi iniciada.</p>
            </CardContent>
          </Card>
        )}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>Conteúdo gerado por IA como apoio à decisão clínica. A revisão e validação médica são obrigatórias. Conformidade com CFM Resolução 2.299/2021.</p>
        </div>

        <Button className="w-full gap-2" onClick={() => navigate(`/pos-consulta/${requestId}`)}>
          <FileText className="h-4 w-4" /> Emitir documentos
        </Button>
        <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/pedidos/${requestId}`)}>
          <CheckCircle2 className="h-4 w-4" /> Concluir sem emitir
        </Button>
      </div>
    </DoctorLayout>
  );
}
