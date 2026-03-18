/**
 * SimuladorCidadePotencial — Simulador de potencial de telemedicina por cidade
 * Projeta teleconsultas por vídeo, receita e expansão regional para o Estado de SP.
 */
import { useState, useMemo, useCallback } from "react";
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
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { Card, CardContent } from "@/components/ui/card";
import { SP_CITIES, SP_REGIOES } from "@/data/spCities";
import type { SPRegiao } from "@/data/spCities";
import {
  RENOVEJA_SERVICES,
  CONSULTATION_OUTCOMES,
  getCityConfig,
  calcCityPotential,
  calcTotalRevenuePerConsultation,
} from "@/data/renovejaServices";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
);

/* ─── Formatters ─── */
const FK = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "- " : "";
  if (a >= 1e6) return s + "R$ " + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return s + "R$ " + (a / 1e3).toFixed(1) + "K";
  return s + "R$ " + Math.round(a).toLocaleString("pt-BR");
};
const NL = (v: number) => Math.round(v).toLocaleString("pt-BR");
const F2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Accent normalization for search ─── */
function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* ─── Population-tier badge config ─── */
type TierKey = "micro" | "pequena" | "media" | "grande" | "metropole";

interface TierStyle {
  label: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
}

const TIER_STYLES: Record<TierKey, TierStyle> = {
  micro:     { label: "Micro",     textClass: "text-gray-400",   bgClass: "bg-gray-500/10",   borderClass: "border-gray-500/30" },
  pequena:   { label: "Pequena",   textClass: "text-blue-400",   bgClass: "bg-blue-500/10",   borderClass: "border-blue-500/30" },
  media:     { label: "Média",     textClass: "text-green-400",  bgClass: "bg-green-500/10",  borderClass: "border-green-500/30" },
  grande:    { label: "Grande",    textClass: "text-orange-400", bgClass: "bg-orange-500/10", borderClass: "border-orange-500/30" },
  metropole: { label: "Metrópole", textClass: "text-purple-400", bgClass: "bg-purple-500/10", borderClass: "border-purple-500/30" },
};

function getTier(pop: number): TierKey {
  if (pop < 10_000)  return "micro";
  if (pop < 50_000)  return "pequena";
  if (pop < 200_000) return "media";
  if (pop < 500_000) return "grande";
  return "metropole";
}

/* ─── Section header ─── */
function SectionHeader({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
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

/* ─── Metric card ─── */
function MetricCard({ label, value, sub, color = "text-foreground", delay = 0 }: {
  label: string; value: string; sub: string; color?: string; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.28 }}>
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
        <CardContent className="p-4 text-center relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</p>
          <p className="text-[9px] text-muted-foreground/80 mt-0.5">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Shared chart options ─── */
const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#94a3b8", font: { size: 10 }, boxWidth: 12 } },
    tooltip: { backgroundColor: "rgba(15,23,42,0.95)", titleColor: "#f1f5f9", bodyColor: "#cbd5e1", borderColor: "rgba(148,163,184,0.2)", borderWidth: 1 },
  },
  scales: {
    x: { ticks: { color: "#64748b", font: { size: 9 } }, grid: { color: "rgba(148,163,184,0.06)" } },
    y: { ticks: { color: "#64748b", font: { size: 9 } }, grid: { color: "rgba(148,163,184,0.06)" } },
  },
} as const;

/* ─── Service colors palette (stable) ─── */
const SERVICE_PALETTE: Record<string, { bg: string; border: string }> = {
  consulta_clinica:   { bg: "rgba(99,102,241,0.25)",  border: "#6366f1" },
  consulta_psico:     { bg: "rgba(168,85,247,0.25)",  border: "#a855f7" },
  receita_simples:    { bg: "rgba(34,197,94,0.25)",   border: "#22c55e" },
  receita_controlada: { bg: "rgba(234,179,8,0.25)",   border: "#eab308" },
  receita_azul:       { bg: "rgba(59,130,246,0.25)",  border: "#3b82f6" },
  exame_lab:          { bg: "rgba(20,184,166,0.25)",  border: "#14b8a6" },
  exame_imagem:       { bg: "rgba(249,115,22,0.25)",  border: "#f97316" },
  atestado:           { bg: "rgba(148,163,184,0.15)", border: "#94a3b8" },
  encaminhamento:     { bg: "rgba(244,63,94,0.20)",   border: "#f43f5e" },
};

/* ─── Penetration line-chart data for a set of cities ─── */
interface ExpansionPoint { month: number; pes: number; real: number; oti: number; }

