import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  getRequestById, updatePrescriptionContent, updateExamContent, updateConduct,
  getPreviewPdf, getPreviewExamPdf, signRequest,
  type MedicalRequest, type Medication, type ExamItem,
} from '@/services/doctorApi';
import { validatePrescription } from '@/services/doctor-api-consultation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, ArrowLeft, Plus, Trash2, Save, FileSignature, Eye, Pill,
  FlaskConical, FileText, AlertTriangle, Lock, CheckCircle2, Sparkles, XCircle, X,
  ExternalLink, Printer, AlertCircle, Bookmark, BookmarkPlus,
} from 'lucide-react';
import { TemplateDialogSave, TemplateDialogLoad } from '@/components/doctor/TemplateDialog';

function getComplianceErrors(
  request: MedicalRequest | null,
  medications: Medication[],
  exams: ExamItem[],
): string[] {
  if (!request) return [];
  if (request.type === 'prescription') {
    const errors: string[] = [];
    medications.forEach((m, i) => {
      if (!m.name?.trim()) errors.push(`Medicamento ${i + 1}: nome obrigatório`);
      else {
        if (!m.dosage?.trim()) errors.push(`Medicamento ${i + 1} (${m.name}): dosagem obrigatória`);
        if (!m.frequency?.trim()) errors.push(`Medicamento ${i + 1} (${m.name}): frequência obrigatória`);
        if (!m.duration?.trim()) errors.push(`Medicamento ${i + 1} (${m.name}): duração obrigatória`);
      }
    });
    return errors;
  }
  if (request.type === 'exam') {
    return exams
      .map((e, i) => (!e.name?.trim() ? `Exame ${i + 1}: nome obrigatório` : null))
      .filter((x): x is string => x != null);
  }
  if (request.type === 'consultation') {
    if (medications.length === 0) return ['Adicione pelo menos um medicamento para criar a receita.'];
    const errors: string[] = [];
    medications.forEach((m, i) => {
      if (!m.name?.trim()) errors.push(`Medicamento ${i + 1}: nome obrigatório`);
      else {
        if (!m.dosage?.trim()) errors.push(`Medicamento ${i + 1} (${m.name}): dosagem obrigatória`);
        if (!m.frequency?.trim()) errors.push(`Medicamento ${i + 1} (${m.name}): frequência obrigatória`);
        if (!m.duration?.trim()) errors.push(`Medicamento ${i + 1} (${m.name}): duração obrigatória`);
      }
    });
    return errors;
  }
  return [];
}

interface EditorLocationState {
  prefillMeds?: { name: string; dosage: string; frequency: string; duration: string }[];
}

