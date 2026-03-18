// SimuladorCenarios.tsx
// RenoveJá+ — Simulador de Cenários Operacionais de Telemedicina (teleconsulta por vídeo)
// Self-contained; no external state beyond props.

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import { Card, CardContent } from "@/components/ui/card";
import {
  OPERATIONAL_SCENARIOS,
  CONSULTATION_OUTCOMES,
  calcTotalRevenuePerConsultation,
} from "@/data/renovejaServices";
import type { OperationalScenario } from "@/data/renovejaServices";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CenariosTabProps {
  valConsulta: number;
  diasMes: number;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const FK = (v: number): string => {
  const a = Math.abs(v);
  const s = v < 0 ? "- " : "";
  if (a >= 1_000_000) return s + "R$ " + (a / 1_000_000).toFixed(1) + "M";
  if (a >= 1_000) return s + "R$ " + (a / 1_000).toFixed(1) + "K";
  return s + "R$ " + Math.round(a).toLocaleString("pt-BR");
};

const NL = (v: number): string => Math.round(v).toLocaleString("pt-BR");

const F2 = (v: number): string => v.toFixed(1).replace(".", ",") + "%";

// ---------------------------------------------------------------------------
// Infrastructure cost approximation
// ---------------------------------------------------------------------------

function infraCost(patients: number): number {
  if (patients <= 1_500) return 1_129 + patients * 0.5;
  if (patients <= 12_000) return 2_300 + patients * 0.45;
  if (patients <= 60_000) return 5_500 + patients * 0.6;
  return 12_000 + patients * 0.75;
}

// ---------------------------------------------------------------------------
// Scenario financial calculations
// ---------------------------------------------------------------------------

interface ScenarioFinancials {
  consultPerDay: number;
  consultPerMonth: number;
  revenueConsultMonth: number;
  revenueDerivMonth: number;
  revenueTotalMonth: number;
  costStaffMonth: number;
  costInfraMonth: number;
  costTotalMonth: number;
  profitMonth: number;
  marginPct: number;
  roiAnual: number;
  breakevenMonths: number;
}

function calcScenario(
  sc: OperationalScenario,
  overrideDias?: number,
  valConsulta?: number,
): ScenarioFinancials {
  const p = {
    ...sc.params,
    workDaysPerMonth:
      overrideDias != null && overrideDias > 0
        ? overrideDias
        : sc.params.workDaysPerMonth,
  };
  const minsPerDay = p.hoursPerDay * 60;
  const consultsPerDoctorPerDay = Math.floor(minsPerDay / p.avgConsultDuration);
  const consultsPerPsycoPerDay = Math.floor(minsPerDay / p.avgConsultDuration);

  const clinicaPerDay = consultsPerDoctorPerDay * p.doctorsPerShift;
  const psicoPerDay = consultsPerPsycoPerDay * p.psychologistsPerShift;
  const consultPerDay = clinicaPerDay + psicoPerDay;
  const consultPerMonth = consultPerDay * p.workDaysPerMonth;

  const clinicaPerMonth = clinicaPerDay * p.workDaysPerMonth;
  const psicoPerMonth = psicoPerDay * p.workDaysPerMonth;

  const revPerClinica = calcTotalRevenuePerConsultation(
    p.avgConsultDuration,
    "clinica",
    CONSULTATION_OUTCOMES,
  );
  const revPerPsico = calcTotalRevenuePerConsultation(
    p.avgConsultDuration,
    "psico",
    CONSULTATION_OUTCOMES,
  );

  // If valConsulta (R$ per consultation) is provided and positive, use it as
  // the base consultation fee; otherwise fall back to the per-minute rate.
  const effectiveClinicaConsultRev =
    valConsulta != null && valConsulta > 0
      ? valConsulta
      : p.avgConsultDuration * 6.99;
  const effectivePsicoConsultRev =
    valConsulta != null && valConsulta > 0
      ? valConsulta
      : p.avgConsultDuration * 3.99;

  // Split consult revenue vs derivative revenue
  const clinicaConsultRev = effectiveClinicaConsultRev;
  const psicoConsultRev = effectivePsicoConsultRev;
  const derivPerClinica = Math.max(0, revPerClinica - p.avgConsultDuration * 6.99);
  const derivPerPsico = Math.max(0, revPerPsico - p.avgConsultDuration * 3.99);

  const revenueConsultMonth =
    clinicaPerMonth * clinicaConsultRev + psicoPerMonth * psicoConsultRev;
  const revenueDerivMonth =
    clinicaPerMonth * derivPerClinica + psicoPerMonth * derivPerPsico;
  const revenueTotalMonth = revenueConsultMonth + revenueDerivMonth;

  const costStaffMonth =
    p.doctorsPerShift * p.doctorCostPerDay * p.workDaysPerMonth +
    p.psychologistsPerShift * p.psychologistCostPerDay * p.workDaysPerMonth;

  const costInfraMonth = infraCost(consultPerMonth);
  const costTotalMonth = costStaffMonth + costInfraMonth;

  const profitMonth = revenueTotalMonth - costTotalMonth;
  const marginPct =
    revenueTotalMonth > 0 ? (profitMonth / revenueTotalMonth) * 100 : -100;
  const roiAnual =
    costTotalMonth > 0 ? (profitMonth * 12) / costTotalMonth : 0;

  // Breakeven: months from zero to recover first month's fixed cost if profitable
  const breakevenMonths =
    profitMonth > 0 ? Math.ceil(costTotalMonth / profitMonth) : Infinity;

  return {
    consultPerDay,
    consultPerMonth,
    revenueConsultMonth,
    revenueDerivMonth,
    revenueTotalMonth,
    costStaffMonth,
    costInfraMonth,
    costTotalMonth,
    profitMonth,
    marginPct,
    roiAnual,
    breakevenMonths,
  };
}

// ---------------------------------------------------------------------------
// Icon map (emoji-based; matches renovejaServices icon field names)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, string> = {
  seedling: "🌱",
  "trending-up": "📈",
  map: "🗺️",
  city: "🏙️",
  globe: "🌍",
};

