// SimuladorDashboard.tsx
// RenoveJá+ — Executive KPI Dashboard — Telemedicina
// Vite + React · No "use client" · Tailwind dark theme · Chart.js · framer-motion

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import { Card, CardContent } from "@/components/ui/card";
import {
  RENOVEJA_SERVICES,
  CONSULTATION_OUTCOMES,
  PATIENT_PROFILES,
  calcDerivativeRevenue,
  calcTotalRevenuePerConsultation,
} from "@/data/renovejaServices";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  Target,
  Zap,
  BarChart2,
  Heart,
  Clock,
  Shield,
  Star,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Stethoscope,
  Brain,
  Pill,
  FlaskConical,
  Scan,
} from "lucide-react";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
);

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

export interface DashboardTabProps {
  pacientesMes: number;
  valConsulta: number;
  durMedia: number;
  diasMes: number;
  medicos: number;
  psicologos: number;
  custoMedDia: number;
  custoPsicoDia: number;
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function infraCost(patients: number): number {
  if (patients <= 1500) return 1129 + patients * 0.5;
  if (patients <= 12000) return 2300 + patients * 0.45;
  if (patients <= 60000) return 5500 + patients * 0.6;
  return 12000 + patients * 0.75;
}

/** Format currency R$ */
function fK(value: number): string {
  if (Math.abs(value) >= 1_000_000)
    return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")} M`;
  if (Math.abs(value) >= 1_000)
    return `R$ ${(value / 1_000).toFixed(1).replace(".", ",")} k`;
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

/** Format number with locale */
function fNL(value: number, decimals = 0): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format percentage */
function fPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

// ---------------------------------------------------------------------------
// Chart defaults
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "#6366f1", // indigo
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fb923c", // orange
  "#f472b6", // pink
  "#facc15", // yellow
];

const CHART_FONT = { family: "'JetBrains Mono', 'Fira Mono', monospace", size: 11 };

const BASE_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: "#94a3b8", font: CHART_FONT, boxWidth: 12, padding: 10 },
    },
    tooltip: {
      backgroundColor: "#1e293b",
      titleColor: "#e2e8f0",
      bodyColor: "#94a3b8",
      borderColor: "#334155",
      borderWidth: 1,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type HealthStatus = "green" | "yellow" | "red";

function statusColor(s: HealthStatus) {
  return s === "green"
    ? "text-emerald-400"
    : s === "yellow"
      ? "text-yellow-400"
      : "text-red-400";
}

function statusBg(s: HealthStatus) {
  return s === "green"
    ? "bg-emerald-400"
    : s === "yellow"
      ? "bg-yellow-400"
      : "bg-red-400";
}

function statusBorder(s: HealthStatus) {
  return s === "green"
    ? "border-emerald-500/30"
    : s === "yellow"
      ? "border-yellow-500/30"
      : "border-red-500/30";
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  status: HealthStatus;
  delay?: number;
}

function KpiCard({ icon, label, value, subtitle, status, delay = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Card className={`border ${statusBorder(status)} bg-card h-full`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              {icon}
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
            </div>
            <span className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${statusBg(status)}`} />
          </div>
          <p className={`font-mono text-lg font-bold leading-tight ${statusColor(status)}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">{subtitle}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
}

function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardTab({
  pacientesMes,
  valConsulta,
  durMedia,
  diasMes,
  medicos,
  psicologos,
  custoMedDia,
  custoPsicoDia,
}: DashboardTabProps) {

  // ---------------------------------------------------------------------------
  // 1. Core revenue calculations
  // ---------------------------------------------------------------------------

  const calcs = useMemo(() => {
    // Split patients between clinica / psico (proportional to staff)
    const totalStaff = medicos + psicologos;
    const clinicaPct = totalStaff > 0 ? medicos / totalStaff : 0.65;
    const psicoPct = 1 - clinicaPct;

    const pacientesClinica = Math.round(pacientesMes * clinicaPct);
    const pacientesPsico = pacientesMes - pacientesClinica;

    // Consultation revenue — valConsulta is the total price per teleconsultation (R$/atendimento)
    const recConsultaClinica = valConsulta * pacientesClinica;
    const recConsultaPsico = valConsulta * pacientesPsico;
    const recConsulta = recConsultaClinica + recConsultaPsico;

    // Derivative revenue (outcomes × all patients for clinica; psico outcomes separate)
    const derivClinica = calcDerivativeRevenue(CONSULTATION_OUTCOMES, pacientesClinica);
    const derivPsico = calcDerivativeRevenue(
      CONSULTATION_OUTCOMES.map((o) => ({
        ...o,
        probability:
          o.serviceId === "receita_controlada"
            ? 0.28
            : o.serviceId === "receita_azul"
              ? 0.07
              : o.serviceId === "receita_simples"
                ? 0.15
                : o.probability * 0.6,
      })),
      pacientesPsico,
    );

    // Aggregate by service
    const derivMap: Record<string, number> = {};
    for (const d of [...derivClinica, ...derivPsico]) {
      derivMap[d.service] = (derivMap[d.service] ?? 0) + d.revenue;
    }

    const recDeriv = Object.values(derivMap).reduce((s, v) => s + v, 0);
    const recBruta = recConsulta + recDeriv;

    // Cost breakdown
    const custoMedicos = medicos * custoMedDia * diasMes;
    const custoPsico = psicologos * custoPsicoDia * diasMes;
    const custoInfra = infraCost(pacientesMes);
    const custoAI = 0.15 * pacientesMes; // R$ 0,15/teleconsulta — Daily/Deepgram + OpenAI
    const custoStorage = 0.08 * pacientesMes; // R$ 0,08/teleconsulta — S3
    const custoGateway = recBruta * 0.025; // 2.5% gateway de pagamento
    const custoTotal = custoMedicos + custoPsico + custoInfra + custoAI + custoStorage + custoGateway;

    const resultadoLiquido = recBruta - custoTotal;
    const margemBruta = recBruta > 0 ? (resultadoLiquido / recBruta) * 100 : 0;
    const recPorPaciente = pacientesMes > 0 ? recBruta / pacientesMes : 0;
    const recPorMedico = medicos > 0 ? recBruta / medicos : 0;

    // Utilization: assume each doctor does 8h/day, avg consult takes durMedia min
    const capacidadeTotal =
      ((medicos + psicologos) * diasMes * 8 * 60) / Math.max(durMedia, 1);
    const utilizacaoPct = capacidadeTotal > 0 ? (pacientesMes / capacidadeTotal) * 100 : 0;

    // LTV & CAC
    const avgConsultasYear =
      PATIENT_PROFILES.reduce((s, p) => s + p.consultasPerYear * p.populationPct, 0) /
      PATIENT_PROFILES.reduce((s, p) => s + p.populationPct, 0);
    const avgRetentionYears = 2.5;
    const ltvEstimado = recPorPaciente * avgConsultasYear * avgRetentionYears;
    const cacEstimado = 35;
    const ltvCac = ltvEstimado / cacEstimado;

    const roiAnual = custoTotal > 0 ? ((resultadoLiquido * 12) / (custoTotal * 12)) * 100 : 0;
    const breakeven =
      resultadoLiquido > 0 ? custoTotal / resultadoLiquido : 99; // months approx.

    return {
      clinicaPct,
      psicoPct,
      pacientesClinica,
      pacientesPsico,
      recConsultaClinica,
      recConsultaPsico,
      recConsulta,
      recDeriv,
      derivMap,
      recBruta,
      custoMedicos,
      custoPsico,
      custoInfra,
      custoAI,
      custoStorage,
      custoGateway,
      custoTotal,
      resultadoLiquido,
      margemBruta,
      recPorPaciente,
      recPorMedico,
      utilizacaoPct,
      ltvEstimado,
      cacEstimado,
      ltvCac,
      roiAnual,
      breakeven,
    };
  }, [
    pacientesMes,
    valConsulta,
    durMedia,
    diasMes,
    medicos,
    psicologos,
    custoMedDia,
    custoPsicoDia,
  ]);

  // ---------------------------------------------------------------------------
  // 2. Revenue composition by service
  // ---------------------------------------------------------------------------

  const serviceComposition = useMemo(() => {
    const { pacientesClinica, pacientesPsico } = calcs;

    // Fixed service labels for chart
    const serviceKeys = [
      "consulta_clinica",
      "consulta_psico",
      "receita_simples",
      "receita_controlada",
      "receita_azul",
      "exame_lab",
      "exame_imagem",
    ] as const;

    const rows = serviceKeys.map((id) => {
      const svc = RENOVEJA_SERVICES[id];
      let monthlyRevenue = 0;
      let volume = 0;

      if (id === "consulta_clinica") {
        volume = pacientesClinica;
        monthlyRevenue = valConsulta * pacientesClinica;
      } else if (id === "consulta_psico") {
        volume = pacientesPsico;
        monthlyRevenue = valConsulta * pacientesPsico;
      } else {
        const outcome = CONSULTATION_OUTCOMES.find((o) => o.serviceId === id);
        if (outcome) {
          volume =
            Math.round(
              (pacientesClinica + pacientesPsico) *
                outcome.probability *
                outcome.avgQuantity *
                100,
            ) / 100;
          monthlyRevenue = volume * svc.price;
        }
      }

      return {
        id,
        name: svc.name,
        price: svc.price,
        volume,
        monthlyRevenue,
        marginPct: svc.marginPct,
      };
    });

    const total = rows.reduce((s, r) => s + r.monthlyRevenue, 0);
    return rows
      .map((r) => ({ ...r, pct: total > 0 ? (r.monthlyRevenue / total) * 100 : 0 }))
      .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  }, [calcs, valConsulta]);

  // ---------------------------------------------------------------------------
  // 3. Chart data
  // ---------------------------------------------------------------------------

  const doughnutData = useMemo(
    () => ({
      labels: serviceComposition.map((r) => r.name.split(" ").slice(0, 2).join(" ")),
      datasets: [
        {
          data: serviceComposition.map((r) => r.monthlyRevenue),
          backgroundColor: CHART_COLORS,
          borderColor: "#1e293b",
          borderWidth: 2,
        },
      ],
    }),
    [serviceComposition],
  );

  const hBarData = useMemo(
    () => ({
      labels: serviceComposition.map((r) => r.name.split(" ").slice(0, 2).join(" ")),
      datasets: [
        {
          label: "Receita Mensal",
          data: serviceComposition.map((r) => r.monthlyRevenue),
          backgroundColor: CHART_COLORS,
          borderRadius: 4,
        },
      ],
    }),
    [serviceComposition],
  );

  const waterfallData = useMemo(() => {
    const { recBruta, custoMedicos, custoPsico, custoInfra, custoAI, custoStorage, custoGateway, resultadoLiquido } =
      calcs;
    const labels = [
      "Receita Bruta",
      "(-) Médicos",
      "(-) Psicólogos",
      "(-) Infra",
      "(-) IA / Transcrição",
      "(-) Armazenamento S3",
      "(-) Gateway Pagto.",
      "= Resultado",
    ];
    const values = [
      recBruta,
      -custoMedicos,
      -custoPsico,
      -custoInfra,
      -custoAI,
      -custoStorage,
      -custoGateway,
      resultadoLiquido,
    ];
    return {
      labels,
      datasets: [
        {
          label: "R$",
          data: values,
          backgroundColor: values.map((v, i) =>
            i === 0 || i === labels.length - 1
              ? v >= 0
                ? "#34d399"
                : "#f87171"
              : "#6366f1",
          ),
          borderRadius: 4,
        },
      ],
    };
  }, [calcs]);

  const costDoughnutData = useMemo(() => {
    const { custoMedicos, custoPsico, custoInfra, custoAI, custoStorage, custoGateway } = calcs;
    return {
      labels: ["Médicos", "Psicólogos", "Infraestrutura", "IA / Transcrição", "Armazenamento S3", "Gateway Pagto."],
      datasets: [
        {
          data: [custoMedicos, custoPsico, custoInfra, custoAI, custoStorage, custoGateway],
          backgroundColor: CHART_COLORS,
          borderColor: "#1e293b",
          borderWidth: 2,
        },
      ],
    };
  }, [calcs]);

  const marginSensitivityData = useMemo(() => {
    const steps = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const margins = steps.map((mult) => {
      const p = Math.round(pacientesMes * mult);
      const totalStaff = medicos + psicologos;
      const clinicaPct = totalStaff > 0 ? medicos / totalStaff : 0.65;
      const pC = Math.round(p * clinicaPct);
      const pP = p - pC;
      const rev =
        calcTotalRevenuePerConsultation(durMedia, "clinica") * pC +
        calcTotalRevenuePerConsultation(durMedia, "psico") * pP;
      const costs =
        medicos * custoMedDia * diasMes +
        psicologos * custoPsicoDia * diasMes +
        infraCost(p) +
        0.15 * p +
        0.08 * p +
        rev * 0.025;
      const margin = rev > 0 ? ((rev - costs) / rev) * 100 : 0;
      return Math.max(-100, Math.min(100, margin));
    });
    return {
      labels: steps.map((s) => `${(s * 100).toFixed(0)}%`),
      datasets: [
        {
          label: "Margem %",
          data: margins,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.15)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: margins.map((m) =>
            m >= 30 ? "#34d399" : m >= 0 ? "#facc15" : "#f87171",
          ),
          pointRadius: 5,
        },
      ],
    };
  }, [pacientesMes, medicos, psicologos, durMedia, diasMes, custoMedDia, custoPsicoDia]);

  // ---------------------------------------------------------------------------
  // 4. Patient profile metrics
  // ---------------------------------------------------------------------------

  const profileMetrics = useMemo(() => {
    return PATIENT_PROFILES.map((profile) => {
      const outcomes = CONSULTATION_OUTCOMES.map((o) => ({
        ...o,
        probability: profile.outcomes[o.serviceId] ?? o.probability,
      }));
      const revenuePerVisit = calcTotalRevenuePerConsultation(
        profile.avgConsultDurationMin,
        profile.id === "saude_mental" ? "psico" : "clinica",
        outcomes,
      );
      const annualRevenuePerPatient = revenuePerVisit * profile.consultasPerYear;
      const patientsInSegment = Math.round(pacientesMes * profile.populationPct);
      const monthlyContribution = patientsInSegment * (annualRevenuePerPatient / 12);

      return {
        ...profile,
        revenuePerVisit,
        annualRevenuePerPatient,
        patientsInSegment,
        monthlyContribution,
      };
    });
  }, [pacientesMes]);

  // ---------------------------------------------------------------------------
  // 5. Business health score
  // ---------------------------------------------------------------------------

  const healthScore = useMemo(() => {
    const { margemBruta, ltvCac, utilizacaoPct, resultadoLiquido, breakeven } = calcs;
    const topServicePct = serviceComposition.length > 0 ? serviceComposition[0].pct : 100;

    const factors: { label: string; pts: number; earned: number; pass: boolean }[] = [
      {
        label: "Margem > 30%",
        pts: 25,
        earned: margemBruta > 30 ? 25 : margemBruta > 15 ? 12 : 0,
        pass: margemBruta > 30,
      },
      {
        label: "LTV:CAC > 3×",
        pts: 20,
        earned: ltvCac > 3 ? 20 : ltvCac > 1.5 ? 10 : 0,
        pass: ltvCac > 3,
      },
      {
        label: "Utilização > 70%",
        pts: 15,
        earned: utilizacaoPct > 70 ? 15 : utilizacaoPct > 40 ? 7 : 0,
        pass: utilizacaoPct > 70,
      },
      {
        label: "Diversificação (sem serviço > 60%)",
        pts: 15,
        earned: topServicePct < 60 ? 15 : topServicePct < 80 ? 7 : 0,
        pass: topServicePct < 60,
      },
      {
        label: "Breakeven < 6 meses",
        pts: 15,
        earned: breakeven < 6 ? 15 : breakeven < 12 ? 7 : 0,
        pass: breakeven < 6,
      },
      {
        label: "Pode suportar 2× pacientes",
        pts: 10,
        earned: resultadoLiquido > 0 ? 10 : 0,
        pass: resultadoLiquido > 0,
      },
    ];

    const score = factors.reduce((s, f) => s + f.earned, 0);
    const status: HealthStatus = score >= 70 ? "green" : score >= 40 ? "yellow" : "red";

    const recommendations: string[] = [];
    if (calcs.margemBruta <= 30)
      recommendations.push("Aumente o ticket médio ampliando serviços derivados por teleconsulta.");
    if (ltvCac <= 3)
      recommendations.push("Reduza o CAC com indicações ou aumente retenção com assinatura mensal.");
    if (utilizacaoPct <= 70)
      recommendations.push("Otimize escala de médicos ou amplie o marketing digital para aumentar a taxa de utilização.");
    if (topServicePct >= 60)
      recommendations.push("Diversifique o mix de receita estimulando receituários e exames.");
    if (calcs.breakeven >= 6)
      recommendations.push("Reduza custos fixos de pessoal nos primeiros meses via modelo PJ/flexível.");
    if (recommendations.length === 0)
      recommendations.push("Operação saudável. Considere expansão de cobertura geográfica.");

    return { score, status, factors, recommendations };
  }, [calcs, serviceComposition]);

  // ---------------------------------------------------------------------------
  // KPI card statuses
  // ---------------------------------------------------------------------------

  const kpiStatus = useMemo(() => {
    const { margemBruta, resultadoLiquido, utilizacaoPct, ltvCac, roiAnual, breakeven } = calcs;
    return {
      recBruta: "green" as HealthStatus,
      custoTotal: resultadoLiquido > 0 ? ("yellow" as HealthStatus) : ("red" as HealthStatus),
      resultado: resultadoLiquido > 0 ? ("green" as HealthStatus) : ("red" as HealthStatus),
      margem:
        margemBruta > 30 ? "green" : margemBruta > 10 ? "yellow" : ("red" as HealthStatus),
      recPorPaciente: "green" as HealthStatus,
      recPorMedico: "green" as HealthStatus,
      utilizacao:
        utilizacaoPct > 70 ? "green" : utilizacaoPct > 40 ? "yellow" : ("red" as HealthStatus),
      ltv: "green" as HealthStatus,
      cac: "green" as HealthStatus,
      ltvCac: ltvCac > 3 ? "green" : ltvCac > 1.5 ? "yellow" : ("red" as HealthStatus),
      roi: roiAnual > 20 ? "green" : roiAnual > 5 ? "yellow" : ("red" as HealthStatus),
      breakeven: breakeven < 6 ? "green" : breakeven < 12 ? "yellow" : ("red" as HealthStatus),
    };
  }, [calcs]);

  const profileIcons: Record<string, React.ReactNode> = {
    jovem_saudavel: <Heart className="w-4 h-4" />,
    adulto_cronico: <Pill className="w-4 h-4" />,
    idoso_polimedicado: <Stethoscope className="w-4 h-4" />,
    saude_mental: <Brain className="w-4 h-4" />,
    eventual: <Clock className="w-4 h-4" />,
  };

  const iconSm = "w-3.5 h-3.5";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1 — Painel Executivo                                        */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectionHeading
          title="Painel Executivo"
          subtitle="Indicadores-chave de performance financeira e operacional da telemedicina no período"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <KpiCard
            icon={<DollarSign className={iconSm} />}
            label="Receita Bruta"
            value={fK(calcs.recBruta)}
            subtitle="Teleconsultas + todos os serviços derivados no mês"
            status={kpiStatus.recBruta}
            delay={0}
          />
          <KpiCard
            icon={<TrendingDown className={iconSm} />}
            label="Custo Total"
            value={fK(calcs.custoTotal)}
            subtitle="Pessoal + infra + IA + storage + gateway"
            status={kpiStatus.custoTotal}
            delay={0.04}
          />
          <KpiCard
            icon={<TrendingUp className={iconSm} />}
            label="Resultado Líquido"
            value={fK(calcs.resultadoLiquido)}
            subtitle="Receita bruta menos todos os custos do mês"
            status={kpiStatus.resultado}
            delay={0.08}
          />
          <KpiCard
            icon={<BarChart2 className={iconSm} />}
            label="Margem Bruta"
            value={fPct(calcs.margemBruta)}
            subtitle="(Resultado / Receita) × 100"
            status={kpiStatus.margem}
            delay={0.12}
          />
          <KpiCard
            icon={<Users className={iconSm} />}
            label="Receita por Paciente"
            value={fK(calcs.recPorPaciente)}
            subtitle="Receita bruta ÷ total de pacientes no mês"
            status={kpiStatus.recPorPaciente}
            delay={0.16}
          />
          <KpiCard
            icon={<Stethoscope className={iconSm} />}
            label="Receita por Médico"
            value={fK(calcs.recPorMedico)}
            subtitle="Receita bruta ÷ número de médicos ativos"
            status={kpiStatus.recPorMedico}
            delay={0.2}
          />
          <KpiCard
            icon={<Activity className={iconSm} />}
            label="Taxa Utilização"
            value={fPct(calcs.utilizacaoPct)}
            subtitle="Pacientes reais ÷ capacidade máxima da equipe"
            status={kpiStatus.utilizacao}
            delay={0.24}
          />
          <KpiCard
            icon={<Star className={iconSm} />}
            label="Valor Vitalício (LTV)"
            value={fK(calcs.ltvEstimado)}
            subtitle="Valor vitalício médio por paciente (2,5 anos)"
            status={kpiStatus.ltv}
            delay={0.28}
          />
          <KpiCard
            icon={<Target className={iconSm} />}
            label="Custo Aquisição (CAC)"
            value={fK(calcs.cacEstimado)}
            subtitle="Custo de aquisição por paciente (base R$ 35)"
            status={kpiStatus.cac}
            delay={0.32}
          />
          <KpiCard
            icon={<Zap className={iconSm} />}
            label="Razão LTV / CAC"
            value={`${fNL(calcs.ltvCac, 1)}×`}
            subtitle="Razão entre valor vitalício e custo de aquisição"
            status={kpiStatus.ltvCac}
            delay={0.36}
          />
          <KpiCard
            icon={<TrendingUp className={iconSm} />}
            label="Retorno Anual (ROI)"
            value={fPct(calcs.roiAnual)}
            subtitle="Retorno sobre o investimento projetado para 12 meses"
            status={kpiStatus.roi}
            delay={0.4}
          />
          <KpiCard
            icon={<Clock className={iconSm} />}
            label="Ponto de Equilíbrio"
            value={
              calcs.breakeven >= 99
                ? "∞"
                : `${fNL(calcs.breakeven, 1)} m`
            }
            subtitle="Meses para cobrir custos acumulados com lucro corrente"
            status={kpiStatus.breakeven}
            delay={0.44}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2 — Composição de Receita                                  */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectionHeading
          title="Composição de Receita"
          subtitle="Distribuição e volume financeiro por tipo de serviço de telemedicina no mês"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Doughnut */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Participação % por Serviço
                </p>
                <div className="h-64">
                  <Doughnut
                    data={doughnutData}
                    options={{
                      ...BASE_CHART_OPTIONS,
                      cutout: "62%",
                      plugins: {
                        ...BASE_CHART_OPTIONS.plugins,
                        tooltip: {
                          ...BASE_CHART_OPTIONS.plugins.tooltip,
                          callbacks: {
                            label: (ctx) =>
                              ` ${ctx.label}: ${fK(ctx.parsed as number)} (${fPct((ctx.parsed as number / calcs.recBruta) * 100)})`,
                          },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Horizontal Bar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Receita Mensal por Serviço (R$)
                </p>
                <div className="h-64">
                  <Bar
                    data={hBarData}
                    options={{
                      ...BASE_CHART_OPTIONS,
                      indexAxis: "y" as const,
                      scales: {
                        x: {
                          ticks: { color: "#64748b", font: CHART_FONT, callback: (v) => fK(Number(v)) },
                          grid: { color: "#1e293b" },
                        },
                        y: { ticks: { color: "#94a3b8", font: CHART_FONT }, grid: { display: false } },
                      },
                      plugins: {
                        ...BASE_CHART_OPTIONS.plugins,
                        legend: { display: false },
                        tooltip: {
                          ...BASE_CHART_OPTIONS.plugins.tooltip,
                          callbacks: { label: (ctx) => ` ${fK(ctx.parsed.x ?? 0)}` },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Summary table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {[
                      "Serviço",
                      "Preço Unit.",
                      "Volume/mês",
                      "Receita/mês",
                      "% Total",
                      "Margem",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {serviceComposition.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "bg-secondary/10" : ""}`}
                    >
                      <td className="px-4 py-2 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">
                        {row.id === "consulta_clinica" || row.id === "consulta_psico"
                          ? `${fK(row.price)}/min`
                          : fK(row.price)}
                      </td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">
                        {fNL(row.volume, 0)}
                      </td>
                      <td className="px-4 py-2 font-mono font-semibold text-foreground">
                        {fK(row.monthlyRevenue)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 rounded-full bg-indigo-500/30 flex-1 max-w-16">
                            <div
                              className="h-1.5 rounded-full bg-indigo-500"
                              style={{ width: `${Math.min(row.pct, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-muted-foreground">{fPct(row.pct)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                            row.marginPct > 70
                              ? "bg-emerald-500/20 text-emerald-400"
                              : row.marginPct > 30
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {fPct(row.marginPct)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3 — Análise de Rentabilidade                               */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectionHeading
          title="Análise de Rentabilidade"
          subtitle="Waterfall de receita-custo, composição de despesas e sensibilidade de margem"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Waterfall */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="h-full">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Waterfall — Receita → Resultado
                </p>
                <div className="h-64">
                  <Bar
                    data={waterfallData}
                    options={{
                      ...BASE_CHART_OPTIONS,
                      scales: {
                        x: {
                          ticks: { color: "#94a3b8", font: CHART_FONT },
                          grid: { color: "#1e293b" },
                        },
                        y: {
                          title: {
                            display: true,
                            text: "R$ / mês",
                            color: "#64748b",
                            font: CHART_FONT,
                          },
                          ticks: {
                            color: "#64748b",
                            font: CHART_FONT,
                            callback: (v) => fK(Number(v)),
                          },
                          grid: { color: "#1e293b" },
                        },
                      },
                      plugins: {
                        ...BASE_CHART_OPTIONS.plugins,
                        legend: { display: false },
                        tooltip: {
                          ...BASE_CHART_OPTIONS.plugins.tooltip,
                          callbacks: { label: (ctx) => ` ${fK(ctx.parsed.y ?? 0)}` },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Cost Doughnut */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="h-full">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Composição de Custos
                </p>
                <div className="h-64">
                  <Doughnut
                    data={costDoughnutData}
                    options={{
                      ...BASE_CHART_OPTIONS,
                      cutout: "58%",
                      plugins: {
                        ...BASE_CHART_OPTIONS.plugins,
                        tooltip: {
                          ...BASE_CHART_OPTIONS.plugins.tooltip,
                          callbacks: {
                            label: (ctx) =>
                              ` ${ctx.label}: ${fK(ctx.parsed as number)}`,
                          },
                        },
                      },
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Margin sensitivity */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Sensibilidade de Margem — Variação de Pacientes/Mês (50% → 200% do cenário atual)
              </p>
              <div className="h-44">
                <Line
                  data={marginSensitivityData}
                  options={{
                    ...BASE_CHART_OPTIONS,
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "% do volume atual",
                          color: "#64748b",
                          font: CHART_FONT,
                        },
                        ticks: { color: "#94a3b8", font: CHART_FONT },
                        grid: { color: "#1e293b" },
                      },
                      y: {
                        title: {
                          display: true,
                          text: "Margem (%)",
                          color: "#64748b",
                          font: CHART_FONT,
                        },
                        ticks: {
                          color: "#64748b",
                          font: CHART_FONT,
                          callback: (v) => `${Number(v).toFixed(0)}%`,
                        },
                        grid: { color: "#1e293b" },
                      },
                    },
                    plugins: {
                      ...BASE_CHART_OPTIONS.plugins,
                      tooltip: {
                        ...BASE_CHART_OPTIONS.plugins.tooltip,
                        callbacks: {
                          label: (ctx) => ` Margem: ${fPct(ctx.parsed.y ?? 0)}`,
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 4 — Métricas por Perfil de Paciente                        */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectionHeading
          title="Métricas por Perfil de Paciente"
          subtitle="Contribuição financeira de cada arquétipo de paciente na telemedicina, com base na composição estimada da base"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {profileMetrics.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
            >
              <Card className="h-full border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-indigo-400">{profileIcons[p.id] ?? <Users className="w-4 h-4" />}</span>
                    <span className="font-semibold text-sm text-foreground leading-tight">{p.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-snug line-clamp-3">
                    {p.description}
                  </p>
                  <dl className="space-y-1.5">
                    {(
                      [
                        ["Rec./visita", fK(p.revenuePerVisit)],
                        ["Consultas/ano", fNL(p.consultasPerYear, 1)],
                        ["Rec. anual/pac.", fK(p.annualRevenuePerPatient)],
                        ["Pacientes/mês", fNL(p.patientsInSegment)],
                        ["% da base", fPct(p.populationPct * 100)],
                        ["Contrib. mensal", fK(p.monthlyContribution)],
                      ] as [string, string][]
                    ).map(([k, v]) => (
                      <div key={k} className="flex justify-between items-baseline gap-1">
                        <dt className="text-xs text-muted-foreground truncate">{k}</dt>
                        <dd className="font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 5 — Indicadores de Saúde do Negócio                       */}
      {/* ------------------------------------------------------------------ */}

      <section>
        <SectionHeading
          title="Indicadores de Saúde do Negócio"
          subtitle="Score composto de 0–100 baseado em margens, eficiência e sustentabilidade"
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gauge + score */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="h-full flex flex-col items-center justify-center p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-6">
                Health Score
              </p>

              {/* Circular gauge */}
              <div className="relative w-36 h-36 mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  {/* Track */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="12"
                  />
                  {/* Progress */}
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={
                      healthScore.status === "green"
                        ? "#34d399"
                        : healthScore.status === "yellow"
                          ? "#facc15"
                          : "#f87171"
                    }
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${(healthScore.score / 100) * 314.16} 314.16`}
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`font-mono text-3xl font-bold ${statusColor(healthScore.status)}`}
                  >
                    {healthScore.score}
                  </span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>

              <span
                className={`text-sm font-semibold ${statusColor(healthScore.status)} capitalize`}
              >
                {healthScore.status === "green"
                  ? "Saudável"
                  : healthScore.status === "yellow"
                    ? "Atenção"
                    : "Crítico"}
              </span>
            </Card>
          </motion.div>

          {/* Checklist */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="h-full">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Critérios Avaliados
                </p>
                <ul className="space-y-3">
                  {healthScore.factors.map((f) => (
                    <li key={f.label} className="flex items-start gap-2.5">
                      {f.pass ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-foreground leading-tight">{f.label}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="h-1 rounded-full bg-secondary flex-1">
                            <div
                              className={`h-1 rounded-full transition-all duration-500 ${
                                f.pass ? "bg-emerald-500" : "bg-red-500"
                              }`}
                              style={{ width: `${(f.earned / f.pts) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {f.earned}/{f.pts} pts
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recommendations */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <Card className="h-full">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Recomendações
                </p>
                <ul className="space-y-3">
                  {healthScore.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-snug">{rec}</p>
                    </li>
                  ))}
                </ul>

                {/* Cost summary mini-table */}
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Resumo de Custos
                  </p>
                  {(
                    [
                      ["Médicos", calcs.custoMedicos],
                      ["Psicólogos", calcs.custoPsico],
                      ["Infraestrutura", calcs.custoInfra],
                      ["IA / Transcrição", calcs.custoAI],
                      ["Storage S3", calcs.custoStorage],
                      ["Gateway", calcs.custoGateway],
                    ] as [string, number][]
                  ).map(([label, val]) => (
                    <div key={label} className="flex justify-between text-xs py-0.5">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono text-foreground">{fK(val)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs py-1 mt-1 border-t border-border font-semibold">
                    <span className="text-foreground">Total</span>
                    <span className="font-mono text-foreground">{fK(calcs.custoTotal)}</span>
                  </div>
                </div>

                {/* Service icons legend */}
                <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2">
                  {[
                    { icon: <Stethoscope className="w-3 h-3" />, label: "Clínica" },
                    { icon: <Brain className="w-3 h-3" />, label: "Psico" },
                    { icon: <Pill className="w-3 h-3" />, label: "Receita" },
                    { icon: <FlaskConical className="w-3 h-3" />, label: "Lab" },
                    { icon: <Scan className="w-3 h-3" />, label: "Imagem" },
                  ].map(({ icon, label }) => (
                    <span
                      key={label}
                      className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded"
                    >
                      {icon}
                      {label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