function buildExpansionSeries(
  selectedCities: typeof SP_CITIES,
  basePenPct: number,   // 0–5 (percent)
  monthlyGrowthPct: number, // 0–20
): ExpansionPoint[] {
  const points: ExpansionPoint[] = [];
  for (let m = 1; m <= 24; m++) {
    const growthFactor = Math.pow(1 + monthlyGrowthPct / 100, m - 1);
    const pen = Math.min((basePenPct / 100) * growthFactor, 0.99);
    let realRev = 0;
    for (const city of selectedCities) {
      const r = calcCityPotential(city.pop, pen);
      realRev += r.monthlyRevenue;
    }
    points.push({ month: m, pes: realRev * 0.4, real: realRev, oti: realRev * 2.0 });
  }
  return points;
}

/* ─── Props ─── */
interface CidadePotencialTabProps {
  valConsulta: number;
  durMedia: number;
  diasMes: number;
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export function CidadePotencialTab({ valConsulta, durMedia, diasMes }: CidadePotencialTabProps) {
  /* ── state ── */
  const [search, setSearch]             = useState("");
  const [regionFilter, setRegionFilter] = useState<SPRegiao | "Todas">("Todas");
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(() => new Set());
  const [sortRegion, setSortRegion]     = useState<"pop" | "rev" | "cities">("rev");
  const [basePenPct, setBasePenPct]     = useState(0.5);    // 0.05–5
  const [growthPct, setGrowthPct]       = useState(5);      // 0–20

  /* ── derived: filtered list ── */
  const filteredCities = useMemo(() => {
    let list = SP_CITIES;
    if (regionFilter !== "Todas") list = list.filter(c => c.regiao === regionFilter);
    if (search.trim()) {
      const s = norm(search.trim());
      list = list.filter(c => norm(c.name).includes(s));
    }
    return list;
  }, [search, regionFilter]);

  /* ── selection helpers ── */
  const toggle = useCallback((name: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); } else { next.add(name); }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filteredCities.forEach(c => next.add(c.name));
      return next;
    });
  }, [filteredCities]);

  const clearAll = useCallback(() => setSelectedIds(new Set()), []);

  const selectRegion = useCallback((r: SPRegiao) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      SP_CITIES.filter(c => c.regiao === r).forEach(c => next.add(c.name));
      return next;
    });
  }, []);

  const deselectRegion = useCallback((r: SPRegiao) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      SP_CITIES.filter(c => c.regiao === r).forEach(c => next.delete(c.name));
      return next;
    });
  }, []);

  /* ── selected cities ── */
  const selectedCities = useMemo(
    () => SP_CITIES.filter(c => selectedIds.has(c.name)),
    [selectedIds],
  );

  /* ── per-region count in selection ── */
  const regionSelCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of selectedCities) m.set(c.regiao, (m.get(c.regiao) ?? 0) + 1);
    return m;
  }, [selectedCities]);

  const regionTotalCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of SP_CITIES) m.set(c.regiao, (m.get(c.regiao) ?? 0) + 1);
    return m;
  }, []);

  /* ── summary totals ── */
  const totalPop       = useMemo(() => selectedCities.reduce((s, c) => s + c.pop, 0), [selectedCities]);
  const totalEstUsers  = useMemo(() => selectedCities.reduce((s, c) => {
    const cfg = getCityConfig(c.pop);
    return s + Math.round(c.pop * cfg.telemedicineAdoptionRate * (basePenPct / 100) * 20); // scale to display adoptable base
  }, 0), [selectedCities, basePenPct]);

  /* ── Section 2: service-level potential ── */
  // revenue-per-consultation for each category, using durMedia and valConsulta props.
  // valConsulta (R$ per consultation from parent) overrides the base consultation price
  // when it differs from the internal default, so external pricing is always reflected.
  const revenuePerClinica = useMemo(() => {
    // Use valConsulta as the per-minute consultation price, replacing the internal default.
    // All downstream service outcomes are kept; only the consultation line is repriced.
    const internal = calcTotalRevenuePerConsultation(durMedia, "clinica");
    const internalConsultationRevenue = RENOVEJA_SERVICES.consulta_clinica.price * durMedia;
    const externalConsultationRevenue = valConsulta * durMedia;
    return internal - internalConsultationRevenue + externalConsultationRevenue;
  }, [durMedia, valConsulta]);

  const revenuePerPsico = useMemo(() =>
    calcTotalRevenuePerConsultation(durMedia, "psico"),
  [durMedia]);

  // aggregate city potentials at basePenPct
  const cityPotentials = useMemo(
    () => selectedCities.map(c => ({ city: c, pot: calcCityPotential(c.pop, basePenPct / 100) })),
    [selectedCities, basePenPct],
  );

  const totalMonthlyConsultations = useMemo(
    () => cityPotentials.reduce((s, { pot }) => s + pot.monthlyConsultations, 0),
    [cityPotentials],
  );

  const totalMonthlyRevenue = useMemo(
    () => cityPotentials.reduce((s, { pot }) => s + pot.monthlyRevenue, 0),
    [cityPotentials],
  );

  // per-service revenue breakdown from outcomes
  const serviceBreakdown = useMemo(() => {
    const consultations = totalMonthlyConsultations;
    if (consultations === 0) return [];

    // consultation split (weighted 65/35 clinica/psico default)
    const clinicaCount = Math.round(consultations * 0.65);
    const psicoCount   = consultations - clinicaCount;

    type Entry = { id: string; name: string; price: number; volume: number; revenue: number };
    const entries: Entry[] = [
      {
        id: "consulta_clinica",
        name: RENOVEJA_SERVICES.consulta_clinica.name,
        price: valConsulta * durMedia,
        volume: clinicaCount,
        revenue: clinicaCount * revenuePerClinica,
      },
      {
        id: "consulta_psico",
        name: RENOVEJA_SERVICES.consulta_psico.name,
        price: RENOVEJA_SERVICES.consulta_psico.price * durMedia,
        volume: psicoCount,
        revenue: psicoCount * revenuePerPsico,
      },
    ];

    for (const outcome of CONSULTATION_OUTCOMES) {
      const svc = RENOVEJA_SERVICES[outcome.serviceId];
      if (svc.price === 0) continue;
      const volume  = Math.round(consultations * outcome.probability * outcome.avgQuantity);
      const revenue = volume * svc.price;
      entries.push({ id: svc.id, name: svc.name, price: svc.price, volume, revenue });
    }

    const totalRev = entries.reduce((s, e) => s + e.revenue, 0) || 1;
    return entries
      .map(e => ({ ...e, pct: (e.revenue / totalRev) * 100 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [totalMonthlyConsultations, revenuePerClinica, revenuePerPsico, durMedia, valConsulta]);

  const serviceDonutData = useMemo(() => {
    if (serviceBreakdown.length === 0) return null;
    return {
      labels: serviceBreakdown.map(e => e.name),
      datasets: [{
        data: serviceBreakdown.map(e => e.revenue),
        backgroundColor: serviceBreakdown.map(e => SERVICE_PALETTE[e.id]?.bg ?? "rgba(148,163,184,0.2)"),
        borderColor: serviceBreakdown.map(e => SERVICE_PALETTE[e.id]?.border ?? "#94a3b8"),
        borderWidth: 1.5,
      }],
    };
  }, [serviceBreakdown]);

  /* ── Section 3: regional scenarios ── */
  const regionalData = useMemo(() => {
    const map = new Map<string, { cities: typeof SP_CITIES; pop: number }>();
    for (const c of selectedCities) {
      const prev = map.get(c.regiao) ?? { cities: [], pop: 0 };
      map.set(c.regiao, { cities: [...prev.cities, c], pop: prev.pop + c.pop });
    }

    const rows = [...map.entries()].map(([regiao, { cities, pop }]) => {
      const realPot = cities.reduce((s, c) => {
        const r = calcCityPotential(c.pop, basePenPct / 100);
        return {
          users: s.users + r.totalUsers,
          consultations: s.consultations + r.monthlyConsultations,
          revenue: s.revenue + r.monthlyRevenue,
        };
      }, { users: 0, consultations: 0, revenue: 0 });

      const reqDocs = Math.max(1, Math.ceil((realPot.consultations * durMedia / 60) / (diasMes * 6)));
      return {
        regiao,
        cityCount: cities.length,
        pop,
        users: realPot.users,
        consultations: realPot.consultations,
        revenue: realPot.revenue,
        reqDocs,
        pes: { revenue: realPot.revenue * 0.4, users: Math.round(realPot.users * 0.4), consultations: Math.round(realPot.consultations * 0.4) },
        real: { revenue: realPot.revenue,       users: realPot.users,                  consultations: realPot.consultations },
        oti:  { revenue: realPot.revenue * 2.0, users: Math.round(realPot.users * 2.0), consultations: Math.round(realPot.consultations * 2.0) },
      };
    });

    switch (sortRegion) {
      case "pop":    return rows.sort((a, b) => b.pop - a.pop);
      case "cities": return rows.sort((a, b) => b.cityCount - a.cityCount);
      default:       return rows.sort((a, b) => b.revenue - a.revenue);
    }
  }, [selectedCities, basePenPct, durMedia, diasMes, sortRegion]);

  const regionalBarData = useMemo(() => {
    if (regionalData.length === 0) return null;
    const labels = regionalData.map(r => r.regiao.length > 14 ? r.regiao.slice(0, 14) + "…" : r.regiao);
    return {
      labels,
      datasets: [
        { label: "Pessimista", data: regionalData.map(r => r.pes.revenue), backgroundColor: "rgba(239,68,68,0.35)", borderColor: "#ef4444", borderWidth: 1.5, stack: "s" },
        { label: "Diferença Realista", data: regionalData.map(r => r.real.revenue - r.pes.revenue), backgroundColor: "rgba(59,130,246,0.35)", borderColor: "#3b82f6", borderWidth: 1.5, stack: "s" },
        { label: "Diferença Otimista", data: regionalData.map(r => r.oti.revenue - r.real.revenue), backgroundColor: "rgba(34,197,94,0.35)", borderColor: "#22c55e", borderWidth: 1.5, stack: "s" },
      ],
    };
  }, [regionalData]);

  /* ── Section 4: top opportunities ── */
  const topOpportunities = useMemo(() => {
    return cityPotentials
      .map(({ city, pot }) => {
        const cfg = getCityConfig(city.pop);
        const revPerCapita = city.pop > 0 ? pot.monthlyRevenue / city.pop : 0;
        const roiScore     = revPerCapita * cfg.competitionFactor * 100;
        const reqDocs      = Math.max(1, Math.ceil((pot.monthlyConsultations * durMedia / 60) / (diasMes * 6)));
        return { city, pot, cfg, revPerCapita, roiScore, reqDocs };
      })
      .sort((a, b) => b.roiScore - a.roiScore)
      .slice(0, 20);
  }, [cityPotentials, durMedia, diasMes]);

  const topOppChartData = useMemo(() => {
    if (topOpportunities.length === 0) return null;
    const labels = topOpportunities.map(o =>
      o.city.name.length > 14 ? o.city.name.slice(0, 14) + "…" : o.city.name,
    );
    return {
      labels,
      datasets: [{
        label: "Receita/mês (R$)",
        data: topOpportunities.map(o => o.pot.monthlyRevenue),
        backgroundColor: topOpportunities.map(o => {
          const tier = getTier(o.city.pop);
          const styles: Record<TierKey, string> = {
            micro:     "rgba(148,163,184,0.35)",
            pequena:   "rgba(59,130,246,0.35)",
            media:     "rgba(34,197,94,0.35)",
            grande:    "rgba(249,115,22,0.35)",
            metropole: "rgba(168,85,247,0.35)",
          };
          return styles[tier];
        }),
        borderColor: topOpportunities.map(o => {
          const tier = getTier(o.city.pop);
          const colors: Record<TierKey, string> = {
            micro: "#94a3b8", pequena: "#3b82f6", media: "#22c55e", grande: "#f97316", metropole: "#a855f7",
          };
          return colors[tier];
        }),
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    };
  }, [topOpportunities]);

  /* ── Section 5: expansion projection ── */
  const expansionSeries = useMemo(
    () => buildExpansionSeries(selectedCities, basePenPct, growthPct),
    [selectedCities, basePenPct, growthPct],
  );

  const expansionChartData = useMemo(() => {
    const labels = expansionSeries.map(p => `M${p.month}`);
    return {
      labels,
      datasets: [
        {
          label: "Pessimista",
          data: expansionSeries.map(p => p.pes),
          borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.06)",
          borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false,
        },
        {
          label: "Realista",
          data: expansionSeries.map(p => p.real),
          borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.08)",
          borderWidth: 2.5, pointRadius: 2, tension: 0.35, fill: "+1",
        },
        {
          label: "Otimista",
          data: expansionSeries.map(p => p.oti),
          borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.06)",
          borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false,
        },
      ],
    };
  }, [expansionSeries]);

  const expansionSummary = useMemo(() => {
    const yr1 = { pes: 0, real: 0, oti: 0 };
    const yr2 = { pes: 0, real: 0, oti: 0 };
    let peakReal = 0;
    for (let i = 0; i < 24; i++) {
      const p = expansionSeries[i];
      if (!p) continue;
      if (i < 12) { yr1.pes += p.pes; yr1.real += p.real; yr1.oti += p.oti; }
      else        { yr2.pes += p.pes; yr2.real += p.real; yr2.oti += p.oti; }
      if (p.real > peakReal) peakReal = p.real;
    }
    return { yr1, yr2, peakReal };
  }, [expansionSeries]);

  const noSelection = selectedCities.length === 0;

  /* ══════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">

      {/* ── SECTION 1: City Selector ── */}
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <SectionHeader
            title="Seletor de Cidades — Potencial de Telemedicina"
            subtitle={`${SP_CITIES.length} municípios · Estado de São Paulo · IBGE Censo 2022 · potencial de telemedicina por cidade`}
            badge="FILTRO"
          />

          {/* Search + region filter */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">🔍</span>
              <input
                type="text"
                placeholder="Buscar cidade... (ex: Campinas)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-secondary/60 border border-border/60 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value as SPRegiao | "Todas")}
              className="bg-secondary/60 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="Todas">Todas as regiões</option>
              {SP_REGIOES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Quick region buttons */}
          <div className="flex flex-wrap gap-1.5">
            {SP_REGIOES.map(r => {
              const sel  = regionSelCount.get(r) ?? 0;
              const tot  = regionTotalCount.get(r) ?? 0;
              const full = sel === tot && tot > 0;
              return (
                <button
                  key={r}
                  onClick={() => full ? deselectRegion(r) : selectRegion(r)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all duration-150 ${
                    full
                      ? "bg-primary/20 text-primary border-primary/40"
                      : sel > 0
                        ? "bg-primary/10 text-primary border-primary/25"
                        : "bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {r} <span className="opacity-60">{sel}/{tot}</span>
                </button>
              );
            })}
          </div>

          {/* Global actions */}
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={selectAll} className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-all">
              Selecionar visíveis ({filteredCities.length})
            </button>
            <button onClick={clearAll} className="text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1.5 rounded-full hover:bg-destructive/20 transition-all">
              Limpar tudo
            </button>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {filteredCities.length} cidades visíveis · {selectedIds.size} selecionadas
            </span>
          </div>

          {/* City grid */}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-border/40 bg-background/30">
            {filteredCities.length === 0 ? (
              <p className="text-center text-muted-foreground text-xs py-10">Nenhuma cidade encontrada</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
                {filteredCities.map(city => {
                  const isSelected = selectedIds.has(city.name);
                  const tier = getTier(city.pop);
                  const ts   = TIER_STYLES[tier];
                  return (
                    <label
                      key={city.name}
                      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-border/20 last:border-b-0 hover:bg-secondary/30 ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(city.name)}
                        className="accent-primary w-3.5 h-3.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium truncate block">{city.name}</span>
                        <span className="text-[9px] text-muted-foreground font-mono">{NL(city.pop)} hab.</span>
                      </div>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${ts.textClass} ${ts.bgClass} ${ts.borderClass}`}>
                        {ts.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection summary */}
          {!noSelection && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-3 pt-1">
              {[
                { label: "Cidades selecionadas", value: NL(selectedCities.length), color: "text-primary" },
                { label: "População total", value: NL(totalPop) + " hab.", color: "text-foreground" },
                { label: "Usuários estimados (telemedicina)", value: NL(totalEstUsers), color: "text-green-400" },
              ].map(item => (
                <div key={item.label} className="bg-secondary/30 rounded-xl p-3 text-center border border-border/40">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{item.label}</p>
                  <p className={`text-sm font-bold font-mono mt-0.5 ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* ── Empty state ── */}
      {noSelection && (
        <Card className="border-border/60">
          <CardContent className="p-12 text-center">
            <span className="text-4xl block mb-3">🗺️</span>
            <h3 className="text-lg font-bold mb-1">Selecione cidades para iniciar a análise de telemedicina</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Use a busca, o filtro de região ou os botões de região acima para selecionar municípios.
              As projeções de teleconsultas por vídeo serão calculadas automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {!noSelection && (
        <>
          {/* ── Penetration slider ── */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Penetração base do mercado endereçável de telemedicina</p>
                <span className="text-sm font-bold font-mono text-primary">{F2(basePenPct)}%</span>
              </div>
              <input
                type="range"
                min={0.05} max={5} step={0.05}
                value={basePenPct}
                onChange={e => setBasePenPct(+e.target.value)}
                className="w-full accent-primary h-1.5 rounded-full"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0,05% (conservador)</span>
                <span>5% (otimista)</span>
              </div>
            </CardContent>
          </Card>

          {/* ── SECTION 2: Potencial por Serviço ── */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <SectionHeader
                title="Potencial por Serviço — Teleconsultas por Vídeo"
                subtitle="Receita mensal estimada de teleconsultas por vídeo, desagregada por tipo de serviço · baseado em probabilidades de desfecho clínico"
                badge="SERVIÇOS"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="Teleconsultas/mês"
                  value={NL(totalMonthlyConsultations)}
                  sub="clínicas + psi (por vídeo)"
                  color="text-primary"
                  delay={0}
                />
                <MetricCard
                  label="Receitas/mês"
                  value={NL(Math.round(totalMonthlyConsultations * (0.55 * 1.3 + 0.12 * 1.1 + 0.03)))}
                  sub="simples + controlada + azul"
                  color="text-yellow-400"
                  delay={0.05}
                />
                <MetricCard
                  label="Exames/mês"
                  value={NL(Math.round(totalMonthlyConsultations * (0.35 * 1.5 + 0.15 * 1.2)))}
                  sub="lab + imagem"
                  color="text-teal-400"
                  delay={0.1}
                />
                <MetricCard
                  label="Receita Total/mês"
                  value={FK(totalMonthlyRevenue)}
                  sub="teleconsultas + serviços derivados"
                  color="text-green-400"
                  delay={0.15}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-2">
                {/* Donut */}
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Composição da Receita — Teleconsultas por Vídeo</p>
                  {serviceDonutData ? (
                    <div className="h-52">
                      <Doughnut
                        data={serviceDonutData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: "65%",
                          plugins: {
                            legend: { position: "right", labels: { color: "#94a3b8", font: { size: 9 }, boxWidth: 10, padding: 8 } },
                            tooltip: {
                              backgroundColor: "rgba(15,23,42,0.95)",
                              titleColor: "#f1f5f9",
                              bodyColor: "#cbd5e1",
                              callbacks: {
                                label: ctx => ` ${FK(ctx.parsed as number)} (${((ctx.parsed as number) / (serviceDonutData.datasets[0].data.reduce((a, b) => a + b, 0) || 1) * 100).toFixed(1)}%)`,
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-10">Nenhuma teleconsulta estimada</p>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        <th className="text-left py-1.5 pr-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Serviço</th>
                        <th className="text-right py-1.5 px-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Preço</th>
                        <th className="text-right py-1.5 px-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Vol/mês</th>
                        <th className="text-right py-1.5 px-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Rec/mês</th>
                        <th className="text-right py-1.5 pl-2 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceBreakdown.map(row => (
                        <tr key={row.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                          <td className="py-1.5 pr-2 text-[10px] font-medium">{row.name}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-[10px] text-muted-foreground">{F2(row.price)}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-[10px]">{NL(row.volume)}</td>
                          <td className="py-1.5 px-2 text-right font-mono text-[10px] text-green-400">{FK(row.revenue)}</td>
                          <td className="py-1.5 pl-2 text-right font-mono text-[10px] text-muted-foreground">{row.pct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border/60">
                        <td colSpan={3} className="py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</td>
                        <td className="py-2 text-right font-mono text-sm font-bold text-green-400">{FK(serviceBreakdown.reduce((s, r) => s + r.revenue, 0))}</td>
                        <td className="py-2 text-right font-mono text-[10px] text-muted-foreground">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── SECTION 3: Cenários por Região ── */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <SectionHeader
                  title="Cenários Regionais de Telemedicina"
                  subtitle="Projeções de expansão de telemedicina: pessimista (×0,4) · realista (×1,0) · otimista (×2,0) por macro-região"
                  badge="REGIONAL"
                />
                <div className="flex gap-1.5">
                  {(["rev", "pop", "cities"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSortRegion(s)}
                      className={`text-[9px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                        sortRegion === s
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary"
                      }`}
                    >
                      {s === "rev" ? "Receita" : s === "pop" ? "Pop." : "Cidades"}
                    </button>
                  ))}
                </div>
              </div>

              {regionalBarData ? (
                <div className="h-52">
                  <Bar
                    data={regionalBarData}
                    options={{
                      ...CHART_BASE,
                      indexAxis: "y" as const,
                      plugins: {
                        ...CHART_BASE.plugins,
                        tooltip: {
                          ...CHART_BASE.plugins.tooltip,
                          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${FK(ctx.parsed.x ?? 0)}` },
                        },
                      },
                      scales: {
                        x: {
                          ...CHART_BASE.scales.x,
                          stacked: true,
                          title: { display: true, text: "Receita mensal (R$)", color: "#64748b", font: { size: 9 } },
                          ticks: { ...CHART_BASE.scales.x.ticks, callback: (v) => FK(v as number) },
                        },
                        y: {
                          ...CHART_BASE.scales.y,
                          stacked: true,
                          title: { display: true, text: "Região", color: "#64748b", font: { size: 9 } },
                        },
                      },
                    }}
                  />
                </div>
              ) : null}

              {/* Region table */}
              <div className="overflow-x-auto rounded-xl border border-border/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/30 border-b border-border/40">
                      <th className="text-left py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Região</th>
                      <th className="text-right py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cid.</th>
                      <th className="text-right py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Pop.</th>
                      <th className="text-right py-2 px-3 text-[9px] text-red-400 uppercase tracking-wider font-semibold">Pessimista</th>
                      <th className="text-right py-2 px-3 text-[9px] text-blue-400 uppercase tracking-wider font-semibold">Realista</th>
                      <th className="text-right py-2 px-3 text-[9px] text-green-400 uppercase tracking-wider font-semibold">Otimista</th>
                      <th className="text-right py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Médicos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionalData.map(row => (
                      <tr key={row.regiao} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                        <td className="py-2 px-3 font-medium text-[10px]">{row.regiao}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-muted-foreground">{row.cityCount}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px]">{NL(row.pop)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-red-400">{FK(row.pes.revenue)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-blue-400">{FK(row.real.revenue)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-green-400">{FK(row.oti.revenue)}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px]">{row.reqDocs}</td>
                      </tr>
                    ))}
                    {regionalData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">Nenhuma região com cidades selecionadas para análise de telemedicina</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── SECTION 4: Top Oportunidades ── */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <SectionHeader
                title="Top Oportunidades — Telemedicina"
                subtitle="Top 20 cidades por ROI estimado em teleconsultas por vídeo · score = receita per capita × fator de baixa competição"
                badge="RANKING"
              />

              {topOpportunities.length === 0 ? (
                <p className="text-center text-muted-foreground text-xs py-8">Nenhuma cidade selecionada</p>
              ) : (
                <>
                  {topOppChartData && (
                    <>
                      {/* Tier color legend for the bar chart */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(
                          [
                            { key: "micro"     as TierKey, color: "#94a3b8" },
                            { key: "pequena"   as TierKey, color: "#3b82f6" },
                            { key: "media"     as TierKey, color: "#22c55e" },
                            { key: "grande"    as TierKey, color: "#f97316" },
                            { key: "metropole" as TierKey, color: "#a855f7" },
                          ]
                        ).map(({ key, color }) => (
                          <span key={key} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                            {TIER_STYLES[key].label}
                          </span>
                        ))}
                      </div>
                      <div className="h-56">
                        <Bar
                          data={topOppChartData}
                          options={{
                            ...CHART_BASE,
                            indexAxis: "y" as const,
                            plugins: {
                              ...CHART_BASE.plugins,
                              legend: { display: false },
                              tooltip: {
                                ...CHART_BASE.plugins.tooltip,
                                callbacks: { label: ctx => ` Receita/mês: ${FK(ctx.parsed.x ?? 0)}` },
                              },
                            },
                            scales: {
                              x: {
                                ...CHART_BASE.scales.x,
                                title: { display: true, text: "Receita mensal (R$)", color: "#64748b", font: { size: 9 } },
                                ticks: { ...CHART_BASE.scales.x.ticks, callback: (v) => FK(v as number) },
                              },
                              y: {
                                ...CHART_BASE.scales.y,
                                title: { display: true, text: "Cidade", color: "#64748b", font: { size: 9 } },
                              },
                            },
                          }}
                        />
                      </div>
                    </>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/30 border-b border-border/40">
                          <th className="text-left py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">#</th>
                          <th className="text-left py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Cidade</th>
                          <th className="text-left py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Porte</th>
                          <th className="text-right py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Pop.</th>
                          <th className="text-right py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Usuários</th>
                          <th className="text-right py-2 px-3 text-[9px] text-green-400 uppercase tracking-wider font-semibold">Rec./mês</th>
                          <th className="text-right py-2 px-3 text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Médicos</th>
                          <th className="text-right py-2 px-3 text-[9px] text-yellow-400 uppercase tracking-wider font-semibold">R$/hab.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topOpportunities.map((opp, i) => {
                          const tier = getTier(opp.city.pop);
                          const ts   = TIER_STYLES[tier];
                          return (
                            <tr
                              key={opp.city.name}
                              className={`border-b border-border/20 hover:bg-secondary/20 transition-colors ${i < 3 ? "bg-primary/[0.02]" : ""}`}
                            >
                              <td className="py-2 px-3 text-[10px] font-bold text-muted-foreground">
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                              </td>
                              <td className="py-2 px-3 font-medium text-[10px]">{opp.city.name}</td>
                              <td className="py-2 px-3">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${ts.textClass} ${ts.bgClass} ${ts.borderClass}`}>
                                  {ts.label}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-[10px]">{NL(opp.city.pop)}</td>
                              <td className="py-2 px-3 text-right font-mono text-[10px] text-primary">{NL(opp.pot.totalUsers)}</td>
                              <td className="py-2 px-3 text-right font-mono text-[10px] text-green-400">{FK(opp.pot.monthlyRevenue)}</td>
                              <td className="py-2 px-3 text-right font-mono text-[10px]">{opp.reqDocs}</td>
                              <td className="py-2 px-3 text-right font-mono text-[10px] text-yellow-400">
                                {opp.revPerCapita < 0.01 ? "< R$ 0,01" : `R$ ${F2(opp.revPerCapita)}`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── SECTION 5: Projeção de Expansão ── */}
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <SectionHeader
                title="Projeção de Expansão da Telemedicina — 24 meses"
                subtitle="Receita mensal de teleconsultas por vídeo nas cidades selecionadas · 3 cenários · crescimento composto"
                badge="PROJEÇÃO"
              />

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card/80 border border-border/60 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="exp-pen-slider" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Penetração base
                    </label>
                    <span className="text-sm font-bold font-mono text-primary">{F2(basePenPct)}%</span>
                  </div>
                  <input
                    id="exp-pen-slider"
                    type="range" min={0.05} max={5} step={0.05}
                    value={basePenPct}
                    onChange={e => setBasePenPct(+e.target.value)}
                    className="w-full accent-primary h-1.5 rounded-full"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>0,05%</span><span>5%</span>
                  </div>
                </div>

                <div className="bg-card/80 border border-border/60 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="exp-growth-slider" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Crescimento mensal
                    </label>
                    <span className="text-sm font-bold font-mono text-orange-400">{F2(growthPct)}%/mês</span>
                  </div>
                  <input
                    id="exp-growth-slider"
                    type="range" min={0} max={20} step={0.5}
                    value={growthPct}
                    onChange={e => setGrowthPct(+e.target.value)}
                    className="w-full accent-primary h-1.5 rounded-full"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>0%</span><span>20%/mês</span>
                  </div>
                </div>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <MetricCard
                  label="Receita Ano 1 — Teleconsultas (realista)"
                  value={FK(expansionSummary.yr1.real)}
                  sub={`Pessimista: ${FK(expansionSummary.yr1.pes)} · Oti: ${FK(expansionSummary.yr1.oti)}`}
                  color="text-blue-400"
                  delay={0}
                />
                <MetricCard
                  label="Receita Ano 2 — Teleconsultas (realista)"
                  value={FK(expansionSummary.yr2.real)}
                  sub={`Pessimista: ${FK(expansionSummary.yr2.pes)} · Oti: ${FK(expansionSummary.yr2.oti)}`}
                  color="text-primary"
                  delay={0.05}
                />
                <MetricCard
                  label="Pico mensal (realista)"
                  value={FK(expansionSummary.peakReal)}
                  sub="mês 24 · cenário realista"
                  color="text-green-400"
                  delay={0.1}
                />
              </div>

              {/* Line chart */}
              <div className="h-64">
                <Line
                  data={expansionChartData}
                  options={{
                    ...CHART_BASE,
                    plugins: {
                      ...CHART_BASE.plugins,
                      tooltip: {
                        ...CHART_BASE.plugins.tooltip,
                        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${FK(ctx.parsed.y ?? 0)}` },
                      },
                    },
                    scales: {
                      x: {
                        ...CHART_BASE.scales.x,
                        title: { display: true, text: "Mês", color: "#64748b", font: { size: 9 } },
                      },
                      y: {
                        ...CHART_BASE.scales.y,
                        title: { display: true, text: "Receita mensal (R$)", color: "#64748b", font: { size: 9 } },
                        ticks: { ...CHART_BASE.scales.y.ticks, callback: (v) => FK(v as number) },
                      },
                    },
                  }}
                />
              </div>

              {/* Breakeven note */}
              {expansionSeries.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {(["pes", "real", "oti"] as const).map(sc => {
                    const colors = { pes: "text-red-400", real: "text-blue-400", oti: "text-green-400" };
                    const labels = { pes: "Pessimista", real: "Realista", oti: "Otimista" };
                    const maxRevAtM1 = expansionSeries[0]?.[sc] ?? 0;
                    // Flag month where revenue first exceeds month-1 by 2× (a simple "traction point")
                    const inflectMonth = expansionSeries.findIndex((p, i) => i > 0 && p[sc] >= maxRevAtM1 * 2) + 1;
                    return (
                      <div key={sc} className={`text-[10px] ${colors[sc]} bg-secondary/30 border border-border/40 rounded-full px-3 py-1.5 font-mono`}>
                        {labels[sc]}: 2× tração {inflectMonth > 0 ? `mês ${inflectMonth}` : "além de M24"}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Tier legend ── */}
      <div className="flex flex-wrap gap-2 justify-end">
        {(
          [
            { key: "micro"     as TierKey, threshold: "< 10 mil" },
            { key: "pequena"   as TierKey, threshold: "10–50 mil" },
            { key: "media"     as TierKey, threshold: "50–200 mil" },
            { key: "grande"    as TierKey, threshold: "200–500 mil" },
            { key: "metropole" as TierKey, threshold: "> 500 mil" },
          ]
        ).map(({ key, threshold }) => {
          const ts = TIER_STYLES[key];
          return (
            <span key={key} className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${ts.textClass} ${ts.bgClass} ${ts.borderClass}`}>
              {ts.label} ({threshold})
            </span>
          );
        })}
        <span className="text-[9px] text-muted-foreground self-center">Porte por faixa populacional · adoção de telemedicina varia por porte</span>
      </div>
    </div>
  );
}

export default CidadePotencialTab;
