import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  getPatientProfile, getPatientRequests, getPatientClinicalSummary, addDoctorNote,
  type PatientProfile, type MedicalRequest, type DoctorNoteDto,
  DOCTOR_NOTE_TYPES,
} from '@/services/doctorApi';
import { getTypeIcon, getTypeLabel, getStatusInfo } from '@/lib/doctor-helpers';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, ArrowLeft, User, Phone, Mail, Heart,
  AlertTriangle, FileText, FlaskConical, Stethoscope, Clock,
  ChevronRight, Activity, Shield, ShieldCheck, FileStack, StickyNote, PlusCircle, Eye, Info,
} from 'lucide-react';

type AlertCategory = 'allergy' | 'lacuna' | 'critical';

function parseAlertText(text: string): { category: AlertCategory; cleanText: string; isPositive: boolean } {
  const clean = text
    .replace(/^(?:\u{1F534}|\u{1F7E2}|\u{2139}\u{FE0F}?|\u{26A0}\u{FE0F}?|\u{1F6A8})\s*/gu, '')
    .replace(/^\[ALERGIA\]\s*/i, '')
    .replace(/^\[LACUNA\]\s*/i, '')
    .trim();

  const isAllergy = text.includes('[ALERGIA]');
  const isLacuna = text.includes('[LACUNA]');
  const isPositiveAllergy =
    isAllergy && /nkda|nenhuma|sem alergia|não informada|desconhecida|sem alergias conhecidas|no known/i.test(clean);

  return {
    category: isAllergy ? 'allergy' : isLacuna ? 'lacuna' : 'critical',
    cleanText: clean,
    isPositive: isPositiveAllergy,
  };
}