// ---------------------------------------------------------------------------
// Margin color helper
// ---------------------------------------------------------------------------

function marginColor(pct: number): string {
  if (pct >= 25) return "text-green-400";
  if (pct >= 10) return "text-yellow-400";
  return "text-red-400";
}

function profitColor(v: number): string {
  if (v > 0) return "text-green-400";
  if (v === 0) return "text-yellow-400";
  return "text-red-400";
}

// ---------------------------------------------------------------------------
// Inline Slider (mirrors AdminFinanceiro style)
// ---------------------------------------------------------------------------

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="bg-card/80 border border-border/60 rounded-xl p-3 hover:border-primary/30 transition-all duration-200">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="flex-1 accent-primary h-1.5 rounded-full"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(+e.target.value)}
        />
        <span className="w-14 text-right text-sm font-mono text-primary">
          {step < 1 ? value.toFixed(0) : NL(value)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outcome slider row (for Mix Optimizer)
// ---------------------------------------------------------------------------

function OutcomeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-28 shrink-0">
        {label}
      </span>
      <input
        type="range"
        className="flex-1 accent-primary h-1 rounded-full"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(+e.target.value / 100)}
      />
      <span className="text-xs font-mono text-primary w-10 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header (mirrors AdminFinanceiro style)
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {badge && (
        <span className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full whitespace-nowrap">
          {badge}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart defaults
// ---------------------------------------------------------------------------

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: "#94a3b8", font: { size: 10 }, boxWidth: 12, padding: 12 },
    },
    tooltip: {
      backgroundColor: "#1e293b",
      titleColor: "#f1f5f9",
      bodyColor: "#94a3b8",
      borderColor: "#334155",
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: { color: "#64748b", font: { size: 9 } },
      grid: { color: "rgba(51,65,85,0.4)" },
    },
    y: {
      ticks: { color: "#64748b", font: { size: 9 } },
      grid: { color: "rgba(51,65,85,0.4)" },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function CenariosTab({ valConsulta, diasMes }: CenariosTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clinicaPct, setClinicaPct] = useState(65);
  // Seed avgDuration from valConsulta if it looks like a duration (5–60 min), else default 14.
  const [avgDuration, setAvgDuration] = useState(() =>
    valConsulta >= 5 && valConsulta <= 60 ? Math.round(valConsulta) : 14,
  );
  const [pReceitaSimples, setPReceitaSimples] = useState(0.55);
  const [pControlada, setPControlada] = useState(0.12);
  const [pAzul, setPAzul] = useState(0.03);
  const [pExameLab, setPExameLab] = useState(0.35);
  const [pExameImagem, setPExameImagem] = useState(0.15);

  // ── Compute all scenario financials ───────────────────────────────────────
  // diasMes prop overrides each scenario's workDaysPerMonth when provided.
  // valConsulta (R$ per consultation) scales the consultation revenue.
  const allFinancials = useMemo(
    () =>
      OPERATIONAL_SCENARIOS.map((sc) => ({
        sc,
        fin: calcScenario(sc, diasMes > 0 ? diasMes : undefined, valConsulta),
      })),
    [diasMes, valConsulta],
  );

  // Most profitable scenario
  const bestId = useMemo(() => {
    let best = allFinancials[0];
    for (const item of allFinancials) {
      if (item.fin.profitMonth > best.fin.profitMonth) best = item;
    }
    return best.sc.id;
  }, [allFinancials]);

  // ── Mix Optimizer custom outcomes ────────────────────────────────────────
  const customOutcomes = useMemo(
    () =>
      CONSULTATION_OUTCOMES.map((o) => {
        if (o.serviceId === "receita_simples")
          return { ...o, probability: pReceitaSimples };
        if (o.serviceId === "receita_controlada")
          return { ...o, probability: pControlada };
        if (o.serviceId === "receita_azul") return { ...o, probability: pAzul };
        if (o.serviceId === "exame_lab") return { ...o, probability: pExameLab };
        if (o.serviceId === "exame_imagem")
          return { ...o, probability: pExameImagem };
        return o;
      }),
    [pReceitaSimples, pControlada, pAzul, pExameLab, pExameImagem],
  );

  const mixStats = useMemo(() => {
    const psicoFrac = (100 - clinicaPct) / 100;
    const clinicaFrac = clinicaPct / 100;
    const revClinica = calcTotalRevenuePerConsultation(
      avgDuration,
      "clinica",
      customOutcomes,
    );
    const revPsico = calcTotalRevenuePerConsultation(
      avgDuration,
      "psico",
      customOutcomes,
    );
    const revPerConsult = clinicaFrac * revClinica + psicoFrac * revPsico;

    // Recommend staffing: use Crescimento params as baseline capacity unit
    // Use diasMes prop when provided so calculations reflect the actual month config.
    const baseParams = OPERATIONAL_SCENARIOS[1].params;
    const effectiveDias = diasMes > 0 ? diasMes : baseParams.workDaysPerMonth;
    const consultsPerDoctorPerMonth =
      Math.floor((baseParams.hoursPerDay * 60) / avgDuration) *
      effectiveDias;
    const totalConsultsForMix =
      consultsPerDoctorPerMonth * baseParams.doctorsPerShift;
    const monthlyRevenue = totalConsultsForMix * revPerConsult;
    const staffCost =
      baseParams.doctorsPerShift *
        baseParams.doctorCostPerDay *
        effectiveDias +
      baseParams.psychologistsPerShift *
        baseParams.psychologistCostPerDay *
        effectiveDias;
    const infra = infraCost(totalConsultsForMix);
    const profit = monthlyRevenue - staffCost - infra;
    const margin =
      monthlyRevenue > 0 ? (profit / monthlyRevenue) * 100 : -100;
    const recDoctors = Math.max(
      1,
      Math.ceil(totalConsultsForMix * clinicaFrac / consultsPerDoctorPerMonth),
    );
    const recPsychos = Math.max(
      0,
      Math.ceil(totalConsultsForMix * psicoFrac / consultsPerDoctorPerMonth),
    );
    return {
      revPerConsult,
      monthlyRevenue,
      profit,
      margin,
      recDoctors,
      recPsychos,
    };
  }, [clinicaPct, avgDuration, customOutcomes, diasMes]);

  // ── Bar chart: Scenarios comparison ──────────────────────────────────────
  const barChartData = useMemo(() => {
    const labels = allFinancials.map((f) => f.sc.name);
    return {
      labels,
      datasets: [
        {
          label: "Receita",
          data: allFinancials.map((f) => f.fin.revenueTotalMonth),
          backgroundColor: "rgba(99,102,241,0.7)",
          borderColor: "rgba(99,102,241,1)",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Custo",
          data: allFinancials.map((f) => f.fin.costTotalMonth),
          backgroundColor: "rgba(239,68,68,0.6)",
          borderColor: "rgba(239,68,68,1)",
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Lucro",
          data: allFinancials.map((f) => f.fin.profitMonth),
          backgroundColor: allFinancials.map((f) =>
            f.fin.profitMonth >= 0
              ? "rgba(34,197,94,0.7)"
              : "rgba(239,68,68,0.4)",
          ),
          borderColor: allFinancials.map((f) =>
            f.fin.profitMonth >= 0
              ? "rgba(34,197,94,1)"
              : "rgba(239,68,68,1)",
          ),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [allFinancials]);

  // ── Line chart: Growth trajectory ────────────────────────────────────────
  const growthChartData = useMemo(() => {
    // Phases: months 1-3 Mínimo, 4-8 Crescimento, 9-14 Regional, 15-24 SP, 25-30 Nacional
    const phases: Array<{ months: number[]; idx: number }> = [
      { months: [1, 2, 3], idx: 0 },
      { months: [4, 5, 6, 7, 8], idx: 1 },
      { months: [9, 10, 11, 12, 13, 14], idx: 2 },
      { months: [15, 16, 17, 18, 19, 20, 21, 22, 23, 24], idx: 3 },
      { months: [25, 26, 27, 28, 29, 30], idx: 4 },
    ];

    const labels: string[] = [];
    const revenues: number[] = [];
    const costs: number[] = [];
    const profits: number[] = [];

    for (const phase of phases) {
      for (const m of phase.months) {
        const fin = allFinancials[phase.idx].fin;
        labels.push(`M${m}`);
        revenues.push(fin.revenueTotalMonth);
        costs.push(fin.costTotalMonth);
        profits.push(fin.profitMonth);
      }
    }

    return {
      labels,
      datasets: [
        {
          label: "Receita",
          data: revenues,
          borderColor: "rgba(99,102,241,0.9)",
          backgroundColor: "rgba(99,102,241,0.1)",
          fill: false,
          tension: 0.4,
          pointRadius: 2,
        },
        {
          label: "Custo",
          data: costs,
          borderColor: "rgba(239,68,68,0.8)",
          backgroundColor: "rgba(239,68,68,0.05)",
          fill: false,
          tension: 0.4,
          pointRadius: 2,
        },
        {
          label: "Lucro",
          data: profits,
          borderColor: "rgba(34,197,94,0.9)",
          backgroundColor: "rgba(34,197,94,0.1)",
          fill: false,
          tension: 0.4,
          pointRadius: 2,
        },
      ],
    };
  }, [allFinancials]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-8">
      {/* ── Section 1: Scenario Cards ───────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeader
          title="Cenários Operacionais de Telemedicina"
          subtitle="Selecione um cenário de teleconsulta por vídeo para ver a análise financeira detalhada"
          badge="5 presets"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {allFinancials.map(({ sc, fin }, i) => {
            const isSelected = selectedId === sc.id;
            const isBest = sc.id === bestId;
            return (
              <motion.div
                key={sc.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
              >
                <Card
                  className={`cursor-pointer transition-all duration-200 border overflow-hidden ${
                    isSelected
                      ? "border-primary shadow-lg shadow-primary/20 bg-primary/5"
                      : "border-border/60 bg-card/80 hover:border-primary/40 hover:shadow-md"
                  }`}
                  onClick={() =>
                    setSelectedId(isSelected ? null : sc.id)
                  }
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {ICON_MAP[sc.icon] ?? "⚙️"}
                        </span>
                        <div>
                          <p className="text-sm font-bold leading-tight">
                            {sc.name}
                          </p>
                          {isBest && (
                            <span className="text-[8px] font-bold uppercase tracking-wider bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded-full">
                              Mais lucrativo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                      {sc.description}
                    </p>

                    {/* Key metrics grid */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="bg-secondary/40 rounded-lg px-2 py-1.5">
                        <p className="text-muted-foreground">Médicos</p>
                        <p className="font-mono font-bold text-foreground">
                          {sc.params.doctorsPerShift}
                        </p>
                      </div>
                      <div className="bg-secondary/40 rounded-lg px-2 py-1.5">
                        <p className="text-muted-foreground">Psicólogos</p>
                        <p className="font-mono font-bold text-foreground">
                          {sc.params.psychologistsPerShift}
                        </p>
                      </div>
                      <div className="bg-secondary/40 rounded-lg px-2 py-1.5">
                        <p className="text-muted-foreground">Horas/dia</p>
                        <p className="font-mono font-bold text-foreground">
                          {sc.params.hoursPerDay}h
                        </p>
                      </div>
                      <div className="bg-secondary/40 rounded-lg px-2 py-1.5">
                        <p className="text-muted-foreground">Dias/mês</p>
                        <p className="font-mono font-bold text-foreground">
                          {diasMes > 0 ? diasMes : sc.params.workDaysPerMonth}d
                        </p>
                      </div>
                    </div>

                    {/* Profit summary */}
                    <div className="border-t border-border/40 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground">
                          Lucro/mês
                        </span>
                        <span
                          className={`text-xs font-bold font-mono ${profitColor(fin.profitMonth)}`}
                        >
                          {FK(fin.profitMonth)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Margem
                        </span>
                        <span
                          className={`text-xs font-bold font-mono ${marginColor(fin.marginPct)}`}
                        >
                          {F2(fin.marginPct)}
                        </span>
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <p className="text-[9px] text-center text-muted-foreground/60">
                      {isSelected ? "▲ Fechar detalhes" : "▼ Ver detalhes"}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Expanded detail panel */}
        <AnimatePresence>
          {selectedId && (() => {
            const item = allFinancials.find((f) => f.sc.id === selectedId);
            if (!item) return null;
            const { sc, fin } = item;
            return (
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border-primary/40 bg-primary/5 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-2xl">{ICON_MAP[sc.icon] ?? "⚙️"}</span>
                      <div>
                        <h3 className="text-base font-bold">{sc.name}</h3>
                        <p className="text-xs text-muted-foreground">{sc.description}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        {
                          label: "Teleconsultas/dia",
                          value: NL(fin.consultPerDay),
                          color: "text-foreground",
                        },
                        {
                          label: "Teleconsultas/mês",
                          value: NL(fin.consultPerMonth),
                          color: "text-foreground",
                        },
                        {
                          label: "Receita teleconsultas",
                          value: FK(fin.revenueConsultMonth),
                          color: "text-primary",
                        },
                        {
                          label: "Receita derivados (receitas, exames)",
                          value: FK(fin.revenueDerivMonth),
                          color: "text-blue-400",
                        },
                        {
                          label: "Custo pessoal",
                          value: FK(fin.costStaffMonth),
                          color: "text-orange-400",
                        },
                        {
                          label: "Custo infra",
                          value: FK(fin.costInfraMonth),
                          color: "text-orange-400",
                        },
                        {
                          label: "Receita total",
                          value: FK(fin.revenueTotalMonth),
                          color: "text-primary",
                        },
                        {
                          label: "Custo total",
                          value: FK(fin.costTotalMonth),
                          color: "text-red-400",
                        },
                        {
                          label: "Resultado/mês",
                          value: FK(fin.profitMonth),
                          color: profitColor(fin.profitMonth),
                        },
                        {
                          label: "Margem",
                          value: F2(fin.marginPct),
                          color: marginColor(fin.marginPct),
                        },
                        {
                          label: "Retorno anual (ROI)",
                          value: F2(fin.roiAnual * 100),
                          color: fin.roiAnual > 0 ? "text-green-400" : "text-red-400",
                          subtitle: "lucro×12 ÷ custo total",
                        },
                        {
                          label: "Ponto de equilíbrio",
                          value:
                            fin.breakevenMonths === Infinity
                              ? "Impossível"
                              : `${fin.breakevenMonths}m`,
                          color:
                            fin.breakevenMonths === Infinity
                              ? "text-red-400"
                              : fin.breakevenMonths <= 6
                                ? "text-green-400"
                                : "text-yellow-400",
                        },
                      ].map(({ label, value, color, subtitle }) => (
                        <div
                          key={label}
                          className="bg-card/80 border border-border/60 rounded-xl p-3"
                        >
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {label}
                          </p>
                          {subtitle && (
                            <p className="text-[8px] text-muted-foreground/60 mt-0.5">
                              {subtitle}
                            </p>
                          )}
                          <p className={`text-base font-bold font-mono mt-1 ${color}`}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* ── Section 2: Comparison table ─────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeader
          title="Comparativo de Cenários de Telemedicina"
          subtitle="Todos os 5 cenários de teleconsulta lado a lado com métricas financeiras completas"
        />

        <Card className="border-border/60 bg-card/80 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/30">
                    <th className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wider text-[10px] w-44">
                      Métrica
                    </th>
                    {allFinancials.map(({ sc }) => (
                      <th
                        key={sc.id}
                        className={`px-3 py-3 text-center font-bold text-[10px] uppercase tracking-wide ${
                          sc.id === bestId ? "text-green-400" : "text-foreground"
                        }`}
                      >
                        <span className="mr-1">{ICON_MAP[sc.icon] ?? "⚙️"}</span>
                        {sc.name}
                        {sc.id === bestId && (
                          <span className="ml-1 text-[7px] bg-green-500/20 text-green-400 border border-green-500/30 px-1 py-0.5 rounded-full">
                            ★
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(
                    [
                      {
                        label: "Médicos",
                        get: (sc: OperationalScenario) =>
                          sc.params.doctorsPerShift.toString(),
                        color: () => "text-foreground",
                      },
                      {
                        label: "Psicólogos",
                        get: (sc: OperationalScenario) =>
                          sc.params.psychologistsPerShift.toString(),
                        color: () => "text-foreground",
                      },
                      {
                        label: "Horas/dia",
                        get: (sc: OperationalScenario) =>
                          `${sc.params.hoursPerDay}h`,
                        color: () => "text-foreground",
                      },
                      {
                        label: "Teleconsultas/mês",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          NL(fin.consultPerMonth),
                        color: () => "text-foreground",
                      },
                      {
                        label: "Receita teleconsultas",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          FK(fin.revenueConsultMonth),
                        color: () => "text-primary",
                      },
                      {
                        label: "Receita derivados (receitas, exames)",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          FK(fin.revenueDerivMonth),
                        color: () => "text-blue-400",
                      },
                      {
                        label: "Receita total",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          FK(fin.revenueTotalMonth),
                        color: () => "text-primary font-bold",
                      },
                      {
                        label: "Custo pessoal",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          FK(fin.costStaffMonth),
                        color: () => "text-orange-400",
                      },
                      {
                        label: "Custo infra",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          FK(fin.costInfraMonth),
                        color: () => "text-orange-400",
                      },
                      {
                        label: "Resultado/mês",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          FK(fin.profitMonth),
                        color: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          profitColor(fin.profitMonth) + " font-bold",
                      },
                      {
                        label: "Margem %",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          F2(fin.marginPct),
                        color: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          marginColor(fin.marginPct),
                      },
                      {
                        label: "Retorno anual (ROI)",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          F2(fin.roiAnual * 100),
                        color: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          fin.roiAnual > 0 ? "text-green-400" : "text-red-400",
                      },
                      {
                        label: "Ponto de equilíbrio (meses)",
                        get: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          fin.breakevenMonths === Infinity
                            ? "Impossível"
                            : fin.breakevenMonths.toString(),
                        color: (_sc: OperationalScenario, fin: ScenarioFinancials) =>
                          fin.breakevenMonths === Infinity
                            ? "text-red-400"
                            : fin.breakevenMonths <= 6
                              ? "text-green-400"
                              : "text-yellow-400",
                      },
                    ] as Array<{
                      label: string;
                      get: (sc: OperationalScenario, fin: ScenarioFinancials) => string;
                      color: (sc: OperationalScenario, fin: ScenarioFinancials) => string;
                    }>
                  ).map((row, ri) => (
                    <tr
                      key={row.label}
                      className={ri % 2 === 0 ? "bg-transparent" : "bg-secondary/10"}
                    >
                      <td className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                        {row.label}
                      </td>
                      {allFinancials.map(({ sc, fin }) => (
                        <td
                          key={sc.id}
                          className={`px-3 py-2.5 text-center font-mono text-xs ${row.color(sc, fin)}`}
                        >
                          {row.get(sc, fin)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section 3: Mix Optimizer ─────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeader
          title="Otimizador de Mix de Telemedicina"
          subtitle="Ajuste o mix de teleconsultas e veja o impacto em tempo real na receita e lucratividade"
          badge="interativo"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Controls */}
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" />
                Composição de teleconsultas
              </p>

              <Slider
                label={`Clínica Geral — ${clinicaPct}% | Psicólogo — ${100 - clinicaPct}%`}
                value={clinicaPct}
                onChange={setClinicaPct}
                min={0}
                max={100}
              />

              <Slider
                label={`Duração média: ${avgDuration} min`}
                value={avgDuration}
                onChange={setAvgDuration}
                min={5}
                max={40}
              />

              <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2 pt-2">
                <span className="w-1 h-4 bg-primary rounded-full" />
                Probabilidade por tipo de serviço
              </p>

              <div className="space-y-2">
                <OutcomeSlider
                  label="Receita simples"
                  value={pReceitaSimples}
                  onChange={setPReceitaSimples}
                />
                <OutcomeSlider
                  label="Receita controlada"
                  value={pControlada}
                  onChange={setPControlada}
                />
                <OutcomeSlider
                  label="Receita azul"
                  value={pAzul}
                  onChange={setPAzul}
                />
                <OutcomeSlider
                  label="Exame laboratorial"
                  value={pExameLab}
                  onChange={setPExameLab}
                />
                <OutcomeSlider
                  label="Exame imagem"
                  value={pExameImagem}
                  onChange={setPExameImagem}
                />
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-5 space-y-4">
              <p className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" />
                Projeção com mix atual de teleconsultas
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Rev./teleconsulta",
                    value: `R$ ${mixStats.revPerConsult.toFixed(2).replace(".", ",")}`,
                    color: "text-primary",
                  },
                  {
                    label: "Receita mensal",
                    value: FK(mixStats.monthlyRevenue),
                    color: "text-primary",
                  },
                  {
                    label: "Lucro mensal",
                    value: FK(mixStats.profit),
                    color: profitColor(mixStats.profit),
                  },
                  {
                    label: "Margem",
                    value: F2(mixStats.margin),
                    color: marginColor(mixStats.margin),
                  },
                ].map(({ label, value, color }) => (
                  <motion.div
                    key={label}
                    layout
                    className="bg-card border border-border/60 rounded-xl p-3 text-center"
                  >
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {label}
                    </p>
                    <p className={`text-lg font-bold font-mono mt-1 ${color}`}>
                      {value}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="bg-secondary/30 border border-border/40 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Recomendação de equipe (base: Crescimento)
                </p>
                <div className="flex gap-4">
                  <div>
                    <p className="text-[9px] text-muted-foreground">Médicos</p>
                    <p className="text-xl font-bold font-mono text-foreground">
                      {mixStats.recDoctors}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Psicólogos</p>
                    <p className="text-xl font-bold font-mono text-foreground">
                      {mixStats.recPsychos}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground">Duração</p>
                    <p className="text-xl font-bold font-mono text-foreground">
                      {avgDuration}min
                    </p>
                  </div>
                </div>
              </div>

              {mixStats.profit < 0 && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-3 text-xs flex items-start gap-2">
                  <span>⚠️</span>
                  <span>
                    Mix atual resulta em prejuízo. Aumente a proporção de
                    clínica geral ou reduza a duração média das teleconsultas.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section 4: Scale charts ──────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeader
          title="Crescimento em Escala — Telemedicina"
          subtitle="Comparativo visual e trajetória de expansão da telemedicina ao longo de 30 meses"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar: scenario comparison */}
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                Comparativo: receita × custo × lucro por cenário de teleconsulta
              </p>
              <div className="h-64">
                <Bar
                  data={barChartData}
                  options={{
                    ...CHART_DEFAULTS,
                    plugins: {
                      ...CHART_DEFAULTS.plugins,
                      tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                          label: (ctx) =>
                            ` ${ctx.dataset.label}: ${FK(ctx.parsed.y ?? 0)}`,
                        },
                      },
                    },
                    scales: {
                      ...CHART_DEFAULTS.scales,
                      y: {
                        ...CHART_DEFAULTS.scales.y,
                        title: {
                          display: true,
                          text: "R$ / mês",
                          color: "#64748b",
                          font: { size: 9 },
                        },
                        ticks: {
                          ...CHART_DEFAULTS.scales.y.ticks,
                          callback: (v) => FK(v as number),
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Line: growth trajectory */}
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
                Trajetória hipotética de expansão da telemedicina (meses 1–30)
              </p>
              {/* Phase legend */}
              <div className="flex flex-wrap gap-3 mb-1 text-[9px] text-muted-foreground">
                <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground/50 self-center">
                  Fases:
                </span>
                {[
                  { label: "M1–3: Mínimo Viável", color: "bg-slate-400" },
                  { label: "M4–8: Crescimento", color: "bg-blue-400" },
                  { label: "M9–14: Regional", color: "bg-violet-400" },
                  { label: "M15–24: SP", color: "bg-amber-400" },
                  { label: "M25+: Nacional", color: "bg-emerald-400" },
                ].map(({ label, color }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1"
                  >
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    {label}
                  </span>
                ))}
              </div>
              {/* Separator */}
              <div className="border-t border-border/30 mb-2" />
              {/* Dataset legend (Receita / Custo / Lucro) shown by Chart.js via options.plugins.legend */}
              <div className="h-52">
                <Line
                  data={growthChartData}
                  options={{
                    ...CHART_DEFAULTS,
                    plugins: {
                      ...CHART_DEFAULTS.plugins,
                      tooltip: {
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks: {
                          label: (ctx) =>
                            ` ${ctx.dataset.label}: ${FK(ctx.parsed.y ?? 0)}`,
                        },
                      },
                    },
                    scales: {
                      ...CHART_DEFAULTS.scales,
                      x: {
                        ...CHART_DEFAULTS.scales.x,
                        title: {
                          display: true,
                          text: "Mês",
                          color: "#64748b",
                          font: { size: 9 },
                        },
                      },
                      y: {
                        ...CHART_DEFAULTS.scales.y,
                        title: {
                          display: true,
                          text: "R$ / mês",
                          color: "#64748b",
                          font: { size: 9 },
                        },
                        ticks: {
                          ...CHART_DEFAULTS.scales.y.ticks,
                          callback: (v) => FK(v as number),
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
