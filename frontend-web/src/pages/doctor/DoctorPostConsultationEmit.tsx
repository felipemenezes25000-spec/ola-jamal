/**
 * DoctorPostConsultationEmit — Emissao de documentos pos-consulta (web).
 * Design alinhado ao mockup aprovado. Usa shadcn/ui + Tailwind.
 * Receita + Exames (com pacotes) + Atestado, pre-preenchidos pela IA.
 *
 * Responsive: mobile full-width, desktop max-w-4xl centered with 2-col where appropriate.
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
  Loader2, ArrowLeft, X, Plus, ChevronDown, ChevronUp, ShieldCheck, Send, Minus, Lock,
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
    meds: [{ drug: 'Metformina 850mg', posology: 'VO 2x/dia contínuo', note: '1a linha DM2' },
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

  const examPackagesDisplay = useMemo(() => {
    const pkgs = request?.examQuickPackages;
    if (pkgs && pkgs.length > 0) {
      return pkgs.map((p) => ({ key: p.key, name: p.name, exams: p.exams, just: p.justification }));
    }
    return EXAM_PACKAGES;
  }, [request?.examQuickPackages]);

  // Document toggles
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

  // Prescription
  const [rxType, setRxType] = useState<'simples' | 'controlado'>('simples');
  const [meds, setMeds] = useState<PrescriptionItemEmit[]>([]);

  // Exams
  const [exams, setExams] = useState<ExamItemEmitWeb[]>([]);
  const [examJust, setExamJust] = useState(cidPkg?.examJust ?? '');

  // Certificate
  const [certType, setCertType] = useState<'afastamento' | 'comparecimento' | 'aptidao'>('afastamento');
  const [certBody, setCertBody] = useState(cidPkg?.body ?? '');
  const [certCid, setCertCid] = useState(detectedCid ?? '');
  const [certDays, setCertDays] = useState(cidPkg?.days ?? 3);
  const [certIncludeCid, setCertIncludeCid] = useState(true);

  // Referral
  const [refProfessional, setRefProfessional] = useState('');
  const [refSpecialty, setRefSpecialty] = useState('');
  const [refReason, setRefReason] = useState('');

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    getRequestById(requestId)
      .then(r => { if (!cancelled) { setRequest(r); setLoading(false); } })
      .catch(() => { if (!cancelled) { toast.error('Erro ao carregar consulta'); navigate(-1); } });
    return () => { cancelled = true; };
  }, [requestId, navigate]);

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

  const docCount = (rxOn ? 1 : 0) + (exOn ? 1 : 0) + (atOn ? 1 : 0) + (refOn ? 1 : 0);

  // Password dialog state
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
      const validMeds = meds.filter(m => m.drug.trim());
      if (rxOn && validMeds.length > 0) payload.prescription = { type: rxType, items: validMeds };
      const validExams = exams.filter(e => e.description.trim());
      if (exOn && validExams.length > 0) payload.examOrder = { clinicalJustification: examJust, items: validExams };
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

  // Patient info helpers
  const patientName = request?.patientName ?? 'Paciente';
  const patientGender = request?.patientGender;
  const patientAge = useMemo(() => {
    const bd = request?.patientBirthDate;
    if (!bd) return null;
    const birth = new Date(bd);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }, [request?.patientBirthDate]);
  const patientInitials = patientName
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (loading) return (
    <DoctorLayout>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </DoctorLayout>
  );

  return (
    <DoctorLayout>
      <div className="min-h-screen bg-gray-50/50">
        {/* ── Dark Header ── */}
        <div className="bg-[#0F2942] text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
                Pos-consulta
              </h1>
            </div>
          </div>
        </div>

        {/* ── Patient Bar ── */}
        <div className="bg-[#1B2D45] text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
                {patientInitials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base truncate">{patientName}</p>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  {patientAge != null && <span>{patientAge} anos</span>}
                  {patientAge != null && patientGender && <span aria-hidden>·</span>}
                  {patientGender && <span>{patientGender}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">

          {/* CID Selection */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-sm px-3 py-1.5 rounded-full">
              Pre-preenchida pela IA
            </Badge>
            <div className="flex items-center gap-2 bg-white border rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-sm font-semibold text-purple-700">
                {certCid || detectedCid || '--'}
              </span>
              <span className="text-sm text-muted-foreground">
                {cidPkg?.name ?? CID_PACKAGES[certCid]?.name ?? 'Selecionar CID'}
              </span>
              <button
                onClick={() => setCidPickerOpen(!cidPickerOpen)}
                className="ml-1 text-xs text-blue-600 font-medium hover:underline"
              >
                Trocar
              </button>
            </div>
          </div>

          {/* CID Picker */}
          {cidPickerOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(CID_PACKAGES).map(([code, pkg]) => (
                <button key={code} onClick={() => loadCid(code)}
                  className={`text-left p-3 rounded-xl border-[1.5px] transition-all ${
                    code === certCid ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <span className="font-semibold text-sm">{code}</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">{pkg.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Desktop 2-column layout for Receita + Exames ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ═══ RECEITA ═══ */}
            <Card className={`${!rxOn ? 'opacity-35 pointer-events-none' : ''} shadow-sm border-0 ring-1 ring-gray-200`}>
              <CardHeader className="pb-2 cursor-pointer bg-white rounded-t-lg" onClick={() => rxOn && setRxOpen(!rxOpen)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  </div>
                  <CardTitle className="text-base flex-1">Receita</CardTitle>
                  <Badge variant="secondary" className="font-medium text-xs">{meds.length} ite{meds.length !== 1 ? 'ns' : 'm'}</Badge>
                  <Switch checked={rxOn} onCheckedChange={v => { setRxOn(v); if (v) setRxOpen(true); }}
                    onClick={e => e.stopPropagation()} />
                  {rxOn && (rxOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
                </div>
              </CardHeader>
              {rxOpen && rxOn && (
                <CardContent className="space-y-3 pt-0">
                  <div className="flex gap-2 flex-wrap">
                    {(['simples', 'controlado'] as const).map(t => (
                      <button key={t} onClick={() => setRxType(t)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all ${
                          rxType === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {meds.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 min-h-[50px]">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{m.drug}{m.concentration ? ` ${m.concentration}` : ''}</p>
                          {(m.posology || m.notes) && <p className="text-xs text-muted-foreground mt-0.5 truncate">{[m.posology, m.notes].filter(Boolean).join(' · ')}</p>}
                        </div>
                        <button onClick={() => setMeds(p => p.filter((_, j) => j !== i))}
                          className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors">
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setMeds(prev => [...prev, { drug: '' }])}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-[1.5px] border-dashed border-gray-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors">
                    <Plus className="h-4 w-4" /> Adicionar medicamento
                  </button>
                </CardContent>
              )}
            </Card>

            {/* ═══ EXAMES ═══ */}
            <Card className={`${!exOn ? 'opacity-35 pointer-events-none' : ''} shadow-sm border-0 ring-1 ring-gray-200`}>
              <CardHeader className="pb-2 cursor-pointer bg-white rounded-t-lg" onClick={() => exOn && setExOpen(!exOpen)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <CardTitle className="text-base flex-1">Exames</CardTitle>
                  <Badge variant="secondary" className="font-medium text-xs">{exams.length} exame{exams.length !== 1 ? 's' : ''}</Badge>
                  <Switch checked={exOn} onCheckedChange={v => { setExOn(v); if (v) setExOpen(true); }}
                    onClick={e => e.stopPropagation()} />
                  {exOn && (exOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
                </div>
              </CardHeader>
              {exOpen && exOn && (
                <CardContent className="space-y-3 pt-0">
                  <p className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">Pacotes rapidos</p>
                  <div className="flex flex-wrap gap-2">
                    {examPackagesDisplay.map(p => (
                      <button key={p.key} onClick={() => loadExamPkg(p.key)}
                        className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all">
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <hr className="border-gray-100" />
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {exams.slice(0, exListExpanded ? undefined : 3).map((e, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 min-h-[46px]">
                        <p className="font-medium text-sm flex-1 truncate">{e.description}</p>
                        <button onClick={() => setExams(p => p.filter((_, j) => j !== i))}
                          className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors">
                          <X className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {exams.length > 3 && (
                    <button onClick={() => setExListExpanded(!exListExpanded)}
                      className="w-full flex items-center justify-center gap-1 py-2 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg transition-colors">
                      {exListExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> Recolher</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver todos ({exams.length})</>}
                    </button>
                  )}
                  <button
                    onClick={() => setExams(prev => [...prev, { type: 'laboratorial', description: '' }])}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-[1.5px] border-dashed border-gray-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors">
                    <Plus className="h-4 w-4" /> Adicionar exame avulso
                  </button>
                  <div className="pt-1">
                    <label htmlFor="exam-just" className="text-xs font-medium text-muted-foreground block mb-1.5">Justificativa clinica</label>
                    <Textarea id="exam-just" value={examJust} onChange={e => setExamJust(e.target.value)} rows={2}
                      placeholder="Preenchida ao selecionar pacote" className="text-sm" />
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ── Desktop 2-column for Atestado + Encaminhamento ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ═══ ATESTADO ═══ */}
            <Card className={`${!atOn ? 'opacity-35 pointer-events-none' : ''} shadow-sm border-0 ring-1 ring-gray-200`}>
              <CardHeader className="pb-2 cursor-pointer bg-white rounded-t-lg" onClick={() => atOn && setAtOpen(!atOpen)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  </div>
                  <CardTitle className="text-base flex-1">Atestado</CardTitle>
                  <Badge variant="secondary" className="font-medium text-xs">{certDays} dia{certDays !== 1 ? 's' : ''}</Badge>
                  <Switch checked={atOn} onCheckedChange={v => { setAtOn(v); if (v) setAtOpen(true); }}
                    onClick={e => e.stopPropagation()} />
                  {atOn && (atOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />)}
                </div>
              </CardHeader>
              {atOpen && atOn && (
                <CardContent className="space-y-3 pt-0">
                  <div className="flex gap-2 flex-wrap">
                    {(['afastamento', 'comparecimento', 'aptidao'] as const).map(t => (
                      <button key={t} onClick={() => setCertType(t)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border-[1.5px] transition-all ${
                          certType === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {t.charAt(0).toUpperCase() + t.slice(1).replace('ao', 'ao')}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label htmlFor="cert-body" className="text-xs font-medium text-muted-foreground block mb-1.5">Motivo</label>
                    <Textarea id="cert-body" value={certBody} onChange={e => setCertBody(e.target.value)} rows={3} className="text-sm" />
                  </div>
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="w-20">
                      <label htmlFor="cert-cid" className="text-xs font-medium text-muted-foreground block mb-1.5">CID</label>
                      <Input id="cert-cid" value={certCid} onChange={e => setCertCid(e.target.value.toUpperCase())}
                        className="text-center font-semibold text-base" />
                    </div>
                    <div className="w-28">
                      <label id="cert-days-label" htmlFor="cert-days" className="text-xs font-medium text-muted-foreground block mb-1.5">Dias</label>
                      <input id="cert-days" type="number" value={certDays} readOnly aria-hidden className="sr-only" tabIndex={-1} />
                      <div role="spinbutton" aria-labelledby="cert-days-label" aria-valuenow={certDays} className="flex items-center border rounded-xl overflow-hidden h-11 bg-gray-50">
                        <button onClick={() => setCertDays(Math.max(1, certDays - 1))} className="w-11 h-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                          <Minus className="h-4 w-4 text-gray-500" />
                        </button>
                        <span className="flex-1 text-center font-semibold text-lg">{certDays}</span>
                        <button onClick={() => setCertDays(Math.min(30, certDays + 1))} className="w-11 h-full flex items-center justify-center hover:bg-gray-100 transition-colors">
                          <Plus className="h-4 w-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label htmlFor="cert-start" className="text-xs font-medium text-muted-foreground block mb-1.5">Inicio</label>
                      <Input id="cert-start" value={new Date().toLocaleDateString('pt-BR')} readOnly className="bg-gray-50 text-muted-foreground" />
                    </div>
                  </div>
                  <label htmlFor="cert-include-cid" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 cursor-pointer">
                    <input id="cert-include-cid" type="checkbox" checked={certIncludeCid} onChange={e => setCertIncludeCid(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded" />
                    <span className="text-sm text-gray-600">Incluir CID no atestado (paciente autorizou)</span>
                  </label>
                </CardContent>
              )}
            </Card>

            {/* ═══ ENCAMINHAMENTO ═══ */}
            <Card className={`${!refOn ? 'opacity-35 pointer-events-none' : ''} shadow-sm border-0 ring-1 ring-gray-200`}>
              <CardHeader className="pb-2 cursor-pointer bg-white rounded-t-lg" onClick={() => refOn && setRefOpen(!refOpen)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                  </div>
                  <CardTitle className="text-base flex-1">Encaminhamento</CardTitle>
                  <Badge variant="secondary" className="font-medium text-xs">
                    {refProfessional.trim() || 'Médico/Prof.'}
                  </Badge>
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
                    <label htmlFor="ref-reason" className="text-xs font-medium text-muted-foreground block mb-1.5">Motivo / Indicacao</label>
                    <Textarea id="ref-reason" value={refReason} onChange={e => setRefReason(e.target.value)} rows={3}
                      placeholder="Conforme anamnese, para avaliacao de..." className="text-sm" />
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ═══ SUMMARY + SIGN ═══ */}
          <div className="space-y-3 pt-2">
            <Card className="border-0 ring-1 ring-gray-200 bg-white shadow-sm">
              <CardContent className="py-4">
                <p className="font-semibold text-gray-800 text-sm sm:text-base">
                  {docCount} documento{docCount !== 1 ? 's' : ''} pronto{docCount !== 1 ? 's' : ''} para assinatura
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {rxOn && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Receita ({meds.length})</Badge>}
                  {exOn && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Exames ({exams.length})</Badge>}
                  {atOn && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Atestado ({certDays}d)</Badge>}
                  {refOn && <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">Encaminhamento</Badge>}
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full h-14 text-base gap-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-white rounded-2xl shadow-lg shadow-sky-500/20 transition-all"
              onClick={handleSignClick}
              disabled={submitting || docCount === 0}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
              Assinar todos (ICP-Brasil)
            </Button>

            <Button variant="outline" size="lg" className="w-full h-12 gap-2 border-green-500 text-green-700 hover:bg-green-50 rounded-2xl">
              <Send className="h-4 w-4" /> Enviar por WhatsApp
            </Button>

            <p className="text-center text-xs text-muted-foreground pb-4">
              Assinatura digital ICP-Brasil · QR Code verificável · Prontuário atualizado automaticamente
            </p>
          </div>
        </div>
      </div>

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