export default function DoctorRequestEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as EditorLocationState | null;
  const [searchParams] = useSearchParams();
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);
  const prefillAppliedRef = useRef(false);

  useEffect(() => {
    document.title = id ? `Pedido #${id.slice(0, 8)} — Editor — RenoveJá+` : 'Editor — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, [id]);
  const [request, setRequest] = useState<MedicalRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [medications, setMedications] = useState<Medication[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [notes, setNotes] = useState('');
  const [conductNotes, setConductNotes] = useState('');
  const [includeConductInPdf, setIncludeConductInPdf] = useState(true);
  const [prescriptionKind, setPrescriptionKind] = useState('simple');
  const [complianceValidation, setComplianceValidation] = useState<{
    valid: boolean;
    messages?: string[];
    missingFields?: string[];
  } | null>(null);
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<string>>(new Set());
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false);

  function parseAiMedications(aiExtractedJson: string | null): string[] {
    if (!aiExtractedJson) return [];
    try {
      const obj = JSON.parse(aiExtractedJson) as { medications?: unknown[] };
      const arr = obj?.medications;
      if (Array.isArray(arr)) {
        return arr.map((m) => String(m ?? '').trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  const suggestedFromAi = parseAiMedications(request?.aiExtractedJson ?? null).filter(
    (m) =>
      !medications.some((med) => med.name?.toLowerCase().includes(m.toLowerCase().split(' ')[0] ?? '')) &&
      !rejectedSuggestions.has(m)
  );

  const refreshCompliance = useCallback(async () => {
    if (!id || !request) return;
    if (request.type !== 'prescription' && request.type !== 'exam') return;
    try {
      const v = await validatePrescription(id);
      setComplianceValidation({
        valid: v.valid ?? true,
        messages: v.messages ?? [],
        missingFields: v.missingFields ?? [],
      });
    } catch {
      setComplianceValidation(null);
    }
  }, [id, request]);

  useEffect(() => {
    if (!id) return;
    getRequestById(id)
      .then((data) => {
        setRequest(data);
        const prefill = state?.prefillMeds;
        if (data.type === 'consultation' && prefill?.length) {
          setMedications(prefill.map((m) => ({ name: m.name || '', dosage: m.dosage || '', frequency: m.frequency || '', duration: m.duration || '' })));
        } else if (data.medications?.length) {
          setMedications(data.medications);
        } else if (data.type === 'prescription') {
          setMedications([{ name: '', dosage: '', frequency: '', duration: '' }]);
        }
        if (data.exams?.length) {
          setExams(data.exams);
        } else if (data.type === 'exam') {
          setExams([{ name: '', notes: '' }]);
        }
        setNotes(data.notes || '');
        setConductNotes(data.doctorConductNotes || '');
        setIncludeConductInPdf(data.includeConductInPdf !== false);
        setPrescriptionKind(data.prescriptionKind || 'simple');
      })
      .catch(() => toast.error('Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [id, state?.prefillMeds]); // request intentionally excluded — we fetch it here

  useEffect(() => {
    if (id && request && (request.type === 'prescription' || request.type === 'exam')) {
      void refreshCompliance();
    }
  }, [id, request, refreshCompliance]);

  // Prefill from consultation (query params or state) — aplica apenas uma vez
  useEffect(() => {
    if (!request || loading || prefillAppliedRef.current) return;
    const prefillMedsRaw =
      searchParams.get('prefillMeds') ?? (location.state as { prefillMeds?: string } | null)?.prefillMeds;
    const prefillExamsRaw =
      searchParams.get('prefillExams') ?? (location.state as { prefillExams?: string } | null)?.prefillExams;

    if (prefillMedsRaw && (request.type === 'prescription' || request.type === 'consultation')) {
      try {
        const parsed = JSON.parse(prefillMedsRaw);
        const arr = Array.isArray(parsed) ? parsed : [];
        const meds: Medication[] = arr.map((m: unknown) => {
          if (typeof m === 'string') return { name: m, dosage: '', frequency: '', duration: '' };
          const o = m as Record<string, unknown>;
          return {
            name: String(o?.nome ?? o?.name ?? ''),
            dosage: String(o?.dosagem ?? o?.dosage ?? o?.dose ?? ''),
            frequency: String(o?.frequencia ?? o?.frequency ?? o?.posologia ?? ''),
            duration: String(o?.duracao ?? o?.duration ?? ''),
            notes: o?.observacoes ? String(o.observacoes) : undefined,
          };
        });
        if (meds.length > 0) {
          setMedications(meds);
          prefillAppliedRef.current = true;
        }
      } catch {
        /* ignore */ }
    }

    if (prefillExamsRaw && (request.type === 'exam' || request.type === 'consultation')) {
      try {
        const parsed = JSON.parse(prefillExamsRaw);
        const arr = Array.isArray(parsed) ? parsed : [];
        const exs: ExamItem[] = arr.map((e: unknown) => {
          if (typeof e === 'string') return { name: e, notes: '' };
          const o = e as Record<string, unknown>;
          return {
            name: String(o?.nome ?? o?.name ?? ''),
            notes: o?.justificativa ? String(o.justificativa) : o?.notes ? String(o.notes) : undefined,
          };
        });
        if (exs.length > 0) {
          setExams(exs);
          prefillAppliedRef.current = true;
        }
      } catch {
        /* ignore */ }
    }
  }, [request, loading, searchParams, location.state]);

  const addMedication = () => setMedications(prev => [...prev, { name: '', dosage: '', frequency: '', duration: '' }]);
  const removeMedication = (i: number) => setMedications(prev => prev.filter((_, idx) => idx !== i));
  const updateMedication = (i: number, field: keyof Medication, val: string) => {
    setMedications(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  };

  const addExam = () => setExams(prev => [...prev, { name: '', notes: '' }]);
  const removeExam = (i: number) => setExams(prev => prev.filter((_, idx) => idx !== i));
  const updateExam = (i: number, field: keyof ExamItem, val: string) => {
    setExams(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  };

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!id || !request) return false;
    setSaving(true);
    try {
      if (request.type === 'prescription') {
        await updatePrescriptionContent(id, { medications, notes, prescriptionKind });
      } else if (request.type === 'exam') {
        await updateExamContent(id, { exams, notes });
      }
      if (request.type === 'consultation') {
        await updateConduct(id, { conductNotes, includeConductInPdf });
      }
      const updated = await getRequestById(id);
      setRequest(updated);
      await refreshCompliance();
      toast.success('Salvo com sucesso');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
      return false;
    } finally {
      setSaving(false);
    }
  }, [id, request, medications, exams, notes, prescriptionKind, conductNotes, includeConductInPdf, refreshCompliance]);

  const handlePreviewPdf = useCallback(async () => {
    if (!id || !request) return;
    setPdfLoading(true);
    try {
      const saved = await handleSave();
      if (!saved) { setPdfLoading(false); return; }
      const url = request.type === 'exam' ? await getPreviewExamPdf(id) : await getPreviewPdf(id);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
    } catch {
      toast.error('Erro ao gerar preview');
    } finally {
      setPdfLoading(false);
    }
  }, [id, request, handleSave, pdfUrl]);

  // Cleanup blob URL on unmount or when pdfUrl changes
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePreviewPdf();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, handlePreviewPdf]);

  const handleSign = async () => {
    if (!id || !certPassword) return;
    setSigning(true);
    try {
      await handleSave();
      const validation = await validatePrescription(id);
      if (!validation.valid) {
        const checklist = (validation.messages ?? []).join('\n• ');
        toast.error(`Receita incompleta. Corrija antes de assinar:\n\n• ${checklist}`, { duration: 8000 });
        setSigning(false);
        return;
      }
      await signRequest(id, certPassword);
      toast.success('Documento assinado digitalmente!');
      setSignDialogOpen(false);
      navigate(`/pedidos/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao assinar');
    } finally {
      setSigning(false);
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
        </div>
      </DoctorLayout>
    );
  }

  const isPrescription = request.type === 'prescription' || request.type === 'consultation';
  const complianceErrors = getComplianceErrors(request, medications, exams);
  const hasComplianceErrors = complianceErrors.length > 0;
  const canSign = request.status === 'paid' && !hasComplianceErrors;

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/pedidos/${id}`)} aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Editor — {isPrescription ? 'Receita' : 'Exame'}
              </h1>
              <p className="text-sm text-muted-foreground">{request.patientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePreviewPdf} disabled={pdfLoading} className="gap-2">
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Preview PDF
            </Button>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(true)} className="gap-2">
              <BookmarkPlus className="h-4 w-4" />
              Salvar como template
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
            {canSign && (
              <Button onClick={() => setSignDialogOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <FileSignature className="h-4 w-4" />
                Assinar
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Editor */}
          <div className="lg:col-span-3 space-y-5">
            {/* Compliance validation */}
            {complianceValidation && !complianceValidation.valid && complianceValidation.messages && complianceValidation.messages.length > 0 && (
              <Card className="shadow-sm border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold text-amber-800 dark:text-amber-300">Campos obrigatórios</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-2">Complete os itens abaixo antes de assinar:</p>
                  <ul className="space-y-1">
                    {complianceValidation.messages.map((msg, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Usar template */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setLoadTemplateOpen(true)}
            >
              <Bookmark className="h-4 w-4" />
              Usar template
            </Button>

            {/* Prescription kind */}
            {isPrescription && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" aria-hidden />
                      Tipo de Receita
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Select value={prescriptionKind} onValueChange={setPrescriptionKind}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Receita Simples</SelectItem>
                        <SelectItem value="antimicrobial">Receita Antimicrobiano</SelectItem>
                        <SelectItem value="controlled">Receita Controle Especial</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* AI medication suggestions (prescription only) */}
            {isPrescription && suggestedFromAi.length > 0 && (
              <Card className="shadow-sm border-primary/20 bg-primary/[0.02]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Medicamentos sugeridos pela IA
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {suggestedFromAi.map((med, i) => (
                      <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted text-sm">
                        <span className="truncate max-w-[200px]">{med}</span>
                        <button
                          type="button"
                          onClick={() => setMedications((prev) => [...prev, { name: med, dosage: '', frequency: '', duration: '' }])}
                          className="p-1 rounded hover:bg-primary/20 text-primary"
                          aria-label={`Adicionar ${med}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectedSuggestions((p) => new Set(p).add(med))}
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground"
                          aria-label={`Rejeitar ${med}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Items */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {isPrescription ? <Pill className="h-4 w-4 text-primary" /> : <FlaskConical className="h-4 w-4 text-primary" />}
                      {isPrescription ? 'Medicamentos' : 'Exames'}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={isPrescription ? addMedication : addExam}
                      className="gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  {isPrescription ? (
                    medications.map((med, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-3 relative group">
                        {medications.length > 1 && (
                          <button
                            onClick={() => removeMedication(i)}
                            className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                            aria-label="Remover medicamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <div>
                          <Label className="text-xs">Nome do medicamento</Label>
                          <Input value={med.name} onChange={e => updateMedication(i, 'name', e.target.value)} placeholder="Ex: Amoxicilina 500mg" className="mt-1" />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Dosagem</Label>
                            <Input value={med.dosage} onChange={e => updateMedication(i, 'dosage', e.target.value)} placeholder="500mg" className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Frequência</Label>
                            <Input value={med.frequency} onChange={e => updateMedication(i, 'frequency', e.target.value)} placeholder="8/8h" className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-xs">Duração</Label>
                            <Input value={med.duration} onChange={e => updateMedication(i, 'duration', e.target.value)} placeholder="7 dias" className="mt-1" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Observações</Label>
                          <Input value={med.notes || ''} onChange={e => updateMedication(i, 'notes', e.target.value)} placeholder="Tomar após refeição" className="mt-1" />
                        </div>
                      </div>
                    ))
                  ) : (
                    exams.map((exam, i) => (
                      <div key={i} className="p-4 rounded-xl border border-border/50 bg-muted/30 space-y-3 relative group">
                        {exams.length > 1 && (
                          <button
                            onClick={() => removeExam(i)}
                            className="absolute top-3 right-3 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                            aria-label="Remover exame"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <div>
                          <Label className="text-xs">Nome do exame</Label>
                          <Input value={exam.name} onChange={e => updateExam(i, 'name', e.target.value)} placeholder="Ex: Hemograma completo" className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Observações</Label>
                          <Input value={exam.notes || ''} onChange={e => updateExam(i, 'notes', e.target.value)} placeholder="Jejum de 8h" className="mt-1" />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Compliance Card */}
            {hasComplianceErrors && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="shadow-sm border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                          Campos obrigatórios para assinar
                        </p>
                        <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-700 dark:text-amber-300">
                          {complianceErrors.map((err, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              {err}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                          Preencha todos os campos para habilitar a assinatura digital.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Notes */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Observações</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Observações gerais para o documento..."
                    rows={3}
                  />
                </CardContent>
              </Card>
            </motion.div>

            {/* Conduct */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Conduta Médica</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <Textarea
                    value={conductNotes}
                    onChange={e => setConductNotes(e.target.value)}
                    placeholder="Anotações sobre conduta clínica..."
                    rows={3}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeConductInPdf}
                      onChange={e => setIncludeConductInPdf(e.target.checked)}
                      className="rounded border-input"
                    />
                    <span className="text-sm">Incluir conduta no PDF do documento</span>
                  </label>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* PDF Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-primary" aria-hidden />
                      Preview do Documento
                    </CardTitle>
                    {pdfUrl && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir em nova aba
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => {
                            try {
                              pdfIframeRef.current?.contentWindow?.print?.();
                            } catch {
                              window.open(pdfUrl, '_blank', 'noopener,noreferrer');
                            }
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Imprimir
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {pdfUrl ? (
                    <div className="rounded-lg overflow-hidden border border-border bg-white">
                      <iframe
                        ref={pdfIframeRef}
                        src={pdfUrl}
                        title="Preview do PDF"
                        className="w-full border-0"
                        style={{ height: '70vh', minHeight: 400 }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center rounded-lg border border-dashed border-border bg-muted/30">
                      <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">Clique em "Preview PDF" para visualizar</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Suggestion */}
              {request.aiConductSuggestion && (
                <Card className="shadow-sm mt-4 border-primary/20 bg-primary/[0.02]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-primary" aria-hidden />
                      Sugestão da IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs whitespace-pre-wrap text-muted-foreground">{request.aiConductSuggestion}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-xs text-muted-foreground text-center py-3 border-t">
          Ctrl+S salvar · Ctrl+P preview
        </p>
      </div>

      {/* Sign dialog */}
      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Assinatura Digital
            </DialogTitle>
            <DialogDescription>
              Digite a senha do seu certificado digital (A1/PFX) para assinar o documento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cert-password">Senha do certificado</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                id="cert-password"
                type="password"
                placeholder="••••••••"
                value={certPassword}
                onChange={e => setCertPassword(e.target.value)}
                className="pl-10"
                autoComplete="off"
              />
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              <div className="flex items-center gap-2 font-medium mb-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Assinatura segura
              </div>
              O documento será assinado com seu certificado ICP-Brasil cadastrado na plataforma.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSign}
              disabled={signing || !certPassword}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
              Assinar documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template dialogs */}
      <TemplateDialogSave
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        mode={isPrescription ? 'prescription' : 'exam'}
        prescriptionData={isPrescription ? { medications, prescriptionKind } : undefined}
        examData={!isPrescription ? exams : undefined}
      />
      <TemplateDialogLoad
        open={loadTemplateOpen}
        onOpenChange={setLoadTemplateOpen}
        mode={isPrescription ? 'prescription' : 'exam'}
        onSelectPrescription={isPrescription ? (t) => { setMedications(t.medications); setPrescriptionKind(t.prescriptionKind); } : undefined}
        onSelectExam={!isPrescription ? (t) => setExams(t.exams) : undefined}
      />
    </DoctorLayout>
  );
}
