/**
 * DoctorPostConsultationEmit — Emissão de documentos pós-consulta (web).
 * Design alinhado ao mockup aprovado. Usa shadcn/ui + Tailwind.
 * Receita + Exames (com pacotes) + Atestado, pré-preenchidos pela IA.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  getRequestById,
  emitPostConsultationDocuments,
  type PostConsultationEmitPayload,
  type PrescriptionItemEmit,
  type ExamItemEmitWeb,
} from '@/services/doctorApi';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, X, Plus, ChevronDown, ChevronUp, ShieldCheck, Minus, Lock, Pencil,
} from 'lucide-react';

// ── CID Packages (same data as mobile) ──
const CID_PACKAGES: Record<string, {
  name: string; days: number; body: string;
  meds: { drug: string; posology: string; note: string }[];
  exams: string[]; examJust: string;
}> = {
  J11: { name: 'Gripe (Influenza)', days: 3, body: 'Paciente apresenta síndrome gripal com febre, necessitando repouso domiciliar.',
    meds: [{ drug: 'Dipirona 500mg', posology: 'VO 6/6h por 5 dias', note: 'Febre e dor' },
      { drug: 'Loratadina 10mg', posology: 'VO 1x/dia por 7 dias', note: 'Congestão' },
      { drug: 'Oseltamivir 75mg', posology: 'VO 12/12h por 5 dias', note: 'Antiviral (se <48h)' }],
    exams: ['Hemograma completo', 'PCR', 'VHS'], examJust: 'Investigação de quadro gripal febril.' },
  I10: { name: 'Hipertensão arterial', days: 0, body: '',
    meds: [{ drug: 'Losartana 50mg', posology: 'VO 1x/dia contínuo', note: 'BRA' },
      { drug: 'HCTZ 25mg', posology: 'VO 1x/dia contínuo', note: 'Diurético' },
      { drug: 'Anlodipino 5mg', posology: 'VO 1x/dia contínuo', note: 'BCC' }],
    exams: ['Creatinina','Ureia','Na/K','Lipidograma','Glicemia jejum','HbA1c','Ácido úrico','Urina I','ECG','Microalbuminúria'],
    examJust: 'Acompanhamento de HAS.' },
  E11: { name: 'Diabetes tipo 2', days: 0, body: '',
    meds: [{ drug: 'Metformina 850mg', posology: 'VO 2x/dia contínuo', note: '1ª linha DM2' },
      { drug: 'Glicazida 60mg', posology: 'VO 1x/dia contínuo', note: 'Sulfonilureia' }],
    exams: ['Glicemia jejum','HbA1c','Lipidograma','Creatinina','Ureia','Microalbuminúria','K+','Na+','TGO/TGP','Urina I','Fundo de olho'],
    examJust: 'Controle DM2 e rastreio de complicações.' },
  F32: { name: 'Episódio depressivo', days: 5, body: 'Episódio depressivo, necessitando afastamento para estabilização clínica.',
    meds: [{ drug: 'Sertralina 50mg', posology: 'VO manhã contínuo', note: 'ISRS' },
      { drug: 'Clonazepam 0,5mg', posology: 'VO noite SOS 14 dias', note: 'Ansiedade' }],
    exams: ['TSH','T4 livre','Hemograma','Glicemia','Vit D','Vit B12','Ferro','Ferritina'],
    examJust: 'Diagnóstico diferencial.' },
  M54: { name: 'Dorsalgia', days: 3, body: 'Dorsalgia aguda limitando atividades.',
    meds: [{ drug: 'Ibuprofeno 600mg', posology: 'VO 8/8h por 5 dias', note: 'AINE' },
      { drug: 'Ciclobenzaprina 5mg', posology: 'VO noite por 7 dias', note: 'Relaxante' },
      { drug: 'Dipirona 1g', posology: 'VO 6/6h SOS', note: 'Dor' }],
    exams: ['Hemograma','PCR','VHS','Rx coluna lombar'], examJust: 'Investigação de dorsalgia aguda.' },
  J06: { name: 'IVAS (Resfriado)', days: 2, body: 'Infecção aguda de vias aéreas superiores.',
    meds: [{ drug: 'Paracetamol 750mg', posology: 'VO 6/6h SOS', note: 'Febre/dor' },
      { drug: 'NaCl 0,9% nasal', posology: '3 gotas 4x/dia', note: 'Lavagem' },
      { drug: 'Loratadina 10mg', posology: 'VO 1x/dia 5 dias', note: 'Congestão' }],
    exams: ['Hemograma'], examJust: 'IVAS viral.' },
  N39: { name: 'Infecção urinária', days: 2, body: 'ITU em tratamento antibiótico.',
    meds: [{ drug: 'Norfloxacino 400mg', posology: 'VO 12/12h 7 dias', note: 'ATB' },
      { drug: 'Fenazopiridina 200mg', posology: 'VO 8/8h 3 dias', note: 'Analgesia' }],
    exams: ['EAS','Urocultura','Creatinina','Hemograma'], examJust: 'Confirmação ITU.' },
  K21: { name: 'Refluxo (DRGE)', days: 0, body: '',
    meds: [{ drug: 'Omeprazol 20mg', posology: 'VO jejum 30 dias', note: 'IBP' },
      { drug: 'Domperidona 10mg', posology: 'VO 3x/dia 14 dias', note: 'Procinético' }],
    exams: ['Hemograma','H. pylori'], examJust: 'Investigação DRGE.' },
  J45: { name: 'Asma', days: 2, body: 'Crise asmática leve.',
    meds: [{ drug: 'Salbutamol 100mcg', posology: '2 jatos 4/4h SOS', note: 'Resgate' },
      { drug: 'Budesonida 200mcg', posology: '2 jatos 12/12h', note: 'CI' },
      { drug: 'Prednisolona 20mg', posology: 'VO 1x/dia 5 dias', note: 'Crise' }],
    exams: ['Hemograma','IgE total','Rx tórax','Espirometria'], examJust: 'Crise asmática.' },
};

const EXAM_PACKAGES = [
  { key: 'checkup', name: 'Check-up completo', exams: ['Hemograma','Glicemia','HbA1c','Colesterol total/frações','Triglicerídeos','TGO','TGP','GGT','Bilirrubinas','Ureia','Creatinina','Ácido úrico','TSH','T4 livre','Vit D','Vit B12','Ferro','Ferritina','PCR','VHS','Na/K/Ca','Urina I','Parasitológico'], just: 'Check-up preventivo.' },
  { key: 'ist', name: 'IST/Sorologias', exams: ['VDRL','Anti-HIV','HBsAg','Anti-HCV','Anti-HBs','Toxo IgG/IgM','CMV IgG/IgM','Rubéola IgG/IgM'], just: 'Rastreamento de ISTs.' },
  { key: 'prenatal', name: 'Pré-natal', exams: ['Hemograma','ABO/Rh','Coombs','Glicemia','TOTG 75g','VDRL','Anti-HIV','HBsAg','Anti-HCV','Toxo IgG/IgM','Rubéola IgG/IgM','CMV IgG/IgM','TSH','T4 livre','Urina I','Urocultura','Parasitológico'], just: 'Rotina pré-natal ministerial.' },
  { key: 'cardio', name: 'Risco cardiovascular', exams: ['Lipidograma','Glicemia','HbA1c','PCR-us','Homocisteína','Lp(a)','CPK','Troponina','BNP','Ácido úrico','Na/K'], just: 'Risco cardiovascular.' },
  { key: 'tireoide', name: 'Tireoide', exams: ['TSH','T4 livre','T3 total','Anti-TPO','Anti-tireoglobulina'], just: 'Avaliação tireoidiana.' },
  { key: 'renal', name: 'Função renal', exams: ['Creatinina','Ureia','Ácido úrico','Na','K','Ca','Fósforo','TFG','Urina I','Microalbuminúria','Proteinúria 24h'], just: 'Avaliação renal.' },
  { key: 'hepatico', name: 'Perfil hepático', exams: ['TGO','TGP','GGT','Fosfatase alcalina','Bilirrubinas','Albumina','Proteínas totais','TAP/INR','LDH'], just: 'Perfil hepático.' },
];

function extractMedsFromAnamnesis(anam: Record<string, unknown> | null): PrescriptionItemEmit[] {
  if (!anam?.medicamentos_sugeridos) return [];
  const arr = anam.medicamentos_sugeridos as Array<Record<string, string> | string>;
  return arr.map((m) => {
    if (typeof m === 'string') return { drug: m };
    return { drug: m.nome ?? 'Medicamento', posology: m.posologia ?? undefined, notes: m.indicacao ?? undefined };
  });
}

function extractExamsFromAnamnesis(anam: Record<string, unknown> | null): ExamItemEmitWeb[] {
  if (!anam?.exames_sugeridos) return [];
  const arr = anam.exames_sugeridos as Array<Record<string, string> | string>;
  return arr.map((e) => {
    if (typeof e === 'string') return { type: 'laboratorial', description: e };
    return { type: 'laboratorial', description: e.nome ?? 'Exame' };
  });
}

function extractReferralFromAnamnesis(anam: Record<string, unknown> | null): { professional?: string; specialty?: string; reason?: string } | null {
  if (!anam?.encaminhamento_sugerido) return null;
  const enc = anam.encaminhamento_sugerido as Record<string, string>;
  if (!enc?.profissional && !enc?.motivo) return null;
  return {
    professional: enc.profissional ?? enc.medico ?? enc.professional,
    specialty: enc.especialidade ?? enc.specialty,
    reason: enc.motivo ?? enc.reason ?? enc.indication,
  };
}

export default function DoctorPostConsultationEmit() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<Awaited<ReturnType<typeof getRequestById>> | null>(null);

  const anamnesis = useMemo(() => {
    if (!request?.consultationAnamnesis) return null;
    try { return JSON.parse(request.consultationAnamnesis); } catch { return null; }
  }, [request?.consultationAnamnesis]);

  const detectedCid: string | null = useMemo(() => {
    if (!anamnesis) return null;
    const dd = anamnesis.diagnostico_diferencial;
    if (!Array.isArray(dd) || dd.length === 0) return null;
    const first = dd[0] as Record<string, string> | undefined;
    return first?.cid ?? null;
  }, [anamnesis]);
  const cidPkg = detectedCid ? CID_PACKAGES[detectedCid] : null;

  /** Pacotes do backend (idade/sexo) ou lista estática. */
  const examPackagesDisplay = useMemo(() => {
    const pkgs = request?.examQuickPackages;
    if (pkgs && pkgs.length > 0) {
      return pkgs.map((p) => ({ key: p.key, name: p.name, exams: p.exams, just: p.justification }));
    }
    return EXAM_PACKAGES;
  }, [request?.examQuickPackages]);

  // Document toggles — re-sync when request/anamnesis loads
  const [rxOn, setRxOn] = useState(true);
  const [exOn, setExOn] = useState(false);
  const [atOn, setAtOn] = useState(false);
  const [refOn, setRefOn] = useState(false);

  // Sections
  const [rxOpen, setRxOpen] = useState(true);
  const [exOpen, setExOpen] = useState(false);
  const [atOpen, setAtOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [cidPickerOpen, setCidPickerOpen] = useState(false);
  const [exListExpanded, setExListExpanded] = useState(false);

  // Prescription — populated by useEffect when request loads
  const [rxType, setRxType] = useState<'simples' | 'controlado'>('simples');
  const [meds, setMeds] = useState<PrescriptionItemEmit[]>([]);

  // Exams — populated by useEffect when request loads
  const [exams, setExams] = useState<ExamItemEmitWeb[]>([]);
  const [examJust, setExamJust] = useState(cidPkg?.examJust ?? '');

  // Certificate
  const [certType, setCertType] = useState<'afastamento' | 'comparecimento' | 'aptidao'>('afastamento');
  const [certBody, setCertBody] = useState(cidPkg?.body ?? '');
  const [certCid, setCertCid] = useState(detectedCid ?? '');
  const [certDays, setCertDays] = useState(cidPkg?.days ?? 3);
  const [certIncludeCid, setCertIncludeCid] = useState(true);

  // General instructions for prescription (same as mobile)
  const [rxGeneralInstructions, setRxGeneralInstructions] = useState('');

  // Referral (encaminhamento)
  const [refProfessional, setRefProfessional] = useState('');
  const [refSpecialty, setRefSpecialty] = useState('');
  const [refReason, setRefReason] = useState('');

  // ── Medication dialog state (aligned with mobile modal) ──
  const [medDialogOpen, setMedDialogOpen] = useState(false);
  const [editingMedIndex, setEditingMedIndex] = useState<number | null>(null);
  const [medForm, setMedForm] = useState<PrescriptionItemEmit>({ drug: '', concentration: '', posology: '', notes: '' });

  const openAddMed = useCallback(() => {
    setEditingMedIndex(null);
    setMedForm({ drug: '', concentration: '', posology: '', notes: '' });
    setMedDialogOpen(true);
  }, []);

  const openEditMed = useCallback((idx: number) => {
    const m = meds[idx];
    setEditingMedIndex(idx);
    setMedForm({
      drug: m.drug ?? '',
      concentration: m.concentration ?? '',
      posology: m.posology ?? '',
      notes: m.notes ?? '',
    });
    setMedDialogOpen(true);
  }, [meds]);

  const saveMed = useCallback(() => {
    const drug = medForm.drug?.trim();
    if (!drug) {
      toast.error('Informe o nome do medicamento.');
      return;
    }
    const item: PrescriptionItemEmit = {
      drug,
      concentration: medForm.concentration?.trim() || undefined,
      posology: medForm.posology?.trim() || undefined,
      notes: medForm.notes?.trim() || undefined,
    };
    if (editingMedIndex !== null) {
      setMeds(prev => prev.map((m, i) => (i === editingMedIndex ? item : m)));
    } else {
      setMeds(prev => [...prev, item]);
    }
    setMedDialogOpen(false);
  }, [medForm, editingMedIndex]);

  // ── Exam dialog state (aligned with mobile modal) ──
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [editingExamIndex, setEditingExamIndex] = useState<number | null>(null);
  const [examForm, setExamForm] = useState<ExamItemEmitWeb>({ type: 'laboratorial', description: '' });

  const openAddExam = useCallback(() => {
    setEditingExamIndex(null);
    setExamForm({ type: 'laboratorial', description: '' });
    setExamDialogOpen(true);
  }, []);

  const openEditExam = useCallback((idx: number) => {
    const e = exams[idx];
    setEditingExamIndex(idx);
    setExamForm({ type: e.type, description: e.description });
    setExamDialogOpen(true);
  }, [exams]);

  const saveExam = useCallback(() => {
    const description = examForm.description?.trim();
    if (!description) {
      toast.error('Informe a descrição do exame.');
      return;
    }
    const item: ExamItemEmitWeb = { type: examForm.type || 'laboratorial', description };
    if (editingExamIndex !== null) {
      setExams(prev => prev.map((e, i) => (i === editingExamIndex ? item : e)));
    } else {
      setExams(prev => [...prev, item]);
    }
    setExamDialogOpen(false);
  }, [examForm, editingExamIndex]);

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    getRequestById(requestId)
      .then(r => { if (!cancelled) { setRequest(r); setLoading(false); } })
      .catch(() => { if (!cancelled) { toast.error('Erro ao carregar consulta'); navigate(-1); } });
    return () => { cancelled = true; };
  }, [requestId, navigate]);

  // FIX #64: Sync toggles, meds, exams, cert quando request/anamnesis carrega
  useEffect(() => {
    if (!request) return;
    const aiMeds = extractMedsFromAnamnesis(anamnesis);
    const aiExams = extractExamsFromAnamnesis(anamnesis);
    const pkg = detectedCid ? CID_PACKAGES[detectedCid] : null;

    const finalMeds = aiMeds.length > 0 ? aiMeds : (pkg?.meds.map(m => ({ drug: m.drug, posology: m.posology, notes: m.note })) ?? []);
    const finalExams = aiExams.length > 0 ? aiExams : (pkg?.exams.map(e => ({ type: 'laboratorial' as const, description: e })) ?? []);

    setMeds(finalMeds);
    setExams(finalExams);
    if (pkg?.examJust) setExamJust(pkg.examJust);
    if (pkg?.body) setCertBody(pkg.body);
    if (detectedCid) setCertCid(detectedCid);
    if (pkg?.days) setCertDays(pkg.days);

    setExOn(finalExams.length > 0);
    setExOpen(finalExams.length > 0);
    setAtOn((pkg?.days ?? 0) > 0);
    setAtOpen((pkg?.days ?? 0) > 0);

    const refSug = extractReferralFromAnamnesis(anamnesis);
    if (refSug?.professional || refSug?.reason) {
      setRefProfessional(refSug.professional ?? '');
      setRefSpecialty(refSug.specialty ?? '');
      setRefReason(refSug.reason ?? '');
      setRefOn(true);
      setRefOpen(true);
    }
  }, [request, anamnesis, detectedCid]);

  const loadCid = useCallback((code: string) => {
    const pkg = CID_PACKAGES[code];
    if (!pkg) return;
    setMeds(pkg.meds.map(m => ({ drug: m.drug, posology: m.posology, notes: m.note })));
    setExams(pkg.exams.map(e => ({ type: 'laboratorial', description: e })));
    setExamJust(pkg.examJust); setCertBody(pkg.body); setCertCid(code);
    setCertDays(pkg.days || 1); setAtOn(pkg.days > 0); setAtOpen(pkg.days > 0);
    if (pkg.exams.length > 0) { setExOn(true); setExOpen(true); }
    setCidPickerOpen(false);
  }, []);

  const loadExamPkg = useCallback((key: string) => {
    const pkg = examPackagesDisplay.find(p => p.key === key);
    if (!pkg) return;
    setExams(pkg.exams.map(e => ({ type: 'laboratorial', description: e })));
    setExamJust(pkg.just); setExOn(true); setExOpen(true);
  }, [examPackagesDisplay]);

  // Only count documents that are actually valid (have content)
  const rxValid = rxOn && meds.length > 0 && meds.some(m => m.drug?.trim());
  const exValid = exOn && exams.length > 0 && exams.some(e => e.description?.trim());
  const atValid = atOn && certBody.trim().length > 0;
  const refValid = refOn && refProfessional.trim().length > 0 && refReason.trim().length > 0;
  const docCount = (rxValid ? 1 : 0) + (exValid ? 1 : 0) + (atValid ? 1 : 0) + (refValid ? 1 : 0);

  // ── Password dialog state ──
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [certPassword, setCertPassword] = useState('');

  const handleSignClick = () => {
    if (!requestId || docCount === 0) return;
    if (docCount > 4) {
      toast.error('Máximo de 4 documentos: receita, exames, atestado e encaminhamento.');
      return;
    }
    setCertPassword('');
    setPasswordDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!requestId || docCount === 0) return;
    setPasswordDialogOpen(false);
    setSubmitting(true);
    try {
      const payload: PostConsultationEmitPayload = {
        requestId,
        certificatePassword: certPassword || undefined,
        mainIcd10Code: certCid || detectedCid || undefined,
        anamnesis: request?.consultationAnamnesis ?? undefined,
        structuredAnamnesis: request?.consultationAnamnesis ?? undefined,
        plan: request?.doctorConductNotes ?? request?.aiConductSuggestion ?? undefined,
      };
      if (rxOn && meds.length > 0) payload.prescription = { type: rxType, items: meds, generalInstructions: rxGeneralInstructions.trim() || undefined };
      if (exOn && exams.length > 0) payload.examOrder = { clinicalJustification: examJust, items: exams };
      if (atOn && certBody.trim()) {
        payload.medicalCertificate = {
          certificateType: certType, body: certBody, icd10Code: certCid || undefined,
          leaveDays: certDays, leaveStartDate: new Date().toISOString(),
          leavePeriod: 'integral', includeIcd10: certIncludeCid,
        };
      }
      if (refOn && refProfessional.trim() && refReason.trim()) {
        payload.referral = {
          professionalName: refProfessional.trim(),
          specialty: refSpecialty.trim() || undefined,
          reason: refReason.trim(),
          icd10Code: certCid || detectedCid || undefined,
        };
      }
      const result = await emitPostConsultationDocuments(payload);
      toast.success(result.message);
      if (result.errors?.length) {
        result.errors.forEach((e) => toast.error(e, { duration: 6000 }));
      }
      if (result.documentsEmitted > 0) {
        navigate(`/pedidos/${requestId}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao emitir documentos');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <DoctorLayout>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DoctorLayout>
  );

  return (
    <DoctorLayout>
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 -ml-2 mb-2">
          <ArrowLeft className="h-4 w-4" /> Voltar ao resumo
        </Button>

        {/* CID Hero */}
        <Card className="border-purple-300 dark:border-purple-700 bg-purple-50/60 dark:bg-purple-950/30">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="w-14 h-14 rounded-xl bg-purple-600 text-white flex items-center justify-center text-lg font-bold shrink-0 shadow-sm">
              {certCid || detectedCid || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-purple-900 dark:text-purple-100 text-lg leading-tight">
                {cidPkg?.name ?? CID_PACKAGES[certCid]?.name ?? 'Selecione um CID'}
              </p>
              <p className="text-purple-600 dark:text-purple-400 text-sm mt-1">
                {(certCid || detectedCid)
                  ? 'Documentos pré-preenchidos com base na transcrição.'
                  : 'Escolha um CID abaixo para preencher medicamentos, exames e atestado automaticamente.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setCidPickerOpen(!cidPickerOpen)}
              className="shrink-0 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900">
              {cidPickerOpen ? 'Fechar' : 'Trocar CID'}
            </Button>
          </CardContent>
        </Card>

        {/* CID Picker */}
        {cidPickerOpen && (
          <Card className="border-purple-200 dark:border-purple-800">
            <CardContent className="py-4">
              <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase mb-3">Diagnósticos frequentes</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(CID_PACKAGES).map(([code, pkg]) => (
                  <button key={code} onClick={() => loadCid(code)}
                    className={`text-left p-3 rounded-xl border-[1.5px] transition-all ${
                      code === certCid
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 ring-1 ring-purple-300'
                        : 'border-border hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/20'}`}>
                    <span className="font-bold text-sm text-purple-700 dark:text-purple-300">{code}</span>
                    <span className="text-xs text-muted-foreground block mt-0.5 leading-snug">{pkg.name}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ RECEITA ═══ */}
        <Card className={`transition-opacity ${!rxOn ? 'opacity-50' : ''}`}>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => { if (!rxOn) { setRxOn(true); setRxOpen(true); } else setRxOpen(!rxOpen); }}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${rxOn ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <CardTitle className="text-base flex-1">Receita</CardTitle>
              {rxOn && <Badge variant="secondary" className="font-medium">{meds.length} ite{meds.length !== 1 ? 'ns' : 'm'}</Badge>}
              <Switch checked={rxOn} onCheckedChange={v => { setRxOn(v); if (v) setRxOpen(true); }}
                onClick={e => e.stopPropagation()} />
              {rxOn && (rxOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
            </div>
          </CardHeader>
          {rxOpen && rxOn && (
            <CardContent className="space-y-3 pt-0">
              <div className="flex gap-2">
                {(['simples', 'controlado'] as const).map(t => (
                  <button key={t} onClick={() => setRxType(t)}
                    className={`px-5 py-2 rounded-full text-sm font-medium border-[1.5px] transition-all ${
                      rxType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              {meds.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-3">
                    <Plus className="h-5 w-5 text-blue-400" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Nenhum medicamento adicionado</p>
                  <p className="text-xs text-muted-foreground mb-4">Selecione um CID acima para preencher automaticamente ou adicione manualmente.</p>
                  <Button variant="outline" size="sm" onClick={openAddMed} className="gap-2">
                    <Plus className="h-4 w-4" /> Adicionar medicamento
                  </Button>
                </div>
              ) : (
                <>
                  {meds.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 min-h-[50px] group">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600 dark:text-blue-400">
                        {i + 1}
                      </div>
                      <button className="flex-1 min-w-0 text-left" onClick={() => openEditMed(i)}>
                        <p className="font-medium text-sm">{m.drug || <span className="text-muted-foreground italic">Sem nome</span>}{m.concentration ? ` ${m.concentration}` : ''}</p>
                        {(m.posology || m.notes) && <p className="text-xs text-muted-foreground mt-0.5">{[m.posology, m.notes].filter(Boolean).join(' · ')}</p>}
                      </button>
                      <button onClick={() => openEditMed(i)} title="Editar"
                        className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="h-3.5 w-3.5 text-blue-500" />
                      </button>
                      <button onClick={() => setMeds(p => p.filter((_, j) => j !== i))} title="Remover"
                        className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={openAddMed}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-[1.5px] border-dashed border-border text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors">
                    <Plus className="h-4 w-4" /> Adicionar medicamento
                  </button>
                  <div className="pt-1">
                    <label htmlFor="rx-instructions" className="text-xs font-medium text-muted-foreground block mb-1.5">Instruções gerais (opcional)</label>
                    <Textarea id="rx-instructions" value={rxGeneralInstructions} onChange={e => setRxGeneralInstructions(e.target.value)} rows={2}
                      placeholder="Ex: Tomar após as refeições. Evitar álcool. Retornar em 15 dias." className="text-sm" />
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>

        {/* ═══ EXAMES ═══ */}
        <Card className={`transition-opacity ${!exOn ? 'opacity-50' : ''}`}>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => { if (!exOn) { setExOn(true); setExOpen(true); } else setExOpen(!exOpen); }}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${exOn ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <CardTitle className="text-base flex-1">Exames</CardTitle>
              {exOn && <Badge variant="secondary" className="font-medium">{exams.length} exame{exams.length !== 1 ? 's' : ''}</Badge>}
              <Switch checked={exOn} onCheckedChange={v => { setExOn(v); if (v) setExOpen(true); }}
                onClick={e => e.stopPropagation()} />
              {exOn && (exOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
            </div>
          </CardHeader>
          {exOpen && exOn && (
            <CardContent className="space-y-3 pt-0">
              <p className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">Pacotes rápidos</p>
              <div className="grid grid-cols-2 gap-2">
                {examPackagesDisplay.map(p => (
                  <button key={p.key} onClick={() => loadExamPkg(p.key)}
                    className="text-left p-3 rounded-xl border-[1.5px] border-border hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all">
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.exams.length} exames</p>
                  </button>
                ))}
              </div>
              <hr className="border-gray-100" />
              {exams.slice(0, exListExpanded ? undefined : 3).map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 min-h-[46px] group">
                  <button className="font-medium text-sm flex-1 text-left" onClick={() => openEditExam(i)}>
                    {e.description || <span className="text-muted-foreground italic">Sem descrição</span>}
                  </button>
                  <button onClick={() => openEditExam(i)} title="Editar"
                    className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-3.5 w-3.5 text-blue-500" />
                  </button>
                  <button onClick={() => setExams(p => p.filter((_, j) => j !== i))} title="Remover"
                    className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0 hover:bg-red-100 dark:hover:bg-red-900/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              ))}
              {exams.length > 3 && (
                <button onClick={() => setExListExpanded(!exListExpanded)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg">
                  {exListExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Recolher</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver todos ({exams.length})</>}
                </button>
              )}
              <button
                onClick={openAddExam}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-[1.5px] border-dashed border-border text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors">
                <Plus className="h-4 w-4" /> Adicionar exame avulso
              </button>
              <div className="pt-1">
                <label htmlFor="exam-just" className="text-xs font-medium text-muted-foreground block mb-1.5">Justificativa clínica</label>
                <Textarea id="exam-just" value={examJust} onChange={e => setExamJust(e.target.value)} rows={2}
                  placeholder="Preenchida ao selecionar pacote" className="text-sm" />
              </div>
            </CardContent>
          )}
        </Card>

        {/* ═══ ATESTADO ═══ */}
        <Card className={`transition-opacity ${!atOn ? 'opacity-50' : ''}`}>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => { if (!atOn) { setAtOn(true); setAtOpen(true); } else setAtOpen(!atOpen); }}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${atOn ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <CardTitle className="text-base flex-1">Atestado</CardTitle>
              {atOn && <Badge variant="secondary" className="font-medium">{certDays} dia{certDays !== 1 ? 's' : ''}</Badge>}
              <Switch checked={atOn} onCheckedChange={v => { setAtOn(v); if (v) setAtOpen(true); }}
                onClick={e => e.stopPropagation()} />
              {atOn && (atOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
            </div>
          </CardHeader>
          {atOpen && atOn && (
            <CardContent className="space-y-3 pt-0">
              <div className="flex gap-2">
                {(['afastamento', 'comparecimento', 'aptidao'] as const).map(t => (
                  <button key={t} onClick={() => setCertType(t)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border-[1.5px] transition-all ${
                      certType === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                    {t.charAt(0).toUpperCase() + t.slice(1).replace('ao', 'ão')}
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="cert-body" className="text-xs font-medium text-muted-foreground block mb-1.5">Motivo</label>
                <Textarea id="cert-body" value={certBody} onChange={e => setCertBody(e.target.value)} rows={3} className="text-sm" />
              </div>
              <div className="flex gap-3 items-end">
                <div className="w-20">
                  <label htmlFor="cert-cid" className="text-xs font-medium text-muted-foreground block mb-1.5">CID</label>
                  <Input id="cert-cid" value={certCid} onChange={e => setCertCid(e.target.value.toUpperCase())}
                    className="text-center font-semibold text-base" />
                </div>
                <div className="w-28">
                  <label id="cert-days-label" htmlFor="cert-days" className="text-xs font-medium text-muted-foreground block mb-1.5">Dias</label>
                  <input id="cert-days" type="number" value={certDays} readOnly aria-hidden className="sr-only" tabIndex={-1} />
                  <div role="spinbutton" aria-labelledby="cert-days-label" aria-valuenow={certDays} className="flex items-center border rounded-xl overflow-hidden h-11 bg-gray-50">
                    <button onClick={() => setCertDays(Math.max(1, certDays - 1))} className="w-11 h-full flex items-center justify-center hover:bg-gray-100">
                      <Minus className="h-4 w-4 text-gray-500" />
                    </button>
                    <span className="flex-1 text-center font-semibold text-lg">{certDays}</span>
                    <button onClick={() => setCertDays(Math.min(30, certDays + 1))} className="w-11 h-full flex items-center justify-center hover:bg-gray-100">
                      <Plus className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>
                <div className="flex-1">
                  <label htmlFor="cert-start" className="text-xs font-medium text-muted-foreground block mb-1.5">Início</label>
                  <Input id="cert-start" value={new Date().toLocaleDateString('pt-BR')} readOnly className="bg-gray-50 text-muted-foreground" />
                </div>
              </div>
              <label htmlFor="cert-include-cid" className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
                <input id="cert-include-cid" type="checkbox" checked={certIncludeCid} onChange={e => setCertIncludeCid(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded" />
                <span className="text-sm text-muted-foreground">Incluir CID no atestado (paciente autorizou)</span>
              </label>
            </CardContent>
          )}
        </Card>

        {/* ═══ ENCAMINHAMENTO ═══ */}
        <Card className={`transition-opacity ${!refOn ? 'opacity-50' : ''}`}>
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => { if (!refOn) { setRefOn(true); setRefOpen(true); } else setRefOpen(!refOpen); }}>
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${refOn ? 'bg-violet-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <CardTitle className="text-base flex-1">Encaminhamento</CardTitle>
              {refOn && (
                <Badge variant="secondary" className="font-medium">
                  {refProfessional.trim() || 'Médico/Prof.'}
                </Badge>
              )}
              <Switch checked={refOn} onCheckedChange={v => { setRefOn(v); if (v) setRefOpen(true); }}
                onClick={e => e.stopPropagation()} />
              {refOn && (refOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
            </div>
          </CardHeader>
          {refOpen && refOn && (
            <CardContent className="space-y-3 pt-0">
              <p className="text-xs text-muted-foreground">
                Encaminhe o paciente para avaliação presencial conforme anamnese.
              </p>
              <div>
                <label htmlFor="ref-professional" className="text-xs font-medium text-muted-foreground block mb-1.5">Médico ou profissional</label>
                <Input id="ref-professional" value={refProfessional} onChange={e => setRefProfessional(e.target.value)}
                  placeholder="Ex: Dr. João Silva" className="text-sm" />
              </div>
              <div>
                <label htmlFor="ref-specialty" className="text-xs font-medium text-muted-foreground block mb-1.5">Especialidade</label>
                <Input id="ref-specialty" value={refSpecialty} onChange={e => setRefSpecialty(e.target.value)}
                  placeholder="Ex: Cardiologia, Fisioterapia" className="text-sm" />
              </div>
              <div>
                <label htmlFor="ref-reason" className="text-xs font-medium text-muted-foreground block mb-1.5">Motivo / Indicação</label>
                <Textarea id="ref-reason" value={refReason} onChange={e => setRefReason(e.target.value)} rows={3}
                  placeholder="Conforme anamnese, para avaliação de..." className="text-sm" />
              </div>
            </CardContent>
          )}
        </Card>

        {/* ═══ RESUMO + CTAs ═══ */}
        {docCount > 0 ? (
          <Card className="border-green-300 dark:border-green-800 bg-green-50/60 dark:bg-green-950/20">
            <CardContent className="py-4">
              <p className="font-semibold text-green-800 dark:text-green-200">
                {docCount} documento{docCount !== 1 ? 's' : ''} pronto{docCount !== 1 ? 's' : ''} para assinatura
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {rxValid && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-100">Receita ({meds.length})</Badge>}
                {exValid && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-100">Exames ({exams.length})</Badge>}
                {atValid && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-100">Atestado ({certDays}d)</Badge>}
                {refValid && <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-100">Encaminhamento</Badge>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-muted/30">
            <CardContent className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Ative pelo menos um documento e preencha os campos obrigatórios para emitir.
              </p>
            </CardContent>
          </Card>
        )}

        <Button size="lg"
          className="w-full h-14 text-base gap-2 rounded-2xl shadow-sm"
          onClick={handleSignClick} disabled={submitting || docCount === 0}>
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
          Assinar e emitir {docCount > 0 ? `${docCount} documento${docCount !== 1 ? 's' : ''}` : 'documentos'}
        </Button>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Assinatura digital ICP-Brasil · QR Code verificável · Prontuário atualizado automaticamente
        </p>
      </div>

      {/* ── Medication Dialog (aligned with mobile modal) ── */}
      <Dialog open={medDialogOpen} onOpenChange={setMedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMedIndex !== null ? 'Editar medicamento' : 'Adicionar medicamento'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do medicamento conforme a prescrição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label htmlFor="med-drug" className="text-xs font-medium text-muted-foreground block mb-1.5">Medicamento *</label>
              <Input id="med-drug" value={medForm.drug} onChange={e => setMedForm(f => ({ ...f, drug: e.target.value }))}
                placeholder="Ex: Dipirona 500mg" />
            </div>
            <div>
              <label htmlFor="med-concentration" className="text-xs font-medium text-muted-foreground block mb-1.5">Concentração (opcional)</label>
              <Input id="med-concentration" value={medForm.concentration ?? ''} onChange={e => setMedForm(f => ({ ...f, concentration: e.target.value }))}
                placeholder="Ex: 500mg" />
            </div>
            <div>
              <label htmlFor="med-posology" className="text-xs font-medium text-muted-foreground block mb-1.5">Posologia (opcional)</label>
              <Input id="med-posology" value={medForm.posology ?? ''} onChange={e => setMedForm(f => ({ ...f, posology: e.target.value }))}
                placeholder="Ex: VO 6/6h por 5 dias" />
            </div>
            <div>
              <label htmlFor="med-notes" className="text-xs font-medium text-muted-foreground block mb-1.5">Indicação (opcional)</label>
              <Input id="med-notes" value={medForm.notes ?? ''} onChange={e => setMedForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Ex: Febre e dor"
                onKeyDown={e => { if (e.key === 'Enter') saveMed(); }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMedDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveMed}>{editingMedIndex !== null ? 'Salvar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Exam Dialog (aligned with mobile modal) ── */}
      <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExamIndex !== null ? 'Editar exame' : 'Adicionar exame avulso'}</DialogTitle>
            <DialogDescription>
              Informe a descrição do exame a ser solicitado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label htmlFor="exam-desc" className="text-xs font-medium text-muted-foreground block mb-1.5">Descrição do exame *</label>
              <Input id="exam-desc" value={examForm.description} onChange={e => setExamForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Hemograma completo"
                onKeyDown={e => { if (e.key === 'Enter') saveExam(); }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExamDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveExam}>{editingExamIndex !== null ? 'Salvar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Password Dialog ── */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Senha do Certificado Digital
            </DialogTitle>
            <DialogDescription>
              Informe a senha do seu certificado A1 (PFX) para assinar os {docCount} documento(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              type="password"
              placeholder="Senha do certificado"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && certPassword) handleSubmit(); }}
            />
            <p className="text-xs text-muted-foreground">
              A senha é usada apenas para validar o certificado. Não é armazenada.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasswordDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!certPassword || submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Assinar e emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
