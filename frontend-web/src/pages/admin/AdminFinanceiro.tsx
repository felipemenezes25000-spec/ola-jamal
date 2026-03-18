import { useState, useCallback, useEffect, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

/* ─── Constants ─── */
const MXH = 12;
const IA = 5;
const TX = 0.0099 * 0.7 + 0.0498 * 0.3;

function infraCosts(p: number) {
  let fixo: number, vPC: number, sPC: number, fase: string;
  if (p <= 1500) { fixo = 1129; vPC = 0.35; sPC = 0.15; fase = "Fase 1"; }
  else if (p <= 12e3) { const t = (p - 1500) / 10500; fixo = 1129 + t * 1171; vPC = 0.35 + t * 0.05; sPC = 0.15 + t * 0.05; fase = "Fase 1→2"; }
  else if (p <= 6e4) { const t = (p - 12e3) / 48e3; fixo = 2300 + t * 3200; vPC = 0.4 + t * 0.1; sPC = 0.2 + t * 0.1; fase = "Fase 2→3"; }
  else if (p <= 25e4) { const t = Math.min(1, (p - 6e4) / 19e4); fixo = 5500 + t * 6500; vPC = 0.5 + t * 0.1; sPC = 0.3 + t * 0.15; fase = "Fase 3→4"; }
  else { fixo = 12e3 + Math.floor((p - 25e4) / 1e5) * 3e3; vPC = 0.6; sPC = 0.45; fase = "Fase 4+"; }
  return { fixo: Math.round(fixo), vPC, sPC, fase };
}

function fullCost(pes: number, val: number, med: number, docs: number, dur: number, dias: number) {
  const cap = Math.floor(MXH * 60 / dur);
  const dn = Math.max(docs, Math.ceil(Math.ceil(pes / dias) / cap));
  const inf = infraCosts(pes);
  const cM = med * dn * dias, cIF = inf.fixo, cIA = IA * pes, cS = inf.sPC * pes, cIV = inf.vPC * pes, cTx = val * TX * pes;
  const cT = cM + cIF + cIA + cS + cIV + cTx;
  const rec = val * pes, rL = val * (1 - TX) * pes;
  const res = rL - cIA - cS - cIV - cM - cIF;
  return { cM, cIF, cIA, cS, cIV, cTx, cT, rec, rL, res, dn, fase: inf.fase, inf, cap };
}

/* ─── Formatters ─── */
const FK = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "- " : "";
  if (a >= 1e6) return s + "R$ " + (a / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return s + "R$ " + (a / 1e3).toFixed(1) + "K";
  return s + "R$ " + Math.round(a).toLocaleString("pt-BR");
};
const F2 = (v: number) => v.toFixed(2).replace(".", ",");
const NL = (v: number) => Math.round(v).toLocaleString("pt-BR");

function stp(mx: number): [number, number] {
  if (mx <= 200) return [5, 2]; if (mx <= 1e3) return [20, 10]; if (mx <= 5e3) return [100, 50];
  if (mx <= 2e4) return [500, 200]; if (mx <= 1e5) return [2e3, 1e3]; if (mx <= 5e5) return [1e4, 5e3];
  return [5e4, 2e4];
}

/* ─── Reusable Components ─── */
function Slider({ label, tag, value, onChange, min, max, step = 1, icon }: {
  label: string; tag?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; icon?: string;
}) {
  const [effectiveMax, setEffectiveMax] = useState(max);
  useEffect(() => {
    if (value > effectiveMax) queueMicrotask(() => setEffectiveMax(Math.ceil(value * 1.3)));
  }, [value, effectiveMax]);
  return (
    <div className="bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl p-3 hover:border-primary/30 transition-all duration-200">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
        {icon && <span className="text-sm">{icon}</span>}
        {label}
        {tag && <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full normal-case tracking-normal font-medium">{tag}</span>}
      </label>
      <div className="flex items-center gap-2">
        <input type="range" className="flex-1 accent-primary h-1.5 rounded-full" min={min} max={effectiveMax} step={step}
          value={Math.min(value, effectiveMax)} onChange={e => onChange(+e.target.value)} />
        <input type="number" className="w-20 bg-secondary/80 border border-border/60 rounded-lg px-2 py-1.5 text-right text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          value={value} min={min} onChange={e => onChange(+e.target.value || 0)} />
      </div>
    </div>
  );
}

function Metric({ label, value, sub, color = "text-foreground", delay = 0, icon }: {
  label: string; value: string; sub: string; color?: string; delay?: number; icon?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.3 }}>
      <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden group">
        <CardContent className="p-4 text-center relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          {icon && <span className="text-lg mb-1 block">{icon}</span>}
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</p>
          <p className="text-[9px] text-muted-foreground/80 mt-0.5">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

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

function TabButton({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
          : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${active ? "bg-primary-foreground/20" : "bg-border"}`}>{count}</span>
      )}
    </button>
  );
}

/* ─── Shared Types ─── */
type SimProps = { val: number; pes: number; med: number; docs: number; dur: number; dias: number };
type ModelRow = {
  id: string; name: string; tipo: "SUS" | "Privado"; perConsulta: number; recMes: number;
  color: string; borderColor: string; bgColor: string;
  desc: string; pros: string[]; contras: string[];
  score: number; // 0-100 viability score
};

/* ─── Main Page ─── */
const AdminFinanceiro = () => {
  const [ad, setAd] = useState(46);
  const [dias, setDias] = useState(22);
  const [pes, setPes] = useState(46 * 22);
  const [val, setVal] = useState(25);
  const [med, setMed] = useState(1400);
  const [docs, setDocs] = useState(1);
  const [dur, setDur] = useState(15);
  const [activeTab, setActiveTab] = useState<"visao" | "modelos" | "analise">("visao");

  const setADSync = useCallback((v: number) => { setAd(v); setPes(v * dias); }, [dias]);
  const setPesSync = useCallback((v: number) => { setPes(v); setAd(Math.round(v / dias)); }, [dias]);
  const setDiasSync = useCallback((v: number) => { setDias(v); setPes(ad * v); }, [ad]);

  const r = fullCost(pes, val, med, docs, dur, dias);
  const inf = r.inf;
  const capM = r.cap * docs * dias;
  const cvP = IA + inf.vPC + inf.sPC;
  const ruP = val * (1 - TX);
  const mgP = ruP - cvP;
  const cfBE = med * r.dn * dias + inf.fixo;
  const bm = mgP > 0 ? Math.ceil(cfBE / mgP) : Infinity;
  const bc = bm === Infinity ? "impossivel" : NL(bm);
  const gsm = r.cIA + r.cS + r.cIF + r.cIV + r.cTx;
  const docsForBE = bm === Infinity ? "---" : String(Math.ceil(bm / (r.cap * dias)));

  return (
    <AdminLayout>
      <div className="space-y-6 pb-8">
        {/* Hero Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-border/60 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(var(--primary-rgb,99,102,241),0.12),transparent)]" />
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight">Simulador Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">Plataforma de analise e decisao de contratos — modelos SUS & privado em tempo real</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <div className="flex items-center gap-1.5 bg-card/80 border border-border/60 rounded-full px-3 py-1.5">
                <span className={`w-2 h-2 rounded-full ${r.res >= 0 ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                <span className="text-[10px] font-semibold">{r.res >= 0 ? "Lucrativo" : "Deficitario"}</span>
                <span className={`text-xs font-bold font-mono ${r.res >= 0 ? "text-green-400" : "text-destructive"}`}>{FK(r.res)}/mes</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/80 border border-border/60 rounded-full px-3 py-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground">Breakeven</span>
                <span className="text-xs font-bold font-mono text-warning">{bc}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-card/80 border border-border/60 rounded-full px-3 py-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground">Infra</span>
                <span className="text-xs font-bold font-mono text-blue-400">{inf.fase}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" /> Parametros de Receita
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Slider icon="📊" label="Atendimentos/dia" value={ad} onChange={setADSync} min={1} max={5000} />
                <Slider icon="👥" label="Pessoas/mes" value={pes} onChange={setPesSync} min={1} max={9999999} step={10} />
                <Slider icon="💰" label="Valor atendimento (R$)" value={val} onChange={v => setVal(v)} min={1} max={500} />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1 h-4 bg-primary rounded-full" /> Parametros Operacionais
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Slider icon="🩺" label="Custo diario/medico (R$)" value={med} onChange={v => setMed(v)} min={100} max={20000} step={50} />
                <Slider icon="👨‍⚕️" label="Qtd medicos" value={docs} onChange={v => setDocs(v)} min={1} max={500} />
                <Slider icon="📅" label="Dias trabalhados/mes" tag="editavel" value={dias} onChange={setDiasSync} min={1} max={31} />
                <Slider icon="⏱️" label="Duracao consulta (min)" value={dur} onChange={v => setDur(v)} min={5} max={60} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {pes > capM && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-destructive/10 border border-destructive/30 text-destructive rounded-xl p-4 text-sm flex items-start gap-3">
            <span className="text-lg mt-0.5">⚠️</span>
            <div><b>Capacidade excedida:</b> {docs} medico(s) x {r.cap}/dia x {dias}d = {NL(capM)} max. Precisa de <b>{r.dn} medicos</b>.</div>
          </motion.div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 flex-wrap">
          <TabButton active={activeTab === "visao"} onClick={() => setActiveTab("visao")}>Visao Geral</TabButton>
          <TabButton active={activeTab === "modelos"} onClick={() => setActiveTab("modelos")} count={11}>Modelos de Cobranca</TabButton>
          <TabButton active={activeTab === "analise"} onClick={() => setActiveTab("analise")}>Analise Avancada</TabButton>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "visao" && (
            <motion.div key="visao" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <VisaoGeralTab val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} r={r} inf={inf} capM={capM} bc={bc} gsm={gsm} mgP={mgP} docsForBE={docsForBE} bm={bm} />
            </motion.div>
          )}
          {activeTab === "modelos" && (
            <motion.div key="modelos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <PricingModelsTab val={val} dur={dur} pes={pes} />
            </motion.div>
          )}
          {activeTab === "analise" && (
            <motion.div key="analise" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
              <AnaliseAvancadaTab val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} r={r} mgP={mgP} bm={bm} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
};

/* ═══════════════════════════════════════════════════════════════
   TAB 1 — Visao Geral
   ═══════════════════════════════════════════════════════════════ */
type VisaoProps = SimProps & {
  r: ReturnType<typeof fullCost>; inf: ReturnType<typeof infraCosts>;
  capM: number; bc: string; gsm: number; mgP: number; docsForBE: string; bm: number;
};

function VisaoGeralTab({ val, pes, med, docs, dur, dias, r, inf, capM, bc, gsm, mgP, docsForBE, bm }: VisaoProps) {
  const mxP = Math.max(pes * 2.5, bm === Infinity ? 2e3 : bm * 2, 500);
  const [st, st2] = stp(mxP);

  const beLabels: number[] = [], beRec: number[] = [], beCst: number[] = [];
  for (let p = 0; p <= mxP; p += st) {
    const x = fullCost(p, val, med, docs, dur, dias);
    beLabels.push(p); beRec.push(Math.round(x.rL)); beCst.push(Math.round(x.cM + x.cIF + x.cIA + x.cS + x.cIV));
  }
  const resLabels: number[] = [], resData: number[] = [], resBg: string[] = [];
  for (let p = st2; p <= mxP; p += st2) {
    const x = fullCost(p, val, med, docs, dur, dias);
    resLabels.push(p); resData.push(Math.round(x.res));
    resBg.push(x.res >= 0 ? "rgba(74,222,128,.6)" : "rgba(248,113,113,.6)");
  }
  const sLabels: number[] = [], sM: number[] = [], sIA: number[] = [], sInf: number[] = [], sSt: number[] = [];
  for (let p = st; p <= mxP; p += st) {
    const x = fullCost(p, val, med, docs, dur, dias);
    sLabels.push(p); sM.push(x.cM); sIA.push(x.cIA); sInf.push(x.cIF + x.cIV); sSt.push(x.cS);
  }

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,.04)" },
        ticks: { color: "#71717a", font: { size: 9 }, maxTicksLimit: 12,
          callback: (v: number | string) => { const n = Number(v); return n >= 1e6 ? (n / 1e6) + "M" : n >= 1e3 ? (n / 1e3) + "K" : String(n); } },
      },
      y: {
        grid: { color: "rgba(255,255,255,.04)" },
        ticks: { color: "#71717a", font: { size: 9 }, callback: (v: number | string) => FK(Number(v)) },
      },
    },
  };

  const scaleRows = [50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5].filter(f => f <= mxP);

  return (
    <>
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Metric icon="📊" label="Atendimentos/dia" value={NL(Math.round(pes / dias))} sub={`${NL(pes)} pessoas/mes`} color="text-primary" delay={0} />
        <Metric icon="💵" label="Receita bruta" value={FK(r.rec)} sub="faturamento mensal" color="text-blue-400" delay={0.05} />
        <Metric icon="📉" label="Custo total" value={FK(r.cT)} sub="medicos+IA+infra+taxas" color="text-destructive" delay={0.1} />
        <Metric icon={r.res >= 0 ? "✅" : "🔴"} label="Resultado" value={FK(r.res)} sub={r.res >= 0 ? "lucro mensal" : "prejuizo mensal"} color={r.res >= 0 ? "text-green-400" : "text-destructive"} delay={0.15} />
        <Metric icon="🎯" label="Breakeven" value={bc} sub={`${docsForBE} medico(s) necessarios`} color="text-warning" delay={0.2} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Capacidade max" value={NL(capM)} sub={`${r.dn} med x ${r.cap}/d x ${dias}d`} color="text-primary" delay={0} />
        <Metric label="Gastos s/ medico" value={FK(gsm)} sub={`IA ${FK(r.cIA)} + infra ${FK(r.cIF + r.cIV)}`} color="text-pink-400" delay={0.05} />
        <Metric label="Infra AWS" value={FK(inf.fixo + (inf.vPC + inf.sPC) * pes)} sub={inf.fase} color="text-blue-400" delay={0.1} />
        <Metric label="Margem/pessoa" value={"R$ " + F2(mgP)} sub="acima do breakeven" color={mgP >= 0 ? "text-green-400" : "text-destructive"} delay={0.15} />
      </div>

      {/* Profit zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {[
          { color: "destructive", icon: "🔴", label: "Prejuizo", desc: `menos de ${bc} pessoas/mes` },
          { color: "warning", icon: "🟡", label: "Breakeven", desc: `~${bc} pac/mes | ${docsForBE} medico(s)` },
          { color: "green-400", icon: "🟢", label: "Lucro", desc: `acima de ${bc} | margem R$ ${F2(mgP)}/pac` },
        ].map(z => (
          <div key={z.label} className={`bg-${z.color === "destructive" ? "destructive" : z.color === "warning" ? "warning" : "green-500"}/5 border border-${z.color === "destructive" ? "destructive" : z.color === "warning" ? "warning" : "green-500"}/15 rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2.5`}>
            <span>{z.icon}</span>
            <div>
              <span className="font-bold">{z.label}</span>
              <span className="text-muted-foreground ml-1.5">{z.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-semibold mb-1">Ponto de Equilibrio</p>
            <p className="text-[10px] text-muted-foreground mb-3">Receita liquida vs custo total por volume</p>
            <div className="h-64">
              <Line data={{
                labels: beLabels,
                datasets: [
                  { label: "Receita liquida", data: beRec, borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.06)", fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
                  { label: "Custo total", data: beCst, borderColor: "#f87171", backgroundColor: "rgba(248,113,113,.06)", fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
                ],
              }} options={{ ...chartOpts, plugins: { legend: { display: true, position: "bottom" as const, labels: { color: "#71717a", usePointStyle: true, padding: 12, font: { size: 10 } } } } }} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-semibold mb-1">Resultado Mensal</p>
            <p className="text-[10px] text-muted-foreground mb-3">Lucro ou prejuizo por volume de atendimentos</p>
            <div className="h-64">
              <Bar data={{ labels: resLabels, datasets: [{ data: resData, backgroundColor: resBg, borderRadius: 4 }] }} options={chartOpts} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-semibold mb-1">Composicao de Custos</p>
            <p className="text-[10px] text-muted-foreground mb-3">Empilhamento por categoria e volume</p>
            <div className="h-64">
              <Bar data={{
                labels: sLabels,
                datasets: [
                  { label: "Medicos", data: sM, backgroundColor: "#f87171", borderRadius: 2 },
                  { label: "IA", data: sIA, backgroundColor: "#fbbf24", borderRadius: 2 },
                  { label: "Infra", data: sInf, backgroundColor: "#60a5fa", borderRadius: 2 },
                  { label: "Storage", data: sSt, backgroundColor: "#c084fc", borderRadius: 2 },
                ],
              }} options={{
                ...chartOpts,
                plugins: { legend: { display: true, position: "bottom" as const, labels: { color: "#71717a", usePointStyle: true, padding: 10, font: { size: 9 } } } },
                scales: { x: { ...chartOpts.scales.x, stacked: true }, y: { ...chartOpts.scales.y, stacked: true } },
              }} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-semibold mb-1">Custo IA por Consulta</p>
            <p className="text-[10px] text-muted-foreground mb-3">Decomposicao do custo de R$5/atendimento</p>
            <div className="h-64">
              <Doughnut data={{
                labels: ["Deepgram R$2,90", "Anamnese R$1,10", "CIDs R$0,55", "Resumo R$0,45", "Infra R$0,82"],
                datasets: [{ data: [2.9, 1.1, 0.55, 0.45, 0.82], backgroundColor: ["#f87171", "#fbbf24", "#4ade80", "#60a5fa", "#71717a"], borderWidth: 0, hoverOffset: 8 }],
              }} options={{ responsive: true, maintainAspectRatio: false, cutout: "60%", plugins: { legend: { position: "right" as const, labels: { color: "#a1a1aa", padding: 10, usePointStyle: true, font: { size: 10 } } } } }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scale Table */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionHeader title="Projecao de Escala" subtitle="Medicos, infraestrutura e resultado por volume de atendimento" />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-border">
                  {["Pessoas/mes", "Por dia", "Medicos", "Fase", "Custo med", "Custo IA", "Infra+stor", "Total", "Receita", "Resultado", "Margem"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-muted-foreground font-semibold uppercase text-[9px] tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scaleRows.map((p, i) => {
                  const x = fullCost(p, val, med, docs, dur, dias);
                  const mg = x.rec > 0 ? (x.res / x.rec * 100) : 0;
                  const isActive = p === scaleRows.reduce((prev, curr) => Math.abs(curr - pes) < Math.abs(prev - pes) ? curr : prev, scaleRows[0]);
                  const cls = x.res < -500 ? "text-destructive" : x.res > 500 ? "text-green-400" : "text-warning";
                  return (
                    <tr key={p} className={`border-b border-border/40 hover:bg-secondary/40 transition-colors ${isActive ? "bg-primary/5 border-primary/20" : i % 2 === 0 ? "bg-secondary/10" : ""}`}>
                      <td className="px-3 py-2 font-mono font-semibold">{NL(p)}{isActive && <span className="ml-1 text-[8px] text-primary font-bold">ATUAL</span>}</td>
                      <td className="px-3 py-2 font-mono">{NL(Math.ceil(p / dias))}</td>
                      <td className="px-3 py-2 font-semibold">{x.dn}</td>
                      <td className="px-3 py-2 text-muted-foreground">{x.fase}</td>
                      <td className="px-3 py-2 font-mono">{FK(x.cM)}</td>
                      <td className="px-3 py-2 font-mono">{FK(x.cIA)}</td>
                      <td className="px-3 py-2 font-mono">{FK(x.cIF + x.cIV + x.cS)}</td>
                      <td className="px-3 py-2 font-mono">{FK(x.cT)}</td>
                      <td className="px-3 py-2 font-mono">{FK(x.rec)}</td>
                      <td className={`px-3 py-2 font-mono font-bold ${cls}`}>{FK(x.res)}</td>
                      <td className={`px-3 py-2 font-mono font-semibold ${cls}`}>{mg.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 2 — Modelos de Cobranca (SUS + Privado)
   ═══════════════════════════════════════════════════════════════ */
function PricingModelsTab({ val, dur, pes }: Pick<SimProps, 'val' | 'dur' | 'pes'>) {
  const [filter, setFilter] = useState<"todos" | "privado" | "sus">("todos");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Privado states
  const [valMin, setValMin] = useState(6.99);
  const [valMensal, setValMensal] = useState(89.9);
  const [assinMensal, setAssinMensal] = useState(500);
  const [valAnual, setValAnual] = useState(599);
  const [assinAnual, setAssinAnual] = useState(200);
  const [valConvenio, setValConvenio] = useState(18.5);
  const [glosa, setGlosa] = useState(12);
  const [valPacote, setValPacote] = useState(79.9);
  const [consultasPacote, setConsultasPacote] = useState(3);
  const [freemiumConv, setFreemiumConv] = useState(5);
  const [valPremium, setValPremium] = useState(39.9);

  // SUS states
  const [susTeleconsulta, setSusTeleconsulta] = useState(21.43);
  const [susPercRepasse, setSusPercRepasse] = useState(100);
  const [susPsfEquipes, setSusPsfEquipes] = useState(10);
  const [susPsfPerCapita, setSusPsfPerCapita] = useState(4.5);
  const [susPsfPopulacao, setSusPsfPopulacao] = useState(3500);
  const [susMacValor, setSusMacValor] = useState(85);
  const [susMacQtd, setSusMacQtd] = useState(50);
  const [susNasfEquipes, setSusNasfEquipes] = useState(3);
  const [susNasfValor, setSusNasfValor] = useState(8000);

  const refRecMes = val * pes;

  // Privado calcs
  const perMinConsulta = valMin * dur;
  const perMinMes = perMinConsulta * pes;
  const mensalRecMes = assinMensal * valMensal;
  const mensalPerConsulta = pes > 0 ? mensalRecMes / pes : 0;
  const anualRecMes = assinAnual * valAnual / 12;
  const anualPerConsulta = pes > 0 ? anualRecMes / pes : 0;
  const convenioLiq = valConvenio * (1 - glosa / 100);
  const convenioMes = convenioLiq * pes;
  const pacotePerConsulta = consultasPacote > 0 ? valPacote / consultasPacote : 0;
  const pacoteMes = pacotePerConsulta * pes;
  const freemiumPagantes = Math.round(pes * freemiumConv / 100);
  const freemiumMes = freemiumPagantes * valPremium;
  const freemiumPerConsulta = pes > 0 ? freemiumMes / pes : 0;

  // SUS calcs
  const susTelemedicinaMes = susTeleconsulta * (susPercRepasse / 100) * pes;
  const susPsfMes = susPsfEquipes * susPsfPerCapita * susPsfPopulacao;
  const susPsfPerConsulta = pes > 0 ? susPsfMes / pes : 0;
  const susMacMes = susMacValor * susMacQtd;
  const susMacPerConsulta = susMacQtd > 0 ? susMacValor : 0;
  const susNasfMes = susNasfEquipes * susNasfValor;
  const susNasfPerConsulta = pes > 0 ? susNasfMes / pes : 0;

  const models: ModelRow[] = useMemo(() => {
  const calcScore = (recMes: number, predictable: boolean, scalable: boolean) => {
    const revScore = Math.min(40, (recMes / Math.max(refRecMes, 1)) * 30);
    const predScore = predictable ? 30 : 10;
    const scaleScore = scalable ? 30 : 15;
    return Math.min(100, Math.round(revScore + predScore + scaleScore));
  };
  return [
    { id: "fixo", name: "Fixo por Consulta", tipo: "Privado", perConsulta: val, recMes: refRecMes,
      color: "text-primary", borderColor: "border-primary/30", bgColor: "bg-primary/5",
      desc: "Valor fixo por atendimento. Modelo atual da plataforma.",
      pros: ["Simples de implementar", "Previsibilidade para o paciente", "Facil de calcular"],
      contras: ["Receita limitada por volume", "Nao diferencia complexidade", "Sem receita recorrente"],
      score: calcScore(refRecMes, false, true) },
    { id: "minuto", name: "Por Minuto", tipo: "Privado", perConsulta: perMinConsulta, recMes: perMinMes,
      color: "text-green-400", borderColor: "border-green-400/30", bgColor: "bg-green-400/5",
      desc: "Cobranca proporcional ao tempo de consulta. Justo para ambas as partes.",
      pros: ["Justo para paciente e medico", "Incentiva eficiencia", "Margem em consultas longas"],
      contras: ["Imprevisivel para paciente", "Pode gerar pressa no atendimento", "Complexo de faturar"],
      score: calcScore(perMinMes, false, true) },
    { id: "mensal", name: "Assinatura Mensal", tipo: "Privado", perConsulta: mensalPerConsulta, recMes: mensalRecMes,
      color: "text-purple-400", borderColor: "border-purple-400/30", bgColor: "bg-purple-400/5",
      desc: "Plano mensal com consultas ilimitadas ou limitadas. Receita recorrente previsivel.",
      pros: ["Receita recorrente (MRR)", "Alto LTV", "Fidelizacao do paciente"],
      contras: ["Risco de uso excessivo", "Churn se nao usar", "Necessita boa retencao"],
      score: calcScore(mensalRecMes, true, true) },
    { id: "anual", name: "Assinatura Anual", tipo: "Privado", perConsulta: anualPerConsulta, recMes: anualRecMes,
      color: "text-blue-400", borderColor: "border-blue-400/30", bgColor: "bg-blue-400/5",
      desc: "Plano anual com desconto. Receita antecipada e previsivel.",
      pros: ["Receita antecipada", "Churn reduzido", "Desconto atrai clientes"],
      contras: ["Barreira de entrada alta", "Reembolso complexo", "Dificuldade de reajuste"],
      score: calcScore(anualRecMes, true, true) },
    { id: "convenio", name: "Convenio / Plano", tipo: "Privado", perConsulta: convenioLiq, recMes: convenioMes,
      color: "text-orange-400", borderColor: "border-orange-400/30", bgColor: "bg-orange-400/5",
      desc: "Atendimento via planos de saude com tabela TUSS. Volume alto mas margem menor.",
      pros: ["Volume garantido pelo plano", "Base grande de pacientes", "Credibilidade"],
      contras: ["Glosa de " + glosa + "%", "Valor tabelado baixo", "Pagamento em 30-60 dias"],
      score: calcScore(convenioMes, true, false) },
    { id: "pacote", name: "Pacote Bundle", tipo: "Privado", perConsulta: pacotePerConsulta, recMes: pacoteMes,
      color: "text-cyan-400", borderColor: "border-cyan-400/30", bgColor: "bg-cyan-400/5",
      desc: "Pacote com N consultas por preco fechado. Incentiva uso e retorno.",
      pros: ["Receita antecipada", "Paciente retorna", "Perceived value alto"],
      contras: ["Desconto implicito", "Consultas nao usadas = custo zero", "Controle complexo"],
      score: calcScore(pacoteMes, false, true) },
    { id: "freemium", name: "Freemium + Premium", tipo: "Privado", perConsulta: freemiumPerConsulta, recMes: freemiumMes,
      color: "text-pink-400", borderColor: "border-pink-400/30", bgColor: "bg-pink-400/5",
      desc: "Base gratis com conversao para plano premium pago. Funil de aquisicao.",
      pros: ["Aquisicao massiva", "Baixo CAC", "Upsell natural"],
      contras: ["Apenas " + freemiumConv + "% converte", "Custo de atender gratis", "Receita dependente de conversao"],
      score: calcScore(freemiumMes, false, true) },
    { id: "sus-tele", name: "Telessaude SIGTAP", tipo: "SUS", perConsulta: susTeleconsulta * (susPercRepasse / 100), recMes: susTelemedicinaMes,
      color: "text-emerald-400", borderColor: "border-emerald-400/30", bgColor: "bg-emerald-400/5",
      desc: "Teleconsulta BPA cod. 0301010072. Repasse federal por procedimento.",
      pros: ["Demanda garantida (SUS)", "Impacto social", "Escala via municipios"],
      contras: ["Valor tabelado baixo", "Burocracia de habilitacao", "Repasse pode atrasar"],
      score: calcScore(susTelemedicinaMes, false, false) },
    { id: "sus-psf", name: "PSF/ESF Per Capita", tipo: "SUS", perConsulta: susPsfPerConsulta, recMes: susPsfMes,
      color: "text-teal-400", borderColor: "border-teal-400/30", bgColor: "bg-teal-400/5",
      desc: "Programa Saude da Familia — repasse fixo por pessoa cadastrada na equipe.",
      pros: ["Receita fixa mensal", "Independe de volume", "Longo prazo"],
      contras: ["Necessita vinculo ESF", "Limite de populacao/equipe", "Reajuste raro"],
      score: calcScore(susPsfMes, true, false) },
    { id: "sus-mac", name: "MAC (Media/Alta)", tipo: "SUS", perConsulta: susMacPerConsulta, recMes: susMacMes,
      color: "text-amber-400", borderColor: "border-amber-400/30", bgColor: "bg-amber-400/5",
      desc: "Procedimentos ambulatoriais de media e alta complexidade — tabela SIGTAP.",
      pros: ["Valor por procedimento mais alto", "Especialidades valorizadas", "Complementa BPA"],
      contras: ["Volume limitado por teto", "Necessita autorizacao", "Auditoria rigorosa"],
      score: calcScore(susMacMes, false, false) },
    { id: "sus-nasf", name: "NASF/eMulti", tipo: "SUS", perConsulta: susNasfPerConsulta, recMes: susNasfMes,
      color: "text-lime-400", borderColor: "border-lime-400/30", bgColor: "bg-lime-400/5",
      desc: "Nucleo de Apoio a Saude da Familia — custeio fixo por equipe vinculada.",
      pros: ["Receita fixa por equipe", "Multidisciplinar", "Apoio matricial"],
      contras: ["Depende de vinculacao", "Limite de equipes", "Pode ser descontinuado"],
      score: calcScore(susNasfMes, true, false) },
  ];}, [val, refRecMes, perMinConsulta, perMinMes, mensalPerConsulta, mensalRecMes,
      anualPerConsulta, anualRecMes, convenioLiq, convenioMes, pacotePerConsulta, pacoteMes,
      freemiumPerConsulta, freemiumMes, freemiumConv, glosa,
      susTeleconsulta, susPercRepasse, susTelemedicinaMes, susPsfPerConsulta, susPsfMes,
      susMacPerConsulta, susMacMes, susNasfPerConsulta, susNasfMes]);

  const filtered = filter === "todos" ? models : models.filter(m => m.tipo.toLowerCase() === filter);
  const bestModel = [...models].sort((a, b) => b.recMes - a.recMes)[0];
  const bestScore = [...models].sort((a, b) => b.score - a.score)[0];

  return (
    <>
      <SectionHeader title="Modelos de Cobranca" subtitle="Configure e compare todos os modelos de receita — SUS e privado — para decisao de contrato" badge="11 MODELOS" />

      {/* Best picks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center text-2xl flex-shrink-0">💰</div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-green-400 uppercase tracking-wider">Maior Receita</p>
            <p className="text-sm font-bold truncate">{bestModel.name}</p>
            <p className="text-lg font-bold font-mono text-green-400">{FK(bestModel.recMes)}<span className="text-xs text-muted-foreground font-normal">/mes</span></p>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl flex-shrink-0">⭐</div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Melhor Avaliacao</p>
            <p className="text-sm font-bold truncate">{bestScore.name}</p>
            <p className="text-lg font-bold font-mono text-blue-400">{bestScore.score}<span className="text-xs text-muted-foreground font-normal">/100 pts</span></p>
          </div>
        </motion.div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <TabButton active={filter === "todos"} onClick={() => setFilter("todos")} count={11}>Todos</TabButton>
        <TabButton active={filter === "privado"} onClick={() => setFilter("privado")} count={7}>Privado</TabButton>
        <TabButton active={filter === "sus"} onClick={() => setFilter("sus")} count={4}>SUS</TabButton>
      </div>

      {/* Model Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((m, i) => {
          const vs = refRecMes > 0 ? ((m.recMes - refRecMes) / refRecMes * 100) : 0;
          const isBest = m.id === bestModel.id;
          const isSelected = selectedModel === m.id;

          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg overflow-hidden ${
                  isSelected ? `ring-2 ring-primary shadow-xl ${m.bgColor}` : `border-border/60 hover:${m.borderColor}`
                } ${isBest ? "ring-1 ring-green-400/40" : ""}`}
                onClick={() => setSelectedModel(isSelected ? null : m.id)}
              >
                <CardContent className="p-0">
                  {/* Header */}
                  <div className={`px-4 pt-4 pb-3 ${m.bgColor} border-b border-border/30`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            m.tipo === "SUS" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20"
                          }`}>{m.tipo}</span>
                          {isBest && <span className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/20">TOP RECEITA</span>}
                        </div>
                        <p className={`text-sm font-bold mt-1.5 ${m.color}`}>{m.name}</p>
                      </div>
                      {/* Score badge */}
                      <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                        m.score >= 70 ? "bg-green-500/15 text-green-400" : m.score >= 40 ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        <span className="text-sm font-bold font-mono leading-none">{m.score}</span>
                        <span className="text-[7px] uppercase tracking-wider">pts</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{m.desc}</p>
                  </div>

                  {/* Numbers */}
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">Receita/mes</span>
                      <span className={`text-base font-bold font-mono ${m.color}`}>{FK(m.recMes)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">Por consulta</span>
                      <span className="text-sm font-semibold font-mono">R$ {F2(m.perConsulta)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">vs Fixo (R$ {F2(val)})</span>
                      <span className={`text-sm font-bold font-mono ${vs >= 0 ? "text-green-400" : "text-destructive"}`}>
                        {vs >= 0 ? "+" : ""}{vs.toFixed(0)}%
                      </span>
                    </div>
                    {/* Revenue bar */}
                    <div className="pt-1">
                      <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${m.recMes >= refRecMes ? "bg-green-400" : "bg-orange-400"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (m.recMes / Math.max(bestModel.recMes, 1)) * 100)}%` }}
                          transition={{ delay: i * 0.04 + 0.2, duration: 0.5 }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[8px] text-muted-foreground">R$ 0</span>
                        <span className="text-[8px] text-muted-foreground">{FK(bestModel.recMes)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expandable details */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[9px] font-bold text-green-400 uppercase tracking-wider mb-1">Vantagens</p>
                              {m.pros.map(p => (
                                <p key={p} className="text-[10px] text-muted-foreground flex items-start gap-1 mb-0.5">
                                  <span className="text-green-400 mt-px">+</span> {p}
                                </p>
                              ))}
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-destructive uppercase tracking-wider mb-1">Riscos</p>
                              {m.contras.map(c => (
                                <p key={c} className="text-[10px] text-muted-foreground flex items-start gap-1 mb-0.5">
                                  <span className="text-destructive mt-px">-</span> {c}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Configuration Panel */}
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-5">
          <SectionHeader title="Configurar Parametros" subtitle="Ajuste os valores de cada modelo para simular diferentes cenarios de contrato" />

          {/* Privado config */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Privado</span>
              <span className="flex-1 border-t border-border/40" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <ParamInput label="R$/minuto" value={valMin} onChange={setValMin} step={0.01} />
              <ParamInput label="Mensal (R$/mes)" value={valMensal} onChange={setValMensal} step={1} />
              <ParamInput label="Assinantes mensal" value={assinMensal} onChange={setAssinMensal} step={10} />
              <ParamInput label="Anual (R$/ano)" value={valAnual} onChange={setValAnual} step={10} />
              <ParamInput label="Assinantes anual" value={assinAnual} onChange={setAssinAnual} step={10} />
              <ParamInput label="TUSS (R$/proc)" value={valConvenio} onChange={setValConvenio} step={0.5} />
              <ParamInput label="% Glosa" value={glosa} onChange={setGlosa} step={1} />
              <ParamInput label="Pacote (R$)" value={valPacote} onChange={setValPacote} step={1} />
              <ParamInput label="Consultas/pacote" value={consultasPacote} onChange={setConsultasPacote} step={1} />
              <ParamInput label="% Conversao free" value={freemiumConv} onChange={setFreemiumConv} step={1} />
              <ParamInput label="R$/premium" value={valPremium} onChange={setValPremium} step={1} />
            </div>
          </div>

          {/* SUS config */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">SUS</span>
              <span className="flex-1 border-t border-border/40" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <ParamInput label="SIGTAP (R$/proc)" value={susTeleconsulta} onChange={setSusTeleconsulta} step={0.01} />
              <ParamInput label="% Repasse" value={susPercRepasse} onChange={setSusPercRepasse} step={5} />
              <ParamInput label="Equipes PSF" value={susPsfEquipes} onChange={setSusPsfEquipes} step={1} />
              <ParamInput label="R$/capita PSF" value={susPsfPerCapita} onChange={setSusPsfPerCapita} step={0.5} />
              <ParamInput label="Pop./equipe PSF" value={susPsfPopulacao} onChange={setSusPsfPopulacao} step={100} />
              <ParamInput label="MAC (R$/proc)" value={susMacValor} onChange={setSusMacValor} step={5} />
              <ParamInput label="MAC qty/mes" value={susMacQtd} onChange={setSusMacQtd} step={5} />
              <ParamInput label="Equipes NASF" value={susNasfEquipes} onChange={setSusNasfEquipes} step={1} />
              <ParamInput label="R$/equipe NASF" value={susNasfValor} onChange={setSusNasfValor} step={500} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparative Table */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionHeader title="Tabela Comparativa" subtitle="Ranking completo de todos os modelos ordenado por receita mensal" />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-border">
                  {["#", "Modelo", "Tipo", "Score", "R$/Consulta", "Receita/Mes", "vs Fixo", "Var %"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-muted-foreground font-semibold uppercase text-[9px] tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered].sort((a, b) => b.recMes - a.recMes).map((m, i) => {
                  const diff = m.recMes - refRecMes;
                  const pct = refRecMes > 0 ? (diff / refRecMes * 100) : 0;
                  return (
                    <tr key={m.id} className={`border-b border-border/40 hover:bg-secondary/40 transition-colors ${i === 0 ? "bg-green-500/5" : i % 2 === 0 ? "bg-secondary/10" : ""}`}>
                      <td className="px-3 py-2.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? "bg-yellow-500/20 text-yellow-400" : i === 1 ? "bg-zinc-400/20 text-zinc-300" : i === 2 ? "bg-amber-700/20 text-amber-600" : "bg-secondary text-muted-foreground"
                        }`}>{i + 1}</span>
                      </td>
                      <td className={`px-3 py-2.5 font-semibold ${m.color}`}>{m.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                          m.tipo === "SUS" ? "bg-emerald-500/10 text-emerald-400" : "bg-primary/10 text-primary"
                        }`}>{m.tipo}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${m.score >= 70 ? "bg-green-400" : m.score >= 40 ? "bg-yellow-400" : "bg-red-400"}`}
                              style={{ width: `${m.score}%` }} />
                          </div>
                          <span className="font-mono text-[10px] font-semibold">{m.score}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono">R$ {F2(m.perConsulta)}</td>
                      <td className={`px-3 py-2.5 font-mono font-bold ${m.color}`}>{FK(m.recMes)}</td>
                      <td className={`px-3 py-2.5 font-mono ${diff >= 0 ? "text-green-400" : "text-destructive"}`}>
                        {diff >= 0 ? "+" : ""}{FK(diff)}
                      </td>
                      <td className={`px-3 py-2.5 font-mono font-semibold ${pct >= 0 ? "text-green-400" : "text-destructive"}`}>
                        {pct >= 0 ? "+" : ""}{pct.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue comparison chart */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <SectionHeader title="Comparativo Visual" subtitle="Receita mensal de cada modelo vs referencia (fixo)" />
          <div className="h-72 mt-4">
            <Bar data={{
              labels: [...filtered].sort((a, b) => b.recMes - a.recMes).map(m => m.name),
              datasets: [
                { label: "Receita/mes", data: [...filtered].sort((a, b) => b.recMes - a.recMes).map(m => m.recMes),
                  backgroundColor: [...filtered].sort((a, b) => b.recMes - a.recMes).map(m => m.recMes >= refRecMes ? "rgba(74,222,128,.5)" : "rgba(248,113,113,.5)"),
                  borderRadius: 6 },
              ],
            }} options={{
              responsive: true, maintainAspectRatio: false, indexAxis: "y" as const,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => FK(ctx.raw as number) } },
              },
              scales: {
                x: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#71717a", font: { size: 9 }, callback: (v) => FK(Number(v)) } },
                y: { grid: { display: false }, ticks: { color: "#a1a1aa", font: { size: 10 } } },
              },
            }} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ParamInput({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <div className="space-y-1">
      <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      <input type="number" className="w-full bg-secondary/80 border border-border/60 rounded-lg px-2.5 py-2 text-right text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
        value={value} step={step} onChange={e => onChange(+e.target.value || 0)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TAB 3 — Analise Avancada
   ═══════════════════════════════════════════════════════════════ */
type AnaliseProps = SimProps & { r: ReturnType<typeof fullCost>; mgP: number; bm: number };

function AnaliseAvancadaTab({ val, pes, med, docs, dur, dias, r, mgP, bm }: AnaliseProps) {
  return (
    <>
      <ScenariosCard val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} />
      <GrowthProjectionCard val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} />
      <SensitivityCard val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} />
      <UnitEconomicsCard val={val} pes={pes} dias={dias} r={r} mgP={mgP} bm={bm} />
    </>
  );
}

/* ─── Scenarios ─── */
function ScenariosCard({ val, pes, med, docs, dur, dias }: SimProps) {
  const scenarios = [
    { name: "Pessimista", icon: "📉", pesMult: 0.5, valMult: 0.85, color: "text-destructive", border: "border-destructive/30", bg: "bg-destructive/5", gradient: "from-destructive/10 to-transparent" },
    { name: "Realista", icon: "📊", pesMult: 1, valMult: 1, color: "text-primary", border: "border-primary/30", bg: "bg-primary/5", gradient: "from-primary/10 to-transparent" },
    { name: "Otimista", icon: "🚀", pesMult: 1.8, valMult: 1.15, color: "text-green-400", border: "border-green-400/30", bg: "bg-green-400/5", gradient: "from-green-500/10 to-transparent" },
  ];
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <SectionHeader title="Cenarios Comparativos" subtitle="Pessimista (50% vol, -15% preco), realista e otimista (180% vol, +15% preco)" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {scenarios.map(s => {
            const sp = Math.round(pes * s.pesMult);
            const sv = +(val * s.valMult).toFixed(2);
            const x = fullCost(sp, sv, med, docs, dur, dias);
            const mg = x.rec > 0 ? (x.res / x.rec * 100) : 0;
            return (
              <div key={s.name} className={`rounded-xl p-4 border ${s.border} ${s.bg} bg-gradient-to-b ${s.gradient} relative overflow-hidden`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{s.icon}</span>
                  <p className={`text-sm font-bold ${s.color} uppercase`}>{s.name}</p>
                </div>
                <div className="space-y-2 text-xs">
                  <Row label="Pacientes/mes" value={NL(sp)} />
                  <Row label="Valor consulta" value={`R$ ${F2(sv)}`} />
                  <Row label="Receita bruta" value={FK(x.rec)} bold />
                  <Row label="Custo total" value={FK(x.cT)} className="text-destructive" />
                  <div className="border-t border-border/40 pt-2 mt-2">
                    <Row label="Resultado" value={FK(x.res)} className={x.res >= 0 ? "text-green-400" : "text-destructive"} bold />
                    <Row label="Margem" value={`${mg.toFixed(1)}%`} className={mg >= 0 ? "text-green-400" : "text-destructive"} />
                    <Row label="Medicos" value={String(x.dn)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, className = "", bold = false }: { label: string; value: string; className?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : "font-semibold"} ${className}`}>{value}</span>
    </div>
  );
}

/* ─── Growth Projection ─── */
function GrowthProjectionCard({ val, pes, med, docs, dur, dias }: SimProps) {
  const [growthRate, setGrowthRate] = useState(15);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const projRec: number[] = [], projCst: number[] = [], projPes: number[] = [];
  let cumResult = 0;
  const cumResults: number[] = [];

  months.forEach(m => {
    const mp = Math.round(pes * Math.pow(1 + growthRate / 100, m - 1));
    const x = fullCost(mp, val, med, docs, dur, dias);
    projPes.push(mp);
    projRec.push(Math.round(x.rL));
    projCst.push(Math.round(x.cM + x.cIF + x.cIA + x.cS + x.cIV));
    cumResult += x.res;
    cumResults.push(Math.round(cumResult));
  });

  const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const paybackMonth = cumResults.findIndex(v => v >= 0) + 1;
  const totalProfit = cumResults[11];
  const finalPes = projPes[11];

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionHeader title="Projecao 12 Meses" subtitle="Crescimento mensal composto — receita, custo e resultado acumulado" />
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
            <span className="text-[10px] text-muted-foreground">Crescimento/mes:</span>
            <input type="number" className="w-16 bg-secondary border border-border/60 rounded-lg px-2 py-1 text-right text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={growthRate} min={-20} max={100} onChange={e => setGrowthRate(+e.target.value || 0)} />
            <span className="text-[10px] text-muted-foreground font-bold">%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MiniKpi label="Pacientes mes 12" value={NL(finalPes)} color="text-primary" />
          <MiniKpi label="Receita mes 12" value={FK(projRec[11])} color="text-blue-400" />
          <MiniKpi label="Lucro acumulado" value={FK(totalProfit)} color={totalProfit >= 0 ? "text-green-400" : "text-destructive"} />
          <MiniKpi label="Payback" value={paybackMonth > 0 ? `Mes ${paybackMonth}` : "> 12m"} color="text-warning" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-56">
            <Line data={{
              labels: monthLabels,
              datasets: [
                { label: "Receita", data: projRec, borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.06)", fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, pointBackgroundColor: "#4ade80" },
                { label: "Custo", data: projCst, borderColor: "#f87171", backgroundColor: "rgba(248,113,113,.06)", fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2, pointBackgroundColor: "#f87171" },
              ],
            }} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: true, position: "bottom" as const, labels: { color: "#71717a", usePointStyle: true, padding: 10, font: { size: 10 } } } },
              scales: {
                x: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#71717a", font: { size: 9 } } },
                y: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#71717a", font: { size: 9 }, callback: (v: number | string) => FK(Number(v)) } },
              },
            }} />
          </div>
          <div className="h-56">
            <Bar data={{
              labels: monthLabels,
              datasets: [{ label: "Acumulado", data: cumResults,
                backgroundColor: cumResults.map(v => v >= 0 ? "rgba(74,222,128,.5)" : "rgba(248,113,113,.5)"), borderRadius: 4 }],
            }} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#71717a", font: { size: 9 } } },
                y: { grid: { color: "rgba(255,255,255,.04)" }, ticks: { color: "#71717a", font: { size: 9 }, callback: (v: number | string) => FK(Number(v)) } },
              },
            }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-secondary/30 rounded-xl p-3 text-center border border-border/40">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-base font-bold font-mono mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

/* ─── Sensitivity ─── */
function SensitivityCard({ val, pes, med, docs, dur, dias }: SimProps) {
  const priceSteps = [-30, -20, -10, 0, 10, 20, 30];
  const volSteps = [-40, -20, 0, 20, 40, 80];

  const getCellColor = (res: number) => {
    if (res > 10000) return "bg-green-500/30 text-green-200";
    if (res > 0) return "bg-green-500/15 text-green-300";
    if (res > -5000) return "bg-yellow-500/15 text-yellow-300";
    return "bg-red-500/25 text-red-300";
  };

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <SectionHeader title="Analise de Sensibilidade" subtitle="Resultado mensal variando preco (colunas) e volume (linhas) — heatmap de viabilidade" />
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-muted-foreground font-semibold">Vol \ Preco</th>
                {priceSteps.map(p => (
                  <th key={p} className="px-3 py-2 text-center text-muted-foreground font-semibold">
                    {p >= 0 ? "+" : ""}{p}%<br />
                    <span className="text-[8px] font-normal">R$ {F2(val * (1 + p / 100))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {volSteps.map(v => {
                const vPes = Math.round(pes * (1 + v / 100));
                return (
                  <tr key={v}>
                    <td className="px-3 py-2 font-semibold text-muted-foreground">
                      {v >= 0 ? "+" : ""}{v}% <span className="text-[8px] font-normal">({NL(vPes)})</span>
                    </td>
                    {priceSteps.map(p => {
                      const sv = val * (1 + p / 100);
                      const x = fullCost(vPes, sv, med, docs, dur, dias);
                      return (
                        <td key={p} className={`px-3 py-2 text-center font-mono font-semibold rounded-lg ${getCellColor(x.res)}`}>
                          {FK(x.res)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Unit Economics ─── */
function UnitEconomicsCard({ val, pes, dias, r, mgP, bm }: Omit<SimProps, 'med' | 'docs' | 'dur'> & { r: ReturnType<typeof fullCost>; mgP: number; bm: number }) {
  const cac = pes > 0 ? 35 : 0;
  const avgConsultsPerPatient = 2.4;
  const churnMonthly = 8;
  const lifetimeMonths = churnMonthly > 0 ? Math.round(100 / churnMonthly) : 999;
  const ltv = val * avgConsultsPerPatient * (lifetimeMonths / 12);
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;
  const paybackMonths = mgP > 0 ? Math.ceil(cac / mgP) : Infinity;
  const revenuePerDoctor = r.dn > 0 ? r.rec / r.dn : 0;
  const costPerDoctor = r.dn > 0 ? r.cT / r.dn : 0;
  const profitPerDoctor = revenuePerDoctor - costPerDoctor;
  const utilizationRate = pes > 0 && r.cap > 0 ? (Math.ceil(pes / dias) / (r.cap * r.dn)) * 100 : 0;
  const grossMargin = r.rec > 0 ? ((r.rec - r.cT) / r.rec * 100) : 0;
  const burnRate = r.res < 0 ? Math.abs(r.res) : 0;

  const kpis = [
    { label: "LTV", value: "R$ " + NL(Math.round(ltv)), sub: `${lifetimeMonths}m x ${avgConsultsPerPatient} cons/ano`, color: "text-blue-400", score: ltv > 100 },
    { label: "CAC", value: "R$ " + NL(cac), sub: "marketing digital", color: "text-pink-400", score: cac < 50 },
    { label: "LTV:CAC", value: ltvCacRatio.toFixed(1) + "x", sub: ltvCacRatio >= 3 ? "saudavel" : "atencao", color: ltvCacRatio >= 3 ? "text-green-400" : "text-warning", score: ltvCacRatio >= 3 },
    { label: "Payback CAC", value: paybackMonths === Infinity ? "N/A" : paybackMonths + "m", sub: "tempo recuperar", color: paybackMonths <= 6 ? "text-green-400" : "text-warning", score: paybackMonths <= 6 },
    { label: "Margem Bruta", value: grossMargin.toFixed(1) + "%", sub: "receita - custos", color: grossMargin >= 30 ? "text-green-400" : "text-warning", score: grossMargin >= 30 },
    { label: "Utilizacao", value: Math.min(utilizationRate, 100).toFixed(0) + "%", sub: `${NL(Math.ceil(pes / dias))}/${r.cap * r.dn} cap`, color: utilizationRate >= 70 ? "text-green-400" : "text-warning", score: utilizationRate >= 70 },
    { label: "Receita/Med", value: FK(revenuePerDoctor), sub: "por medico/mes", color: "text-blue-400", score: revenuePerDoctor > 10000 },
    { label: "Lucro/Med", value: FK(profitPerDoctor), sub: "resultado/medico", color: profitPerDoctor >= 0 ? "text-green-400" : "text-destructive", score: profitPerDoctor > 0 },
    { label: "Breakeven", value: bm === Infinity ? "N/A" : NL(bm), sub: `margem R$ ${F2(mgP)}/pac`, color: "text-warning", score: bm !== Infinity && bm < 500 },
    { label: "Burn Rate", value: burnRate > 0 ? FK(burnRate) : "Lucrativo", sub: burnRate > 0 ? "consumo/mes" : "sem queima", color: burnRate > 0 ? "text-destructive" : "text-green-400", score: burnRate === 0 },
  ];

  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <SectionHeader title="Unit Economics & KPIs" subtitle="Metricas-chave para investidores — LTV, CAC, margens e eficiencia" badge="EXECUTIVO" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-secondary/20 rounded-xl p-3 text-center border border-border/40 relative overflow-hidden group hover:border-primary/20 transition-all">
              <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${k.score ? "bg-green-400" : "bg-orange-400"}`} />
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">{k.label}</p>
              <p className={`text-lg font-bold font-mono mt-0.5 ${k.color}`}>{k.value}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminFinanceiro;
