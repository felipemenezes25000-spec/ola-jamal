import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import type { TooltipItem } from "chart.js";
import { Bar, Line } from "react-chartjs-2";
import {
  RENOVEJA_SERVICES,
  CONSULTATION_OUTCOMES,
  PATIENT_PROFILES,
  calcConsultationRevenue,
  calcTotalRevenuePerConsultation,
} from "@/data/renovejaServices";
import type { ServiceType } from "@/data/renovejaServices";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
);

/* ─── Formatters ─── */
const FK = (v: number): string => {
  const a = Math.abs(v);
  const s = v < 0 ? "- " : "";
  if (a >= 1e6) return s + "R$ " + (a / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return s + "R$ " + (a / 1e3).toFixed(1) + "K";
  return s + "R$ " + Math.round(a).toLocaleString("pt-BR");
};
const F2 = (v: number): string => v.toFixed(2).replace(".", ",");
const NL = (v: number): string => Math.round(v).toLocaleString("pt-BR");

/* ─── Shared chart defaults ─── */
const CHART_FONT = { family: "ui-monospace, SFMono-Regular, Menlo, monospace", size: 10 };
const CHART_COLOR_GRID = "rgba(255,255,255,0.06)";
const CHART_COLOR_TEXT = "rgba(255,255,255,0.55)";

/* ─── Service palette ─── */
const SERVICE_COLORS: Record<ServiceType, string> = {
  consulta_clinica:    "rgba(99,102,241,0.85)",
  consulta_psico:      "rgba(139,92,246,0.85)",
  receita_simples:     "rgba(34,197,94,0.85)",
  receita_controlada:  "rgba(234,179,8,0.85)",
  receita_azul:        "rgba(59,130,246,0.85)",
  exame_lab:           "rgba(249,115,22,0.85)",
  exame_imagem:        "rgba(236,72,153,0.85)",
  atestado:            "rgba(148,163,184,0.5)",
  encaminhamento:      "rgba(100,116,139,0.5)",
};

/* ─── Reusable sub-components ─── */
function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  fmt,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  fmt?: (v: number) => string;
}) {
  return (
    <div className="bg-card/80 border border-border/60 rounded-xl p-3 hover:border-primary/30 transition-all duration-200">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between mb-2">
        <span>{label}</span>
        <span className="text-primary font-mono text-xs">{fmt ? fmt(value) : NL(value)}</span>
      </label>
      <input
        type="range"
        className="w-full accent-primary h-1.5 rounded-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground/60 font-mono">{fmt ? fmt(min) : NL(min)}</span>
        <span className="text-[9px] text-muted-foreground/60 font-mono">{fmt ? fmt(max) : NL(max)}</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color = "text-foreground",
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
    >
      <Card className="border-border/60 bg-card/80 overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
        <CardContent className="p-3 text-center relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-base font-bold font-mono mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

/* ─── Prop Types ─── */
export interface FunilConsultaTabProps {
  pacientesMes: number;
  durMedia: number;
  diasMes: number;
}

/* ─── Main component ─── */
export function FunilConsultaTab({ pacientesMes, durMedia, diasMes }: FunilConsultaTabProps) {
  /* Section 2 — patient mix sliders (%) */
  const defaultMix = useMemo(
    () => PATIENT_PROFILES.map((p) => Math.round(p.populationPct * 100)),
    [],
  );
  const [mixRaw, setMixRaw] = useState<number[]>(defaultMix);

  /* Section 3 — desdobramentos sliders */
  const [simPacientes, setSimPacientes] = useState(pacientesMes);
  useEffect(() => { setSimPacientes(pacientesMes); }, [pacientesMes]);
  const [pctSimples, setPctSimples] = useState(
    Math.round(
      (CONSULTATION_OUTCOMES.find((o) => o.serviceId === "receita_simples")?.probability ?? 0.55) * 100,
    ),
  );
  const [pctControlada, setPctControlada] = useState(
    Math.round(
      (CONSULTATION_OUTCOMES.find((o) => o.serviceId === "receita_controlada")?.probability ?? 0.12) * 100,
    ),
  );
  const [pctExameLab, setPctExameLab] = useState(
    Math.round(
      (CONSULTATION_OUTCOMES.find((o) => o.serviceId === "exame_lab")?.probability ?? 0.35) * 100,
    ),
  );
  const [pctExameImg, setPctExameImg] = useState(
    Math.round(
      (CONSULTATION_OUTCOMES.find((o) => o.serviceId === "exame_imagem")?.probability ?? 0.15) * 100,
    ),
  );

  /* Section 4 — 12-month growth */
  const [growthPct, setGrowthPct] = useState(5);

  /* ─── SECTION 1: Funil data ─── */
  const funnelData = useMemo(() => {
    const consultaRev = calcConsultationRevenue(durMedia, "clinica");
    const outcomes = CONSULTATION_OUTCOMES.filter((o) => RENOVEJA_SERVICES[o.serviceId].price > 0);
    const derivs = outcomes.map((o) => {
      const svc = RENOVEJA_SERVICES[o.serviceId];
      const expected = o.probability * o.avgQuantity * svc.price;
      return {
        id: o.serviceId,
        name: svc.name,
        probability: o.probability,
        avgQuantity: o.avgQuantity,
        price: svc.price,
        expected,
        color: SERVICE_COLORS[o.serviceId],
      };
    });
    const totalDerivs = derivs.reduce((s, d) => s + d.expected, 0);
    const totalPerConsulta = calcTotalRevenuePerConsultation(durMedia, "clinica");
    return { consultaRev, derivs, totalDerivs, totalPerConsulta };
  }, [durMedia]);

  const funnelChartData = useMemo(() => {
    const labels = ["Teleconsulta", ...funnelData.derivs.map((d) => d.name.split(" ").slice(0, 2).join(" "))];
    const values = [funnelData.consultaRev, ...funnelData.derivs.map((d) => d.expected)];
    const colors = [SERVICE_COLORS.consulta_clinica, ...funnelData.derivs.map((d) => d.color)];
    return {
      labels,
      datasets: [
        {
          label: "Receita esperada (R$)",
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    };
  }, [funnelData]);

  const funnelChartOpts = useMemo(
    () => ({
      indexAxis: "y" as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"bar">) => ` R$ ${F2((ctx.parsed as { x: number }).x ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: CHART_COLOR_GRID },
          ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT, callback: (v: number | string) => `R$${+v < 1 ? F2(+v) : Math.round(+v)}` },
          title: { display: true, text: "Receita esperada por teleconsulta (R$)", color: CHART_COLOR_TEXT, font: CHART_FONT },
        },
        y: {
          grid: { display: false },
          ticks: { color: CHART_COLOR_TEXT, font: { ...CHART_FONT, size: 9 } },
        },
      },
    }),
    [],
  );

  /* ─── SECTION 2: Mix de pacientes ─── */
  const mixSum = useMemo(() => mixRaw.reduce((s, v) => s + v, 0), [mixRaw]);

  const updateMix = useCallback((idx: number, val: number) => {
    setMixRaw((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  const profileRevenues = useMemo(
    () =>
      PATIENT_PROFILES.map((p) => {
        const consultaRev = calcConsultationRevenue(p.avgConsultDurationMin, "clinica");
        const derivTotal = CONSULTATION_OUTCOMES.reduce((s, o) => {
          const svc = RENOVEJA_SERVICES[o.serviceId];
          const prob = (p.outcomes[o.serviceId] ?? o.probability) as number;
          return s + prob * o.avgQuantity * svc.price;
        }, 0);
        return {
          ...p,
          consultaRev,
          derivTotal,
          totalPerVisit: Math.round((consultaRev + derivTotal) * 100) / 100,
          yearlyRevPerPatient:
            Math.round(((consultaRev + derivTotal) * p.consultasPerYear) * 100) / 100,
        };
      }),
    [],
  );

  const weightedAvgRevPerConsulta = useMemo(() => {
    if (mixSum === 0) return 0;
    const total = profileRevenues.reduce((s, pr, i) => {
      const weight = mixRaw[i] / mixSum;
      return s + pr.totalPerVisit * weight;
    }, 0);
    return Math.round(total * 100) / 100;
  }, [profileRevenues, mixRaw, mixSum]);

  const weightedAvgDur = useMemo(() => {
    if (mixSum === 0) return durMedia;
    return profileRevenues.reduce((s, pr, i) => s + pr.avgConsultDurationMin * (mixRaw[i] / mixSum), 0);
  }, [profileRevenues, mixRaw, mixSum, durMedia]);

  const monthlyRevFromMix = useMemo(
    () => Math.round(weightedAvgRevPerConsulta * pacientesMes * 100) / 100,
    [weightedAvgRevPerConsulta, pacientesMes],
  );

  /* ─── SECTION 3: Desdobramentos ─── */
  const desdobSvc = useMemo(() => {
    const items: Array<{
      id: ServiceType;
      name: string;
      pct: number;
      avgQty: number;
      price: number;
      costToDeliver: number;
    }> = [
      {
        id: "receita_simples",
        name: RENOVEJA_SERVICES.receita_simples.name,
        pct: pctSimples / 100,
        avgQty: CONSULTATION_OUTCOMES.find((o) => o.serviceId === "receita_simples")?.avgQuantity ?? 1.3,
        price: RENOVEJA_SERVICES.receita_simples.price,
        costToDeliver: RENOVEJA_SERVICES.receita_simples.costToDeliver,
      },
      {
        id: "receita_controlada",
        name: RENOVEJA_SERVICES.receita_controlada.name,
        pct: pctControlada / 100,
        avgQty: CONSULTATION_OUTCOMES.find((o) => o.serviceId === "receita_controlada")?.avgQuantity ?? 1.1,
        price: RENOVEJA_SERVICES.receita_controlada.price,
        costToDeliver: RENOVEJA_SERVICES.receita_controlada.costToDeliver,
      },
      {
        id: "exame_lab",
        name: RENOVEJA_SERVICES.exame_lab.name,
        pct: pctExameLab / 100,
        avgQty: CONSULTATION_OUTCOMES.find((o) => o.serviceId === "exame_lab")?.avgQuantity ?? 1.5,
        price: RENOVEJA_SERVICES.exame_lab.price,
        costToDeliver: RENOVEJA_SERVICES.exame_lab.costToDeliver,
      },
      {
        id: "exame_imagem",
        name: RENOVEJA_SERVICES.exame_imagem.name,
        pct: pctExameImg / 100,
        avgQty: CONSULTATION_OUTCOMES.find((o) => o.serviceId === "exame_imagem")?.avgQuantity ?? 1.2,
        price: RENOVEJA_SERVICES.exame_imagem.price,
        costToDeliver: RENOVEJA_SERVICES.exame_imagem.costToDeliver,
      },
    ];
    return items;
  }, [pctSimples, pctControlada, pctExameLab, pctExameImg]);

  const desdobCalc = useMemo(() => {
    const consultaRevMes = calcConsultationRevenue(durMedia, "clinica") * simPacientes;
    const consultaCostMes = RENOVEJA_SERVICES.consulta_clinica.costToDeliver * durMedia * simPacientes;

    const rows = desdobSvc.map((svc) => {
      const volume = svc.pct * svc.avgQty * simPacientes;
      const revenue = volume * svc.price;
      const cost = volume * svc.costToDeliver;
      return { ...svc, volume: Math.round(volume * 10) / 10, revenue: Math.round(revenue * 100) / 100, cost: Math.round(cost * 100) / 100 };
    });

    const derivRevTotal = rows.reduce((s, r) => s + r.revenue, 0);
    const derivCostTotal = rows.reduce((s, r) => s + r.cost, 0);
    const totalRevMes = Math.round((consultaRevMes + derivRevTotal) * 100) / 100;
    const totalCostMes = Math.round((consultaCostMes + derivCostTotal) * 100) / 100;
    const margemBruta = Math.round((totalRevMes - totalCostMes) * 100) / 100;
    const revPorPaciente = simPacientes > 0 ? Math.round((totalRevMes / simPacientes) * 100) / 100 : 0;

    return { rows, consultaRevMes, totalRevMes, totalCostMes, margemBruta, revPorPaciente };
  }, [desdobSvc, simPacientes, durMedia]);

  const desdobBarData = useMemo(() => ({
    labels: ["Teleconsulta", ...desdobCalc.rows.map((r) => r.name.split(" ").slice(0, 2).join(" "))],
    datasets: [
      {
        label: "Receita (R$)",
        data: [desdobCalc.consultaRevMes, ...desdobCalc.rows.map((r) => r.revenue)],
        backgroundColor: [
          SERVICE_COLORS.consulta_clinica,
          SERVICE_COLORS.receita_simples,
          SERVICE_COLORS.receita_controlada,
          SERVICE_COLORS.exame_lab,
          SERVICE_COLORS.exame_imagem,
        ],
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }), [desdobCalc]);

  const barChartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: CHART_COLOR_TEXT, font: CHART_FONT, boxWidth: 10, padding: 10 } },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"bar">) => ` ${FK((ctx.parsed as { y: number }).y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: CHART_COLOR_TEXT, font: { ...CHART_FONT, size: 9 } },
        },
        y: {
          grid: { color: CHART_COLOR_GRID },
          ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT, callback: (v: number | string) => FK(+v) },
        },
      },
    }),
    [],
  );

  /* ─── SECTION 4: 12-month projection ─── */
  const projection12 = useMemo(() => {
    const monthGrowth = growthPct / 100;
    const base = desdobCalc.totalRevMes;
    const months: string[] = [];
    const totalRevs: number[] = [];
    const consultaRevs: number[] = [];
    const derivRevs: number[] = [];

    for (let i = 0; i < 12; i++) {
      const multiplier = Math.pow(1 + monthGrowth, i);
      const total = Math.round(base * multiplier * 100) / 100;
      const consultaFrac = desdobCalc.totalRevMes > 0 ? desdobCalc.consultaRevMes / desdobCalc.totalRevMes : 0.5;
      months.push(`M${i + 1}`);
      totalRevs.push(total);
      consultaRevs.push(Math.round(total * consultaFrac * 100) / 100);
      derivRevs.push(Math.round(total * (1 - consultaFrac) * 100) / 100);
    }

    const cumulative = totalRevs.reduce((s, v) => s + v, 0);
    return { months, totalRevs, consultaRevs, derivRevs, cumulative, base };
  }, [desdobCalc, growthPct]);

  const lineChartData = useMemo(
    () => ({
      labels: projection12.months,
      datasets: [
        {
          label: "Teleconsultas",
          data: projection12.consultaRevs,
          borderColor: SERVICE_COLORS.consulta_clinica,
          backgroundColor: "rgba(99,102,241,0.12)",
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Derivados",
          data: projection12.derivRevs,
          borderColor: SERVICE_COLORS.receita_simples,
          backgroundColor: "rgba(34,197,94,0.08)",
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
        {
          label: "Total",
          data: projection12.totalRevs,
          borderColor: "rgba(251,191,36,0.9)",
          backgroundColor: "rgba(251,191,36,0.04)",
          fill: false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          borderDash: [],
        },
      ],
    }),
    [projection12],
  );

  const lineChartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: CHART_COLOR_TEXT, font: CHART_FONT, boxWidth: 10, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"line">) =>
              ` ${ctx.dataset.label ?? ""}: ${FK((ctx.parsed as { y: number }).y ?? 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: CHART_COLOR_GRID },
          ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT },
          title: { display: true, text: "Mês", color: CHART_COLOR_TEXT, font: CHART_FONT },
        },
        y: {
          grid: { color: CHART_COLOR_GRID },
          ticks: { color: CHART_COLOR_TEXT, font: CHART_FONT, callback: (v: number | string) => FK(+v) },
          title: { display: true, text: "Receita mensal (R$)", color: CHART_COLOR_TEXT, font: CHART_FONT },
        },
      },
    }),
    [],
  );

  /* ─── Render ─── */
  return (
    <div className="space-y-8 pb-8">
      {/* ── SECTION 1: Funil de Receita por Consulta ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <SectionHeader
          title="Funil de Receita por Teleconsulta"
          subtitle={`Duração média: ${durMedia} min — como uma teleconsulta por vídeo se desdobra em múltiplos fluxos de receita`}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MetricCard
            label="Receita teleconsulta"
            value={`R$ ${F2(funnelData.consultaRev)}`}
            sub={`${durMedia} min × R$ ${F2(RENOVEJA_SERVICES.consulta_clinica.price)}`}
            color="text-primary"
            delay={0}
          />
          <MetricCard
            label="Receita derivados"
            value={`R$ ${F2(funnelData.totalDerivs)}`}
            sub="valor esperado"
            color="text-green-400"
            delay={0.05}
          />
          <MetricCard
            label="Total / teleconsulta"
            value={`R$ ${F2(funnelData.totalPerConsulta)}`}
            sub="teleconsulta + derivados"
            color="text-yellow-400"
            delay={0.1}
          />
          <MetricCard
            label="Multiplicador"
            value={`${funnelData.consultaRev > 0 ? F2(funnelData.totalPerConsulta / funnelData.consultaRev) : "—"}×`}
            sub="derivados / teleconsulta"
            color="text-orange-400"
            delay={0.15}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Waterfall table */}
          <Card className="lg:col-span-2 border-border/60 bg-card/80">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Desdobramento por serviço
              </p>
              <div className="space-y-1.5">
                {/* Consulta row */}
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: SERVICE_COLORS.consulta_clinica }} />
                    <span className="text-foreground font-medium">Teleconsulta clínica</span>
                  </span>
                  <span className="font-mono text-primary">R$ {F2(funnelData.consultaRev)}</span>
                </div>
                <div className="border-t border-border/40 my-1" />
                {funnelData.derivs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground truncate">{d.name.split(" ").slice(0, 3).join(" ")}</span>
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[9px] text-muted-foreground/60 font-mono">{Math.round(d.probability * 100)}%</span>
                      <span className="font-mono text-green-400 w-16 text-right">R$ {F2(d.expected)}</span>
                    </span>
                  </div>
                ))}
                <div className="border-t border-border/60 mt-2 pt-2 flex items-center justify-between text-xs font-bold">
                  <span className="text-foreground">Total esperado</span>
                  <span className="font-mono text-yellow-400">R$ {F2(funnelData.totalPerConsulta)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Horizontal bar chart */}
          <Card className="lg:col-span-3 border-border/60 bg-card/80">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contribuição por serviço (R$ / teleconsulta esperado)
              </p>
              <div style={{ height: 220 }}>
                <Bar data={funnelChartData} options={funnelChartOpts} />
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.section>

      {/* ── SECTION 2: Mix de Pacientes ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
      >
        <SectionHeader
          title="Mix de Pacientes — Telemedicina"
          subtitle="Ajuste a composição da base de pacientes atendidos por teleconsulta para calcular a receita média ponderada"
        />

        {/* Mix warning */}
        {Math.abs(mixSum - 100) > 1 && (
          <div className="mb-3 text-[10px] font-semibold text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
            Soma do mix: {mixSum}% — os percentuais não somam 100%. A ponderação usará a proporção relativa.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-4">
          {PATIENT_PROFILES.map((profile, idx) => {
            const pr = profileRevenues[idx];
            const weight = mixSum > 0 ? mixRaw[idx] / mixSum : 0;
            return (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05, duration: 0.25 }}
              >
                <Card className="border-border/60 bg-card/80 hover:border-primary/30 transition-all duration-200 h-full">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{profile.name}</p>
                        <p className="text-[9px] text-muted-foreground/80 leading-tight mt-0.5 line-clamp-2">
                          {profile.description}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold font-mono text-primary ml-1 flex-shrink-0">
                        {mixRaw[idx]}%
                      </span>
                    </div>

                    <div className="space-y-1 mb-2">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground">Teleconsultas/ano</span>
                        <span className="font-mono">{profile.consultasPerYear}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground">Duração média</span>
                        <span className="font-mono">{profile.avgConsultDurationMin} min</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground">Receita total/visita (teleconsulta + derivados)</span>
                        <span className="font-mono text-green-400">R$ {F2(pr.totalPerVisit)}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground">Receita/ano</span>
                        <span className="font-mono text-yellow-400">R$ {F2(pr.yearlyRevPerPatient)}</span>
                      </div>
                    </div>

                    {/* Contribution bar */}
                    <p className="text-[9px] text-muted-foreground mb-1">Peso no mix:</p>
                    <div className="w-full bg-secondary/60 rounded-full h-1 mb-2">
                      <div
                        className="bg-primary h-1 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, weight * 100)}%` }}
                      />
                    </div>

                    <span className="text-[9px] text-muted-foreground mb-0.5 block">% do mix</span>
                    <input
                      type="range"
                      className="w-full accent-primary h-1 rounded-full"
                      min={0}
                      max={100}
                      step={1}
                      value={mixRaw[idx]}
                      onChange={(e) => updateMix(idx, +e.target.value)}
                      aria-label={`Percentual do mix para ${profile.name}`}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Weighted results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Duração ponderada"
            value={`${F2(weightedAvgDur)} min`}
            sub="média do mix"
            color="text-primary"
            delay={0}
          />
          <MetricCard
            label="Receita/teleconsulta ponderada"
            value={`R$ ${F2(weightedAvgRevPerConsulta)}`}
            sub="teleconsulta + derivados"
            color="text-green-400"
            delay={0.04}
          />
          <MetricCard
            label="Receita mensal estimada"
            value={FK(monthlyRevFromMix)}
            sub={`${NL(pacientesMes)} pacientes/mês`}
            color="text-yellow-400"
            delay={0.08}
          />
          <MetricCard
            label="Receita anual estimada"
            value={FK(monthlyRevFromMix * 12)}
            sub="projeção linear"
            color="text-orange-400"
            delay={0.12}
          />
        </div>
      </motion.section>

      {/* ── SECTION 3: Simulador de Desdobramentos ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
      >
        <SectionHeader
          title="Simulador de Serviços Derivados"
          subtitle="Cada teleconsulta por vídeo pode gerar receitas, exames e outros serviços — ajuste as taxas de conversão abaixo"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-3">
            <SliderRow
              label="Pacientes / mês"
              value={simPacientes}
              onChange={setSimPacientes}
              min={10}
              max={5000}
              step={10}
            />
            <SliderRow
              label="% pacientes com receita simples"
              value={pctSimples}
              onChange={setPctSimples}
              min={0}
              max={100}
              fmt={(v) => `${v}%`}
            />
            <SliderRow
              label="% pacientes com receita controlada"
              value={pctControlada}
              onChange={setPctControlada}
              min={0}
              max={100}
              fmt={(v) => `${v}%`}
            />
            <SliderRow
              label="% pacientes com exame laboratorial"
              value={pctExameLab}
              onChange={setPctExameLab}
              min={0}
              max={100}
              fmt={(v) => `${v}%`}
            />
            <SliderRow
              label="% pacientes com exame de imagem"
              value={pctExameImg}
              onChange={setPctExameImg}
              min={0}
              max={100}
              fmt={(v) => `${v}%`}
            />
          </div>

          {/* Volume & revenue table */}
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Volume e Receita Mensal por Serviço
              </p>
              <div className="space-y-2">
                {/* Column headers */}
                <div className="flex items-center justify-between gap-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/40">
                  <span>Serviço</span>
                  <span className="flex items-center gap-3 flex-shrink-0">
                    <span className="w-12 text-right">Volume/mês</span>
                    <span className="w-20 text-right">Receita/mês</span>
                  </span>
                </div>
                {/* Consulta row */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: SERVICE_COLORS.consulta_clinica }} />
                    <span className="text-foreground font-medium">Teleconsulta clínica</span>
                  </span>
                  <span className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-mono text-muted-foreground w-12 text-right">{NL(simPacientes)}</span>
                    <span className="font-mono text-primary w-20 text-right">{FK(desdobCalc.consultaRevMes)}</span>
                  </span>
                </div>
                <div className="border-t border-border/40" />
                {desdobCalc.rows.map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: SERVICE_COLORS[row.id] }} />
                      <span className="text-muted-foreground truncate">{row.name.split(" ").slice(0, 3).join(" ")}</span>
                    </span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-mono text-muted-foreground/70 w-12 text-right">{F2(row.volume)}</span>
                      <span className="font-mono text-green-400 w-20 text-right">{FK(row.revenue)}</span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border/60 mt-3 pt-3 space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span>Receita total</span>
                  <span className="font-mono text-yellow-400">{FK(desdobCalc.totalRevMes)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Custo total</span>
                  <span className="font-mono text-red-400">{FK(desdobCalc.totalCostMes)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold">
                  <span>Margem bruta</span>
                  <span className={`font-mono ${desdobCalc.margemBruta >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {FK(desdobCalc.margemBruta)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Receita / paciente</span>
                  <span className="font-mono text-primary">R$ {F2(desdobCalc.revPorPaciente)}</span>
                </div>
                {desdobCalc.totalRevMes > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Margem %</span>
                    <span className="font-mono text-muted-foreground">
                      {F2((desdobCalc.margemBruta / desdobCalc.totalRevMes) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bar chart */}
          <Card className="border-border/60 bg-card/80">
            <CardContent className="p-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Receita mensal por tipo de serviço
              </p>
              <div style={{ height: 260 }}>
                <Bar data={desdobBarData} options={barChartOpts} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <MetricCard
            label="Receita total / mês"
            value={FK(desdobCalc.totalRevMes)}
            sub={`${NL(simPacientes)} pac × ${NL(diasMes)} dias`}
            color="text-yellow-400"
            delay={0}
          />
          <MetricCard
            label="Custo total / mês"
            value={FK(desdobCalc.totalCostMes)}
            sub="custo de entrega"
            color="text-red-400"
            delay={0.04}
          />
          <MetricCard
            label="Margem bruta / mês"
            value={FK(desdobCalc.margemBruta)}
            sub={desdobCalc.totalRevMes > 0 ? `${F2((desdobCalc.margemBruta / desdobCalc.totalRevMes) * 100)}% da receita` : "—"}
            color={desdobCalc.margemBruta >= 0 ? "text-green-400" : "text-red-400"}
            delay={0.08}
          />
          <MetricCard
            label="Receita / paciente"
            value={`R$ ${F2(desdobCalc.revPorPaciente)}`}
            sub="teleconsulta + derivados"
            color="text-primary"
            delay={0.12}
          />
        </div>
      </motion.section>

      {/* ── SECTION 4: Projeção 12 Meses ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
      >
        <SectionHeader
          title="Projeção 12 Meses — Teleconsultas"
          subtitle="Receita acumulada de teleconsultas por vídeo com crescimento composto mês a mês"
        />

        <div className="mb-4">
          <SliderRow
            label="Crescimento mensal (composto)"
            value={growthPct}
            onChange={setGrowthPct}
            min={0}
            max={30}
            step={1}
            fmt={(v) => `${v}%`}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MetricCard
            label="Mês 1"
            value={FK(projection12.base)}
            sub="receita base"
            color="text-muted-foreground"
            delay={0}
          />
          <MetricCard
            label={`Mês 12 (+${growthPct}%/mês)`}
            value={FK(projection12.totalRevs[11] ?? 0)}
            sub="projeção final"
            color="text-primary"
            delay={0.05}
          />
          <MetricCard
            label="Acumulado 12 meses"
            value={FK(projection12.cumulative)}
            sub="soma dos 12 meses"
            color="text-yellow-400"
            delay={0.1}
          />
          <MetricCard
            label="Crescimento total"
            value={
              projection12.base > 0
                ? `${F2(((projection12.totalRevs[11] ?? 0) / projection12.base - 1) * 100)}%`
                : "—"
            }
            sub="Mês 12 vs Mês 1"
            color="text-green-400"
            delay={0.15}
          />
        </div>

        <Card className="border-border/60 bg-card/80">
          <CardContent className="p-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Receita mensal — Teleconsultas vs Derivados vs Total (R$)
            </p>
            <div style={{ height: 280 }}>
              <Line data={lineChartData} options={lineChartOpts} />
            </div>
          </CardContent>
        </Card>
      </motion.section>
    </div>
  );
}
