/**
 * DoctorPostConsultationEmit — Emissao de documentos pos-consulta (web).
 * Design alinhado ao mockup aprovado. Usa shadcn/ui + Tailwind.
 * Receita + Exames (com pacotes) + Encaminhamento, pre-preenchidos pela IA.
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Send,
  Lock,
} from 'lucide-react';

// ── CID Packages (same data as mobile) ──
const CID_PACKAGES: Record<
  string,
  {
    name: string;
    days: number;
    body: string;
    meds: { drug: string; posology: string; note: string }[];
    exams: string[];
    examJust: string;
  }
> = {
  J11: {
    name: 'Gripe (Influenza)',
    days: 3,
    body: 'Paciente apresenta síndrome gripal com febre, necessitando repouso domiciliar.',
    meds: [
      {
        drug: 'Dipirona 500mg',
        posology: 'VO 6/6h por 5 dias',
        note: 'Febre e dor',
      },
      {
        drug: 'Loratadina 10mg',
        posology: 'VO 1x/dia por 7 dias',
        note: 'Congestão',
      },
      {
        drug: 'Oseltamivir 75mg',
        posology: 'VO 12/12h por 5 dias',
        note: 'Antiviral (se <48h)',
      },
    ],
    exams: ['Hemograma completo', 'PCR', 'VHS'],
    examJust: 'Investigação de quadro gripal febril.',
  },
  I10: {
    name: 'Hipertensão arterial',
    days: 0,
    body: '',
    meds: [
      { drug: 'Losartana 50mg', posology: 'VO 1x/dia contínuo', note: 'BRA' },
      { drug: 'HCTZ 25mg', posology: 'VO 1x/dia contínuo', note: 'Diurético' },
      { drug: 'Anlodipino 5mg', posology: 'VO 1x/dia contínuo', note: 'BCC' },
    ],
    exams: [
      'Creatinina',
      'Ureia',
      'Na/K',
      'Lipidograma',
      'Glicemia jejum',
      'HbA1c',
      'Ácido úrico',
      'Urina I',
      'ECG',
      'Microalbuminúria',
    ],
    examJust: 'Acompanhamento de HAS.',
  },
  E11: {
    name: 'Diabetes tipo 2',
    days: 0,
    body: '',
    meds: [
      {
        drug: 'Metformina 850mg',
        posology: 'VO 2x/dia contínuo',
        note: '1a linha DM2',
      },
      {
        drug: 'Glicazida 60mg',
        posology: 'VO 1x/dia contínuo',
        note: 'Sulfonilureia',
      },
    ],
    exams: [
      'Glicemia jejum',
      'HbA1c',
      'Lipidograma',
      'Creatinina',
      'Ureia',
      'Microalbuminúria',
      'K+',
      'Na+',
      'TGO/TGP',
      'Urina I',
      'Fundo de olho',
    ],
    examJust: 'Controle DM2 e rastreio de complicações.',
  },
  F32: {
    name: 'Episódio depressivo',
    days: 5,
    body: 'Episódio depressivo, necessitando afastamento para estabilização clínica.',
    meds: [
      { drug: 'Sertralina 50mg', posology: 'VO manhã contínuo', note: 'ISRS' },
      {
        drug: 'Clonazepam 0,5mg',
        posology: 'VO noite SOS 14 dias',
        note: 'Ansiedade',
      },
    ],
    exams: [
      'TSH',
      'T4 livre',
      'Hemograma',
      'Glicemia',
      'Vit D',
      'Vit B12',
      'Ferro',
      'Ferritina',
    ],
    examJust: 'Diagnóstico diferencial.',
  },
  M54: {
    name: 'Dorsalgia',
    days: 3,
    body: 'Dorsalgia aguda limitando atividades.',
    meds: [
      {
        drug: 'Ibuprofeno 600mg',
        posology: 'VO 8/8h por 5 dias',
        note: 'AINE',
      },
      {
        drug: 'Ciclobenzaprina 5mg',
        posology: 'VO noite por 7 dias',
        note: 'Relaxante',
      },
      { drug: 'Dipirona 1g', posology: 'VO 6/6h SOS', note: 'Dor' },
    ],
    exams: ['Hemograma', 'PCR', 'VHS', 'Rx coluna lombar'],
    examJust: 'Investigação de dorsalgia aguda.',
  },
  J06: {
    name: 'IVAS (Resfriado)',
    days: 2,
    body: 'Infecção aguda de vias aéreas superiores.',
    meds: [
      { drug: 'Paracetamol 750mg', posology: 'VO 6/6h SOS', note: 'Febre/dor' },
      { drug: 'NaCl 0,9% nasal', posology: '3 gotas 4x/dia', note: 'Lavagem' },
      {
        drug: 'Loratadina 10mg',
        posology: 'VO 1x/dia 5 dias',
        note: 'Congestão',
      },
    ],
    exams: ['Hemograma'],
    examJust: 'IVAS viral.',
  },
  N39: {
    name: 'Infecção urinária',
    days: 2,
    body: 'ITU em tratamento antibiótico.',
    meds: [
      { drug: 'Norfloxacino 400mg', posology: 'VO 12/12h 7 dias', note: 'ATB' },
      {
        drug: 'Fenazopiridina 200mg',
        posology: 'VO 8/8h 3 dias',
        note: 'Analgesia',
      },
    ],
    exams: ['EAS', 'Urocultura', 'Creatinina', 'Hemograma'],
    examJust: 'Confirmação ITU.',
  },
  K21: {
    name: 'Refluxo (DRGE)',
    days: 0,
    body: '',
    meds: [
      { drug: 'Omeprazol 20mg', posology: 'VO jejum 30 dias', note: 'IBP' },
      {
        drug: 'Domperidona 10mg',
        posology: 'VO 3x/dia 14 dias',
        note: 'Procinético',
      },
    ],
    exams: ['Hemograma', 'H. pylori'],
    examJust: 'Investigação DRGE.',
  },
  J45: {
    name: 'Asma',
    days: 2,
    body: 'Crise asmática leve.',
    meds: [
      {
        drug: 'Salbutamol 100mcg',
        posology: '2 jatos 4/4h SOS',
        note: 'Resgate',
      },
      { drug: 'Budesonida 200mcg', posology: '2 jatos 12/12h', note: 'CI' },
      {
        drug: 'Prednisolona 20mg',
        posology: 'VO 1x/dia 5 dias',
        note: 'Crise',
      },
    ],
    exams: ['Hemograma', 'IgE total', 'Rx tórax', 'Espirometria'],
    examJust: 'Crise asmática.',
  },
};

const EXAM_PACKAGES = [
  {
    key: 'checkup',
    name: 'Check-up completo',
    exams: [
      'Hemograma',
      'Glicemia',
      'HbA1c',
      'Colesterol total/frações',
      'Triglicerídeos',
      'TGO',
      'TGP',
      'GGT',
      'Bilirrubinas',
      'Ureia',
      'Creatinina',
      'Ácido úrico',
      'TSH',
      'T4 livre',
      'Vit D',
      'Vit B12',
      'Ferro',
      'Ferritina',
      'PCR',
      'VHS',
      'Na/K/Ca',
      'Urina I',
      'Parasitológico',
    ],
    just: 'Check-up preventivo.',
  },
  {
    key: 'ist',
    name: 'IST/Sorologias',
    exams: [
      'VDRL',
      'Anti-HIV',
      'HBsAg',
      'Anti-HCV',
      'Anti-HBs',
      'Toxo IgG/IgM',
      'CMV IgG/IgM',
      'Rubéola IgG/IgM',
    ],
    just: 'Rastreamento de ISTs.',
  },
  {
    key: 'prenatal',
    name: 'Pré-natal',
    exams: [
      'Hemograma',
      'ABO/Rh',
      'Coombs',
      'Glicemia',
      'TOTG 75g',
      'VDRL',
      'Anti-HIV',
      'HBsAg',
      'Anti-HCV',
      'Toxo IgG/IgM',
      'Rubéola IgG/IgM',
      'CMV IgG/IgM',
      'TSH',
      'T4 livre',
      'Urina I',
      'Urocultura',
      'Parasitológico',
    ],
    just: 'Rotina pré-natal ministerial.',
  },
  {
    key: 'cardio',
    name: 'Risco cardiovascular',
    exams: [
      'Lipidograma',
      'Glicemia',
      'HbA1c',
      'PCR-us',
      'Homocisteína',
      'Lp(a)',
      'CPK',
      'Troponina',
      'BNP',
      'Ácido úrico',
      'Na/K',
    ],
    just: 'Risco cardiovascular.',
  },
  {
    key: 'tireoide',
    name: 'Tireoide',
    exams: ['TSH', 'T4 livre', 'T3 total', 'Anti-TPO', 'Anti-tireoglobulina'],
    just: 'Avaliação tireoidiana.',
  },
  {
    key: 'renal',
    name: 'Função renal',
    exams: [
      'Creatinina',
      'Ureia',
      'Ácido úrico',
      'Na',
      'K',
      'Ca',
      'Fósforo',
      'TFG',
      'Urina I',
      'Microalbuminúria',
      'Proteinúria 24h',
    ],
    just: 'Avaliação renal.',
  },
  {
    key: 'hepatico',
    name: 'Perfil hepático',
    exams: [
      'TGO',
      'TGP',
      'GGT',
      'Fosfatase alcalina',
      'Bilirrubinas',
      'Albumina',
      'Proteínas totais',
      'TAP/INR',
      'LDH',
    ],
    just: 'Perfil hepático.',
  },
];

function extractMedsFromAnamnesis(
  anam: Record<string, unknown> | null
): PrescriptionItemEmit[] {
  if (!anam?.medicamentos_sugeridos) return [];
  const arr = anam.medicamentos_sugeridos as Array<
    Record<string, string> | string
  >;
  return arr.map((m) => {
    if (typeof m === 'string') return { drug: m };
    return {
      drug: m.nome ?? 'Medicamento',
      posology: m.posologia ?? undefined,
      notes: m.indicacao ?? undefined,
    };
  });
}

function extractExamsFromAnamnesis(
  anam: Record<string, unknown> | null
): ExamItemEmitWeb[] {
  if (!anam?.exames_sugeridos) return [];
  const arr = anam.exames_sugeridos as Array<Record<string, string> | string>;
  return arr.map((e) => {
    if (typeof e === 'string') return { type: 'laboratorial', description: e };
    return { type: 'laboratorial', description: e.nome ?? 'Exame' };
  });
}

function extractReferralFromAnamnesis(
  anam: Record<string, unknown> | null
): { professional?: string; specialty?: string; reason?: string } | null {
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
  const [request, setRequest] = useState<Awaited<
    ReturnType<typeof getRequestById>
  > | null>(null);

  const anamnesis = useMemo(() => {
    if (!request?.consultationAnamnesis) return null;
    try {
      return JSON.parse(request.consultationAnamnesis);
    } catch {
      return null;
    }
  }, [request?.consultationAnamnesis]);

  const detectedCid: string | null = useMemo(() => {
    if (!anamnesis) return null;
    const dd = anamnesis.diagnostico_diferencial;
    if (!Array.isArray(dd) || dd.length === 0) return null;
    const first = dd[0] as Record<string, string> | undefined;
    return first?.cid ?? null;
  }, [anamnesis]);
  const cidPkg = detectedCid ? CID_PACKAGES[detectedCid] : null;

  const isPsy = request?.consultationType === 'psicologo';

  const examPackagesDisplay = useMemo(() => {
    const pkgs = request?.examQuickPackages;
    if (pkgs && pkgs.length > 0) {
      return pkgs.map((p) => ({
        key: p.key,
        name: p.name,
        exams: p.exams,
        just: p.justification,
      }));
    }
    return EXAM_PACKAGES;
  }, [request?.examQuickPackages]);

  // Document toggles — psychologist: only referral
  const [rxOn, setRxOn] = useState(!isPsy);
  const [exOn, setExOn] = useState(false);
  const [refOn, setRefOn] = useState(isPsy);

  // Sections
  const [rxOpen, setRxOpen] = useState(true);
  const [exOpen, setExOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [cidPickerOpen, setCidPickerOpen] = useState(false);
  const [exListExpanded, setExListExpanded] = useState(false);

  // Prescription
  const [rxType, setRxType] = useState<'simples' | 'controlado'>('simples');
  const [meds, setMeds] = useState<PrescriptionItemEmit[]>([]);

  // Exams
  const [exams, setExams] = useState<ExamItemEmitWeb[]>([]);
  const [examJust, setExamJust] = useState(cidPkg?.examJust ?? '');

  // Selected CID (shared by CID picker, payload, referral)
  const [certCid, setCertCid] = useState(detectedCid ?? '');

  // Referral
  const [refProfessional, setRefProfessional] = useState('');
  const [refSpecialty, setRefSpecialty] = useState('');
  const [refReason, setRefReason] = useState('');

  useEffect(() => {
    if (!requestId) return;
    let cancelled = false;
    getRequestById(requestId)
      .then((r) => {
        if (!cancelled) {
          setRequest(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Erro ao carregar consulta');
          navigate(-1);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, navigate]);

  useEffect(() => {
    if (!request) return;
    const psy = request.consultationType === 'psicologo';

    // Psychologist: disable prescription/exams, enable referral only
    if (psy) {
      setRxOn(false);
      setRxOpen(false);
      setExOn(false);
      setExOpen(false);
      setRefOn(true);
      setRefOpen(true);
    } else {
      const aiMeds = extractMedsFromAnamnesis(anamnesis);
      const aiExams = extractExamsFromAnamnesis(anamnesis);
      const pkg = detectedCid ? CID_PACKAGES[detectedCid] : null;

      const finalMeds =
        aiMeds.length > 0
          ? aiMeds
          : (pkg?.meds.map((m) => ({
              drug: m.drug,
              posology: m.posology,
              notes: m.note,
            })) ?? []);
      const finalExams =
        aiExams.length > 0
          ? aiExams
          : (pkg?.exams.map((e) => ({
              type: 'laboratorial' as const,
              description: e,
            })) ?? []);

      setMeds(finalMeds);
      setExams(finalExams);
      if (pkg?.examJust) setExamJust(pkg.examJust);
      if (detectedCid) setCertCid(detectedCid);
      setExOn(finalExams.length > 0);
      setExOpen(finalExams.length > 0);
    }

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
    setMeds(
      pkg.meds.map((m) => ({
        drug: m.drug,
        posology: m.posology,
        notes: m.note,
      }))
    );
    setExams(pkg.exams.map((e) => ({ type: 'laboratorial', description: e })));
    setExamJust(pkg.examJust);
    setCertCid(code);
    if (pkg.exams.length > 0) {
      setExOn(true);
      setExOpen(true);
    }
    setCidPickerOpen(false);
  }, []);

  const loadExamPkg = useCallback(
    (key: string) => {
      const pkg = examPackagesDisplay.find((p) => p.key === key);
      if (!pkg) return;
      setExams(
        pkg.exams.map((e) => ({ type: 'laboratorial', description: e }))
      );
      setExamJust(pkg.just);
      setExOn(true);
      setExOpen(true);
    },
    [examPackagesDisplay]
  );

  const docCount = (rxOn ? 1 : 0) + (exOn ? 1 : 0) + (refOn ? 1 : 0);

  // Password dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [certPassword, setCertPassword] = useState('');

  const handleSignClick = () => {
    if (!requestId || docCount === 0) return;
    if (docCount > 3) {
      toast.error('Máximo de 3 documentos: receita, exames e encaminhamento.');
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
        mainIcd10Code: isPsy ? undefined : certCid || detectedCid || undefined,
        anamnesis: request?.consultationAnamnesis ?? undefined,
        structuredAnamnesis: request?.consultationAnamnesis ?? undefined,
        plan:
          request?.doctorConductNotes ??
          request?.aiConductSuggestion ??
          undefined,
      };
      const validMeds = meds.filter((m) => m.drug.trim());
      if (rxOn && validMeds.length > 0)
        payload.prescription = { type: rxType, items: validMeds };
      const validExams = exams.filter((e) => e.description.trim());
      if (exOn && validExams.length > 0)
        payload.examOrder = {
          clinicalJustification: examJust,
          items: validExams,
        };
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
      toast.error(
        err instanceof Error ? err.message : 'Erro ao emitir documentos'
      );
    } finally {
      setSubmitting(false);
    }
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

  if (loading)
    return (
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
          <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="-ml-2 rounded-lg p-2 transition-colors hover:bg-white/10"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                Pos-consulta
              </h1>
            </div>
          </div>
        </div>

        {/* ── Patient Bar ── */}
        <div className="bg-[#1B2D45] text-white">
          <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                {patientInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium sm:text-base">
                  {patientName}
                </p>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  {patientAge != null && <span>{patientAge} anos</span>}
                  {patientAge != null && patientGender && (
                    <span aria-hidden>·</span>
                  )}
                  {patientGender && <span>{patientGender}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:px-6">
          {/* CID Selection — medical only */}
          {!isPsy && (
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100">
                Pre-preenchida pela IA
              </Badge>
              <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 shadow-sm">
                <span className="text-sm font-semibold text-purple-700">
                  {certCid || detectedCid || '--'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {cidPkg?.name ??
                    CID_PACKAGES[certCid]?.name ??
                    'Selecionar CID'}
                </span>
                <button
                  onClick={() => setCidPickerOpen(!cidPickerOpen)}
                  className="ml-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  Trocar
                </button>
              </div>
            </div>
          )}

          {/* CID Picker — medical only */}
          {!isPsy && cidPickerOpen && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(CID_PACKAGES).map(([code, pkg]) => (
                <button
                  key={code}
                  onClick={() => loadCid(code)}
                  className={`rounded-xl border-[1.5px] p-3 text-left transition-all ${
                    code === certCid
                      ? 'border-purple-500 bg-purple-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-sm font-semibold">{code}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {pkg.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── Desktop 2-column layout for Receita + Exames — medical only ── */}
          {!isPsy && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* ═══ RECEITA ═══ */}
              <Card
                className={`${!rxOn ? 'pointer-events-none opacity-35' : ''} border-0 shadow-sm ring-1 ring-gray-200`}
              >
                <CardHeader
                  className="cursor-pointer rounded-t-lg bg-white pb-2"
                  onClick={() => rxOn && setRxOpen(!rxOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    </div>
                    <CardTitle className="flex-1 text-base">Receita</CardTitle>
                    <Badge variant="secondary" className="text-xs font-medium">
                      {meds.length} ite{meds.length !== 1 ? 'ns' : 'm'}
                    </Badge>
                    <Switch
                      checked={rxOn}
                      onCheckedChange={(v) => {
                        setRxOn(v);
                        if (v) setRxOpen(true);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {rxOn &&
                      (rxOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ))}
                  </div>
                </CardHeader>
                {rxOpen && rxOn && (
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex flex-wrap gap-2">
                      {(['simples', 'controlado'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setRxType(t)}
                          className={`rounded-full border-[1.5px] px-4 py-1.5 text-sm font-medium transition-all ${
                            rxType === t
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-[400px] space-y-2 overflow-y-auto">
                      {meds.map((m, i) => (
                        <div
                          key={i}
                          className="flex min-h-[50px] items-center gap-3 rounded-xl bg-gray-50 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {m.drug}
                              {m.concentration ? ` ${m.concentration}` : ''}
                            </p>
                            {(m.posology || m.notes) && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {[m.posology, m.notes]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              setMeds((p) => p.filter((_, j) => j !== i))
                            }
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 transition-colors hover:bg-red-100"
                          >
                            <X className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setMeds((prev) => [...prev, { drug: '' }])}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-gray-300 p-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4" /> Adicionar medicamento
                    </button>
                  </CardContent>
                )}
              </Card>

              {/* ═══ EXAMES ═══ */}
              <Card
                className={`${!exOn ? 'pointer-events-none opacity-35' : ''} border-0 shadow-sm ring-1 ring-gray-200`}
              >
                <CardHeader
                  className="cursor-pointer rounded-t-lg bg-white pb-2"
                  onClick={() => exOn && setExOpen(!exOpen)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <CardTitle className="flex-1 text-base">Exames</CardTitle>
                    <Badge variant="secondary" className="text-xs font-medium">
                      {exams.length} exame{exams.length !== 1 ? 's' : ''}
                    </Badge>
                    <Switch
                      checked={exOn}
                      onCheckedChange={(v) => {
                        setExOn(v);
                        if (v) setExOpen(true);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    {exOn &&
                      (exOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ))}
                  </div>
                </CardHeader>
                {exOpen && exOn && (
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Pacotes rapidos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {examPackagesDisplay.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => loadExamPkg(p.key)}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <hr className="border-gray-100" />
                    <div className="max-h-[300px] space-y-2 overflow-y-auto">
                      {exams
                        .slice(0, exListExpanded ? undefined : 3)
                        .map((e, i) => (
                          <div
                            key={i}
                            className="flex min-h-[46px] items-center gap-3 rounded-xl bg-gray-50 p-3"
                          >
                            <p className="flex-1 truncate text-sm font-medium">
                              {e.description}
                            </p>
                            <button
                              onClick={() =>
                                setExams((p) => p.filter((_, j) => j !== i))
                              }
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 transition-colors hover:bg-red-100"
                            >
                              <X className="h-3.5 w-3.5 text-red-500" />
                            </button>
                          </div>
                        ))}
                    </div>
                    {exams.length > 3 && (
                      <button
                        onClick={() => setExListExpanded(!exListExpanded)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                      >
                        {exListExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" /> Recolher
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" /> Ver todos (
                            {exams.length})
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setExams((prev) => [
                          ...prev,
                          { type: 'laboratorial', description: '' },
                        ])
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-gray-300 p-3 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      <Plus className="h-4 w-4" /> Adicionar exame avulso
                    </button>
                    <div className="pt-1">
                      <label
                        htmlFor="exam-just"
                        className="mb-1.5 block text-xs font-medium text-muted-foreground"
                      >
                        Justificativa clinica
                      </label>
                      <Textarea
                        id="exam-just"
                        value={examJust}
                        onChange={(e) => setExamJust(e.target.value)}
                        rows={2}
                        placeholder="Preenchida ao selecionar pacote"
                        className="text-sm"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          )}

          {/* ── Encaminhamento ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ═══ ENCAMINHAMENTO ═══ */}
            <Card
              className={`${!refOn ? 'pointer-events-none opacity-35' : ''} border-0 shadow-sm ring-1 ring-gray-200`}
            >
              <CardHeader
                className="cursor-pointer rounded-t-lg bg-white pb-2"
                onClick={() => refOn && setRefOpen(!refOpen)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                    <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  </div>
                  <CardTitle className="flex-1 text-base">
                    Encaminhamento
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {refSpecialty.trim() || 'Especialidade'}
                  </Badge>
                  <Switch
                    checked={refOn}
                    onCheckedChange={(v) => {
                      setRefOn(v);
                      if (v) setRefOpen(true);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {refOn &&
                    (refOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ))}
                </div>
              </CardHeader>
              {refOpen && refOn && (
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-muted-foreground">
                    {isPsy
                      ? 'Encaminhe o paciente para outro profissional ou serviço conforme avaliação psicológica.'
                      : 'Encaminhe o paciente para avaliação presencial conforme anamnese.'}
                  </p>
                  <div>
                    <label
                      htmlFor="ref-specialty"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      Especialidade *
                    </label>
                    <Input
                      id="ref-specialty"
                      value={refSpecialty}
                      onChange={(e) => setRefSpecialty(e.target.value)}
                      placeholder={
                        isPsy
                          ? 'Ex: Psiquiatra, Neurologista, Clínico Geral'
                          : 'Ex: Cardiologia, Fisioterapia'
                      }
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ref-professional"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      Médico ou profissional (opcional)
                    </label>
                    <Input
                      id="ref-professional"
                      value={refProfessional}
                      onChange={(e) => setRefProfessional(e.target.value)}
                      placeholder="Ex: Dr. João Silva"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ref-reason"
                      className="mb-1.5 block text-xs font-medium text-muted-foreground"
                    >
                      Motivo / Indicacao
                    </label>
                    <Textarea
                      id="ref-reason"
                      value={refReason}
                      onChange={(e) => setRefReason(e.target.value)}
                      rows={3}
                      placeholder="Conforme anamnese, para avaliacao de..."
                      className="text-sm"
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* ═══ SUMMARY + SIGN ═══ */}
          <div className="space-y-3 pt-2">
            <Card className="border-0 bg-white shadow-sm ring-1 ring-gray-200">
              <CardContent className="py-4">
                <p className="text-sm font-semibold text-gray-800 sm:text-base">
                  {docCount} documento{docCount !== 1 ? 's' : ''} pronto
                  {docCount !== 1 ? 's' : ''} para assinatura
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {rxOn && (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      Receita ({meds.length})
                    </Badge>
                  )}
                  {exOn && (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      Exames ({exams.length})
                    </Badge>
                  )}
                  {refOn && (
                    <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
                      Encaminhamento
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="h-14 w-full gap-2 rounded-2xl bg-[#0EA5E9] text-base text-white shadow-lg shadow-sky-500/20 transition-all hover:bg-[#0284C7]"
              onClick={handleSignClick}
              disabled={submitting || docCount === 0}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
              Assinar todos (ICP-Brasil)
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full gap-2 rounded-2xl border-green-500 text-green-700 hover:bg-green-50"
            >
              <Send className="h-4 w-4" /> Enviar por WhatsApp
            </Button>

            <p className="pb-4 text-center text-xs text-muted-foreground">
              Assinatura digital ICP-Brasil · QR Code verificável · Prontuário
              atualizado automaticamente
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
              Informe a senha do seu certificado A1 (PFX) para assinar os{' '}
              {docCount} documento(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              type="password"
              placeholder="Senha do certificado"
              value={certPassword}
              onChange={(e) => setCertPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && certPassword) handleSubmit();
              }}
            />
            <p className="text-xs text-muted-foreground">
              A senha é usada apenas para validar o certificado. Não é
              armazenada.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPasswordDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!certPassword || submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Assinar e emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