function ClinicalNotesForm({
  requests,
  onAdd,
}: {
  requests: MedicalRequest[];
  onAdd: (noteType: string, content: string, requestId?: string) => Promise<void>;
}) {
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('progress_note');
  const [linkedRequestId, setLinkedRequestId] = useState<string | undefined>();
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setAdding(true);
    try {
      await onAdd(noteType, content, linkedRequestId);
      setContent('');
      setLinkedRequestId(undefined);
    } finally {
      setAdding(false);
    }
  };

  const sortedRequests = useMemo(() => [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8), [requests]);

  return (
    <Card className="shadow-sm border-l-4 border-l-violet-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Nova nota clinica</CardTitle>
        <p className="text-xs text-muted-foreground">Registro de SOAP, impressoes e observacoes</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase">Tipo da nota</p>
            <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Tipo da nota">
              {DOCTOR_NOTE_TYPES.map(t => (
                <Button
                  key={t.key}
                  type="button"
                  variant={noteType === t.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNoteType(t.key)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="doctor-note-content" className="text-xs font-medium text-muted-foreground uppercase">Conteudo</label>
            <Textarea
              id="doctor-note-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Ex: Opto por associar medicacao X ao esquema atual..."
              className="mt-2 min-h-[88px]"
            />
          </div>
          {sortedRequests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">Vincular a atendimento (opcional)</p>
              <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Vincular a atendimento">
                <Button type="button" variant={!linkedRequestId ? 'default' : 'outline'} size="sm" onClick={() => setLinkedRequestId(undefined)}>Nenhum</Button>
                {sortedRequests.map(r => {
                  const reqType = r.type || (r as { requestType?: string }).requestType || '';
                  return (
                    <Button key={r.id} type="button" variant={linkedRequestId === r.id ? 'default' : 'outline'} size="sm" onClick={() => setLinkedRequestId(linkedRequestId === r.id ? undefined : r.id)}>
                      {getTypeLabel(reqType)} · {new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
          <Button type="submit" disabled={!content.trim() || adding} className="gap-2">
            {adding && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar nota
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function DoctorPatientRecord() {
  const { patientId } = useParams<{ patientId: string }>();

  useEffect(() => {
    document.title = 'Prontuario — RenoveJa+';
    return () => { document.title = 'RenoveJa+'; };
  }, []);
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [summaryData, setSummaryData] = useState<{ structured?: { problemList?: string[]; activeMedications?: string[]; narrativeSummary?: string; alerts?: string[] } | null; doctorNotes?: DoctorNoteDto[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [p, r, s] = await Promise.all([
        getPatientProfile(patientId),
        getPatientRequests(patientId).catch(() => []),
        getPatientClinicalSummary(patientId).catch(() => null),
      ]);
      setPatient(p);
      setRequests(Array.isArray(r) ? r : []);
      setSummaryData(s ? { structured: s.structured ?? null, doctorNotes: s.doctorNotes ?? [] } : null);
    } catch {
      toast.error('Erro ao carregar prontuario');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const age = useMemo(() => {
    if (!patient?.birthDate) return null;
    const nowMs = Date.now();
    return Math.floor((nowMs - new Date(patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }, [patient?.birthDate]);

  const handleAddNote = useCallback(async (noteType: string, content: string, requestId?: string) => {
    if (!patientId || !content.trim()) return;
    try {
      const note = await addDoctorNote(patientId, { noteType, content: content.trim(), requestId });
      setSummaryData(prev => ({
        ...(prev ?? {}),
        doctorNotes: [note, ...(prev?.doctorNotes ?? [])],
      }));
      toast.success('Nota registrada');
    } catch {
      toast.error('Nao foi possivel registrar a nota');
    }
  }, [patientId]);

  const prescriptions = requests.filter(r => r.type === 'prescription');
  const examsReqs = requests.filter(r => r.type === 'exam');
  const consultations = requests.filter(r => r.type === 'consultation');
  const doctorNotes = summaryData?.doctorNotes ?? [];
  const documentsCount = prescriptions.length + examsReqs.length;
  const activeMedications = summaryData?.structured?.activeMedications ?? [];

  const getNoteIcon = (key: string) => {
    const t = DOCTOR_NOTE_TYPES.find(x => x.key === key);
    if (t?.icon === 'Stethoscope') return Stethoscope;
    if (t?.icon === 'PlusCircle') return PlusCircle;
    if (t?.icon === 'Eye') return Eye;
    return FileText;
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

  if (!patient) {
    return (
      <DoctorLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Paciente nao encontrado</p>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mt-4">Voltar</Button>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="space-y-4 sm:space-y-6 max-w-5xl mx-auto px-2 sm:px-0">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Prontuario</h1>
        </div>

        {/* Patient identity card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-[52px] h-[52px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 overflow-hidden relative">
                  <User className="h-6 w-6 text-primary" />
                  {patient.avatarUrl && (
                    <img src={patient.avatarUrl} alt={patient.name} className="absolute inset-0 w-[52px] h-[52px] rounded-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base sm:text-lg font-bold truncate">{patient.name}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {age !== null && <span>{age} anos</span>}
                    {age !== null && patient.gender && <span className="hidden sm:inline">·</span>}
                    {patient.gender && (
                      <span>
                        {patient.gender === 'male' ? 'Masculino' : patient.gender === 'female' ? 'Feminino' : patient.gender}
                      </span>
                    )}
                    {'cpf' in patient && (patient as unknown as { cpf?: string }).cpf && (
                      <>
                        <span className="hidden sm:inline">·</span>
                        <span>CPF ***</span>
                      </>
                    )}
                  </p>
                  {/* Contact info - visible on larger screens */}
                  <div className="hidden sm:flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                    {patient.email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {patient.email}</span>
                    )}
                    {patient.phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {patient.phone}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact info - mobile only */}
              <div className="flex sm:hidden flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                {patient.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> <span className="truncate max-w-[180px]">{patient.email}</span></span>
                )}
                {patient.phone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {patient.phone}</span>
                )}
              </div>

              {/* Allergy banner */}
              {patient.allergies && patient.allergies.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm mt-4">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <span className="font-semibold text-red-700">Alergia:</span>{' '}
                    <span className="text-red-600">{patient.allergies.join(', ')}</span>
                  </div>
                </div>
              )}

              {/* Chronic conditions banner */}
              {patient.chronicConditions && patient.chronicConditions.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm mt-2">
                  <Heart className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <span className="font-semibold text-amber-700">Condicoes cronicas:</span>{' '}
                    <span className="text-amber-600">{patient.chronicConditions.join(', ')}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs with horizontal scroll on mobile */}
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0 scrollbar-none">
            <TabsList className="w-max sm:w-full justify-start h-auto gap-0 bg-transparent border-b border-border rounded-none p-0">
              <TabsTrigger
                value="overview"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap"
              >
                <Activity className="h-3.5 w-3.5 hidden sm:block" /> Visao Geral
              </TabsTrigger>
              <TabsTrigger
                value="consultations"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap"
              >
                <Stethoscope className="h-3.5 w-3.5 hidden sm:block" /> Consultas ({consultations.length})
              </TabsTrigger>
              <TabsTrigger
                value="documents"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap"
              >
                <FileStack className="h-3.5 w-3.5 hidden sm:block" /> Docs ({documentsCount})
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap"
              >
                <StickyNote className="h-3.5 w-3.5 hidden sm:block" /> Notas ({doctorNotes.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Overview tab */}
          <TabsContent value="overview">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 mt-4">
              {/* Clinical summary grid: 2x2 on mobile, 4-col on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="shadow-sm">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Peso</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">--</p>
                    <p className="text-[10px] text-muted-foreground">kg</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Altura</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">--</p>
                    <p className="text-[10px] text-muted-foreground">cm</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">IMC</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">--</p>
                    <p className="text-[10px] text-muted-foreground">kg/m2</p>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tipo sanguineo</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1">--</p>
                  </CardContent>
                </Card>
              </div>

              {/* Active conditions as colored chips */}
              {summaryData?.structured?.problemList && summaryData.structured.problemList.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Condicoes ativas</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {summaryData.structured.problemList.map((problem, i) => (
                        <Badge key={i} variant="secondary" className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800">
                          {problem}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active medications list */}
              {activeMedications.length > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Medicamentos em uso</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1.5">
                      {activeMedications.map((med, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{med}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Structured summary (AI) */}
              {summaryData?.structured && (summaryData.structured.narrativeSummary || summaryData.structured.alerts?.length) ? (
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Resumo clinico</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {summaryData.structured.narrativeSummary && (
                      <p className="text-sm text-muted-foreground">{summaryData.structured.narrativeSummary}</p>
                    )}
                    {summaryData.structured.alerts && summaryData.structured.alerts.length > 0 && (() => {
                      const alerts = summaryData.structured!.alerts!;
                      const parsed = alerts.map(a => parseAlertText(a));
                      const allergyAlerts = parsed.filter(p => p.category === 'allergy');
                      const lacunas = parsed.filter(p => p.category === 'lacuna');
                      const criticalAlerts = parsed.filter(p => p.category === 'critical');

                      return (
                        <div className="space-y-3">
                          {allergyAlerts.length > 0 && (
                            <div className="space-y-2">
                              {allergyAlerts.map((a, i) => (
                                <div
                                  key={`allergy-${i}`}
                                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${
                                    a.isPositive
                                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200'
                                      : 'bg-red-50 border-red-100 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200'
                                  }`}
                                >
                                  {a.isPositive ? (
                                    <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-500" aria-hidden />
                                  )}
                                  <span className="break-words min-w-0">{a.isPositive ? `${a.cleanText}` : a.cleanText}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {criticalAlerts.length > 0 && (
                            <div className="space-y-2">
                              {criticalAlerts.map((a, i) => (
                                <div
                                  key={`alert-${i}`}
                                  className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200"
                                >
                                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-500" aria-hidden />
                                  <span className="break-words min-w-0">{a.cleanText}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {lacunas.length > 0 && (
                            <div className="rounded-lg bg-muted/30 p-3">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                <Info className="h-3.5 w-3.5" aria-hidden />
                                Informacoes pendentes
                              </p>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                {lacunas.map((a, i) => (
                                  <li key={`lacuna-${i}`} className="flex gap-2">
                                    <span className="text-muted-foreground/60">·</span>
                                    <span>{a.cleanText}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              ) : null}

              {/* SOAP notes section */}
              {doctorNotes.length > 0 && (
                <Card className="shadow-sm border-l-4 border-l-violet-400">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Notas SOAP recentes</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {doctorNotes.slice(0, 3).map((note) => (
                      <div key={note.id} className="text-sm border-b border-border last:border-0 pb-3 last:pb-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            {(() => { const I = getNoteIcon(note.noteType); return <I className="h-2.5 w-2.5" /> })()}
                            {DOCTOR_NOTE_TYPES.find(t => t.key === note.noteType)?.label ?? note.noteType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground shrink-0">{new Date(note.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2">{note.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Stats grid: 3 cols on desktop, full width stacked on mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3 sm:flex-col sm:text-center sm:p-5">
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary shrink-0" />
                    <div className="sm:mt-1">
                      <p className="text-2xl sm:text-3xl font-bold">{prescriptions.length}</p>
                      <p className="text-xs text-muted-foreground">Receitas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3 sm:flex-col sm:text-center sm:p-5">
                    <FlaskConical className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 shrink-0" />
                    <div className="sm:mt-1">
                      <p className="text-2xl sm:text-3xl font-bold">{examsReqs.length}</p>
                      <p className="text-xs text-muted-foreground">Exames</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardContent className="p-4 flex items-center gap-3 sm:flex-col sm:text-center sm:p-5">
                    <Stethoscope className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-500 shrink-0" />
                    <div className="sm:mt-1">
                      <p className="text-2xl sm:text-3xl font-bold">{consultations.length}</p>
                      <p className="text-xs text-muted-foreground">Consultas</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent requests */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Atendimentos Recentes</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Nenhum atendimento registrado</p>
                  ) : (
                    <div className="space-y-1">
                      {requests
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .slice(0, 10)
                        .map(req => {
                          const reqType = req.type || (req as { requestType?: string }).requestType || '';
                          const Icon = getTypeIcon(reqType);
                          const statusInfo = getStatusInfo(req.status);
                          return (
                            <button
                              key={req.id}
                              onClick={() => navigate(`/pedidos/${req.id}`)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                            >
                              <div className="p-2 rounded-lg bg-muted shrink-0"><Icon className="h-4 w-4 text-muted-foreground" /></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{getTypeLabel(reqType)}</p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3 shrink-0" />
                                  {new Date(req.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                              <Badge variant={statusInfo.variant} className={`text-[10px] shrink-0 ${statusInfo.color} ${statusInfo.bgColor} border`}>
                                {statusInfo.label}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 hidden sm:block" />
                            </button>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Consultations tab */}
          <TabsContent value="consultations">
            <div className="space-y-2 mt-4">
              {consultations.length === 0 ? (
                <Card className="shadow-sm"><CardContent className="py-12 text-center"><Stethoscope className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhuma consulta registrada</p></CardContent></Card>
              ) : (
                [...consultations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(req => {
                  const statusInfo = getStatusInfo(req.status);
                  return (
                    <Card key={req.id} className="shadow-sm hover:shadow-md cursor-pointer transition-all group" onClick={() => navigate(`/pedidos/${req.id}`)}>
                      <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                        <div className="p-2 sm:p-3 rounded-xl bg-muted shrink-0"><Stethoscope className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">Consulta</p>
                          <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <Badge variant={statusInfo.variant} className={`text-[10px] shrink-0 ${statusInfo.color} ${statusInfo.bgColor} border`}>
                          {statusInfo.label}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 hidden sm:block" />
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Documents tab */}
          <TabsContent value="documents">
            <div className="space-y-2 mt-4">
              {documentsCount === 0 ? (
                <Card className="shadow-sm"><CardContent className="py-12 text-center"><FileStack className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhum documento</p></CardContent></Card>
              ) : (
                [...prescriptions, ...examsReqs]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map(req => {
                    const reqType = req.type || (req as { requestType?: string }).requestType || '';
                    const Icon = getTypeIcon(reqType);
                    const items = reqType === 'prescription' ? (req.medications ?? []) : (req.exams ?? []);
                    const statusInfo = getStatusInfo(req.status);
                    return (
                      <Card key={req.id} className="shadow-sm hover:shadow-md cursor-pointer transition-all group" onClick={() => navigate(`/pedidos/${req.id}`)}>
                        <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                          <div className="p-2 sm:p-3 rounded-xl bg-muted shrink-0"><Icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{getTypeLabel(reqType)}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {new Date(req.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              {items.length > 0 ? ` · ${items.length} item(ns)` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={statusInfo.variant} className={`text-[10px] ${statusInfo.color} ${statusInfo.bgColor} border`}>
                              {statusInfo.label}
                            </Badge>
                            {req.signedDocumentUrl && <Shield className="h-3.5 w-3.5 text-emerald-600" />}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 hidden sm:block" />
                        </CardContent>
                      </Card>
                    );
                  })
              )}
            </div>
          </TabsContent>

          {/* Notes tab */}
          <TabsContent value="notes">
            <div className="space-y-4 mt-4">
              <ClinicalNotesForm requests={requests} onAdd={handleAddNote} />
              {doctorNotes.length > 0 ? (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Historico ({doctorNotes.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    {doctorNotes.map((note, idx) => (
                      <div key={note.id} className={idx < doctorNotes.length - 1 ? 'pb-4 border-b border-border' : ''}>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            {(() => { const I = getNoteIcon(note.noteType); return <I className="h-2.5 w-2.5" /> })()}
                            {DOCTOR_NOTE_TYPES.find(t => t.key === note.noteType)?.label ?? note.noteType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-sm break-words">{note.content}</p>
                        {note.requestId && (
                          <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs" onClick={() => navigate(`/pedidos/${note.requestId}`)}>
                            Ver atendimento vinculado →
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-sm"><CardContent className="py-12 text-center"><StickyNote className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhuma nota registrada. Use o formulario acima.</p></CardContent></Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DoctorLayout>
  );
}
