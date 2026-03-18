import { useState, useCallback, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
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
  if (a >= 1e3) return s + "R$ " + (a / 1e3).toFixed(0) + "K";
  return s + "R$ " + Math.round(a).toLocaleString("pt-BR");
};
const F2 = (v: number) => v.toFixed(2).replace(".", ",");
const NL = (v: number) => Math.round(v).toLocaleString("pt-BR");

function stp(mx: number): [number, number] {
  if (mx <= 200) return [5, 2]; if (mx <= 1e3) return [20, 10]; if (mx <= 5e3) return [100, 50];
  if (mx <= 2e4) return [500, 200]; if (mx <= 1e5) return [2e3, 1e3]; if (mx <= 5e5) return [1e4, 5e3];
  return [5e4, 2e4];
}

/* ─── Slider Component ─── */
function Slider({ label, tag, value, onChange, min, max, step = 1 }: {
  label: string; tag?: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
}) {
  const [effectiveMax, setEffectiveMax] = useState(max);
  useEffect(() => {
    if (value > effectiveMax) queueMicrotask(() => setEffectiveMax(Math.ceil(value * 1.3)));
  }, [value, effectiveMax]);
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
        {label}
        {tag && <span className="text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded normal-case tracking-normal">{tag}</span>}
      </label>
      <div className="flex items-center gap-2">
        <input type="range" className="flex-1 accent-primary h-1" min={min} max={effectiveMax} step={step}
          value={Math.min(value, effectiveMax)} onChange={e => onChange(+e.target.value)} />
        <input type="number" className="w-20 bg-secondary border border-border rounded px-2 py-1 text-right text-sm font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          value={value} min={min} onChange={e => onChange(+e.target.value || 0)} />
      </div>
    </div>
  );
}

/* ─── Metric Card ─── */
function Metric({ label, value, sub, color = "text-foreground", delay = 0 }: {
  label: string; value: string; sub: string; color?: string; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 text-center">
          <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─── Main Page ─── */
const AdminFinanceiro = () => {
  const [ad, setAd] = useState(46);
  const [dias, setDias] = useState(22);
  const [pes, setPes] = useState(46 * 22);
  const [val, setVal] = useState(25);
  const [med, setMed] = useState(1400);
  const [docs, setDocs] = useState(1);
  const [dur, setDur] = useState(15);

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
  const bc = bm === Infinity ? "impossível" : NL(bm);
  const gsm = r.cIA + r.cS + r.cIF + r.cIV + r.cTx;
  const docsForBE = bm === Infinity ? "∞" : String(Math.ceil(bm / (r.cap * dias)));

  const mxP = Math.max(pes * 2.5, bm === Infinity ? 2e3 : bm * 2, 500);
  const [st, st2] = stp(mxP);

  // Chart data: Breakeven line
  const beLabels: number[] = [], beRec: number[] = [], beCst: number[] = [];
  for (let p = 0; p <= mxP; p += st) {
    const x = fullCost(p, val, med, docs, dur, dias);
    beLabels.push(p); beRec.push(Math.round(x.rL)); beCst.push(Math.round(x.cM + x.cIF + x.cIA + x.cS + x.cIV));
  }

  // Chart data: Result bars
  const resLabels: number[] = [], resData: number[] = [], resBg: string[] = [];
  for (let p = st2; p <= mxP; p += st2) {
    const x = fullCost(p, val, med, docs, dur, dias);
    resLabels.push(p); resData.push(Math.round(x.res));
    resBg.push(x.res >= 0 ? "rgba(74,222,128,.6)" : "rgba(248,113,113,.6)");
  }

  // Chart data: Cost composition stacked
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
        grid: { color: "rgba(255,255,255,.05)" },
        ticks: {
          color: "#71717a",
          font: { size: 9 },
          maxTicksLimit: 12,
          callback: (v: number | string) => {
            const n = typeof v === 'number' ? v : Number(v);
            return n >= 1e6 ? (n / 1e6) + "M" : n >= 1e3 ? (n / 1e3) + "K" : String(n);
          },
        },
      },
      y: {
        grid: { color: "rgba(255,255,255,.05)" },
        ticks: { color: "#71717a", font: { size: 9 }, callback: (v: number | string) => FK(Number(v)) },
      },
    },
  };

  // Scale table
  const scaleRows = [50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5].filter(f => f <= mxP);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulador Financeiro</h1>
          <p className="text-muted-foreground text-sm">Análise de viabilidade em tempo real — altere os valores para simular cenários</p>
        </div>

        {/* Controls: Revenue */}
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Receita</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Slider label="Atendimentos/dia" value={ad} onChange={setADSync} min={1} max={5000} />
            <Slider label="Pessoas/mês" value={pes} onChange={setPesSync} min={1} max={9999999} step={10} />
            <Slider label="Valor atendimento (R$)" value={val} onChange={v => setVal(v)} min={1} max={500} />
          </div>
        </div>

        {/* Controls: Operation */}
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Operação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Slider label="Custo diário/médico (R$)" value={med} onChange={v => setMed(v)} min={100} max={20000} step={50} />
            <Slider label="Qtd médicos" value={docs} onChange={v => setDocs(v)} min={1} max={500} />
            <Slider label="Dias trabalhados/mês" tag="editável" value={dias} onChange={setDiasSync} min={1} max={31} />
            <Slider label="Duração consulta (min)" value={dur} onChange={v => setDur(v)} min={5} max={60} />
          </div>
        </div>

        {/* Alerts */}
        {pes > capM && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-3 text-sm">
            <b>Capacidade excedida:</b> {docs} médico(s) × {r.cap}/dia × {dias}d = {NL(capM)} máx. Precisa de <b>{r.dn} médicos</b>.
          </div>
        )}
        <div className="bg-primary/5 border border-primary/10 text-primary rounded-lg p-3 text-sm">
          <b>Infra {inf.fase}:</b> Base R$ {NL(inf.fixo)}/mês + R$ {F2(inf.vPC)}/consulta (compute) + R$ {F2(inf.sPC)}/consulta (storage)
        </div>

        {/* Metrics Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Metric label="Atendimentos/dia" value={NL(ad)} sub="por dia trabalhado" color="text-primary" delay={0} />
          <Metric label="Pessoas/mês" value={NL(pes)} sub={`${NL(ad)}/dia × ${dias}d`} color="text-primary" delay={0.05} />
          <Metric label="Receita bruta" value={FK(r.rec)} sub="faturamento mensal" color="text-blue-400" delay={0.1} />
          <Metric label="Custo total" value={FK(r.cT)} sub="médicos+IA+infra+taxas" color="text-destructive" delay={0.15} />
          <Metric label="Resultado" value={FK(r.res)} sub={r.res >= 0 ? "lucro mensal" : "prejuízo mensal"} color={r.res >= 0 ? "text-green-400" : "text-destructive"} delay={0.2} />
        </div>

        {/* Metrics Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Metric label="Breakeven" value={bc} sub="pessoas/mês mínimo" color="text-warning" delay={0} />
          <Metric label="Capacidade máx" value={NL(capM)} sub={`${r.dn} méd × ${r.cap}/d × ${dias}d`} color="text-primary" delay={0.05} />
          <Metric label="Gastos sem médico" value={FK(gsm)} sub={`IA ${FK(r.cIA)} · infra ${FK(r.cIF + r.cIV)}`} color="text-pink-400" delay={0.1} />
          <Metric label="Custo infra AWS" value={FK(inf.fixo + (inf.vPC + inf.sPC) * pes)} sub={inf.fase} color="text-blue-400" delay={0.15} />
          <Metric label="Margem/pessoa" value={"R$ " + F2(mgP)} sub="acima do breakeven" color={mgP >= 0 ? "text-green-400" : "text-destructive"} delay={0.2} />
        </div>

        {/* Zones */}
        <div className="space-y-1">
          <div className="bg-destructive/5 border border-destructive/10 text-destructive rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />Prejuízo — menos de {bc} pessoas/mês ({dias} dias)
          </div>
          <div className="bg-warning/5 border border-warning/10 text-warning rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-warning" />Breakeven — ~{bc} pessoas/mês. Necessário {docsForBE} médico(s)
          </div>
          <div className="bg-green-500/5 border border-green-500/10 text-green-400 rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Lucro — acima de {bc} pessoas/mês. Margem R$ {F2(mgP)}/pessoa
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Ponto de equilíbrio — Receita vs Custo</p>
              <div className="h-60">
                <Line data={{
                  labels: beLabels,
                  datasets: [
                    { label: "Receita líquida", data: beRec, borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.04)", fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
                    { label: "Custo total", data: beCst, borderColor: "#f87171", backgroundColor: "rgba(248,113,113,.04)", fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
                  ],
                }} options={{ ...chartOpts, plugins: { ...(chartOpts.plugins as object), legend: { display: true, position: "bottom" as const, labels: { color: "#71717a", usePointStyle: true, padding: 10, font: { size: 9 } } } } }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Resultado mensal por pessoas atendidas</p>
              <div className="h-60">
                <Bar data={{ labels: resLabels, datasets: [{ data: resData, backgroundColor: resBg, borderRadius: 3 }] }} options={chartOpts} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Composição de custos por volume</p>
              <div className="h-60">
                <Bar data={{
                  labels: sLabels,
                  datasets: [
                    { label: "Médicos", data: sM, backgroundColor: "#f87171", borderRadius: 2 },
                    { label: "IA", data: sIA, backgroundColor: "#fbbf24", borderRadius: 2 },
                    { label: "Infra", data: sInf, backgroundColor: "#60a5fa", borderRadius: 2 },
                    { label: "Storage", data: sSt, backgroundColor: "#c084fc", borderRadius: 2 },
                  ],
                }} options={{
                  ...chartOpts,
                  plugins: { ...(chartOpts.plugins as object), legend: { display: true, position: "bottom" as const, labels: { color: "#71717a", usePointStyle: true, padding: 10, font: { size: 9 } } } },
                  scales: { ...(chartOpts.scales as object), x: { ...(chartOpts.scales as { x: object; y: object }).x, stacked: true }, y: { ...(chartOpts.scales as { x: object; y: object }).y, stacked: true } },
                }} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Composição do custo IA por consulta (R$5)</p>
              <div className="h-60">
                <Doughnut data={{
                  labels: ["Deepgram R$2,90", "Anamnese R$1,10", "CIDs R$0,55", "Resumo R$0,45", "Infra+taxa R$0,82"],
                  datasets: [{ data: [2.9, 1.1, 0.55, 0.45, 0.82], backgroundColor: ["#f87171", "#fbbf24", "#4ade80", "#60a5fa", "#71717a"], borderWidth: 0, hoverOffset: 5 }],
                }} options={{ responsive: true, maintainAspectRatio: false, cutout: "55%", plugins: { legend: { position: "right" as const, labels: { color: "#a1a1aa", padding: 8, usePointStyle: true, font: { size: 9 } } } } }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scale Table */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">Projeção de escala — Médicos, infra e resultado por volume</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["Pessoas/mês", "Por dia", "Médicos", "Fase", "Custo méd", "Custo IA", "Infra+stor", "Gastos s/ méd", "Total", "Receita", "Resultado", "Margem"].map(h => (
                      <th key={h} className="px-2 py-2 text-left text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scaleRows.map(p => {
                    const x = fullCost(p, val, med, docs, dur, dias);
                    const mg = x.rec > 0 ? (x.res / x.rec * 100) : 0;
                    const gsmRow = x.cIA + x.cS + x.cIF + x.cIV + x.cTx;
                    const cls = x.res < -500 ? "text-destructive bg-destructive/5" : x.res > 500 ? "text-green-400 bg-green-400/5" : "text-warning bg-warning/5";
                    return (
                      <tr key={p} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-2 py-1.5 font-mono">{NL(p)}</td>
                        <td className="px-2 py-1.5 font-mono">{NL(Math.ceil(p / dias))}</td>
                        <td className="px-2 py-1.5">{x.dn}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{x.fase}</td>
                        <td className="px-2 py-1.5 font-mono">{FK(x.cM)}</td>
                        <td className="px-2 py-1.5 font-mono">{FK(x.cIA)}</td>
                        <td className="px-2 py-1.5 font-mono">{FK(x.cIF + x.cIV + x.cS)}</td>
                        <td className="px-2 py-1.5 font-mono">{FK(gsmRow)}</td>
                        <td className="px-2 py-1.5 font-mono">{FK(x.cT)}</td>
                        <td className="px-2 py-1.5 font-mono">{FK(x.rec)}</td>
                        <td className={`px-2 py-1.5 font-mono font-semibold rounded ${cls}`}>{FK(x.res)}</td>
                        <td className={`px-2 py-1.5 font-mono rounded ${cls}`}>{mg.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        {/* ─── Cenários: Pessimista / Realista / Otimista ─── */}
        <ScenariosCard val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} />

        {/* ─── Projeção 12 meses com crescimento ─── */}
        <GrowthProjectionCard val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} />

        {/* ─── Análise de Sensibilidade ─── */}
        <SensitivityCard val={val} pes={pes} med={med} docs={docs} dur={dur} dias={dias} />

        {/* ─── Unit Economics & KPIs Executivos ─── */}
        <UnitEconomicsCard val={val} pes={pes} dias={dias} r={r} mgP={mgP} bm={bm} />

        {/* ─── Simulador de Modelos de Cobrança (independente) ─── */}
        <PricingModelsCard val={val} dur={dur} pes={pes} />
      </div>
    </AdminLayout>
  );
};

/* ─── Shared Props ─── */
type SimProps = { val: number; pes: number; med: number; docs: number; dur: number; dias: number };

/* ─── 1. Cenários: Pessimista / Realista / Otimista ─── */
function ScenariosCard({ val, pes, med, docs, dur, dias }: SimProps) {
  const scenarios = [
    { name: "Pessimista", pesMult: 0.5, valMult: 0.85, color: "text-destructive", border: "border-destructive/30", bg: "bg-destructive/5" },
    { name: "Realista", pesMult: 1, valMult: 1, color: "text-primary", border: "border-primary/30", bg: "bg-primary/5" },
    { name: "Otimista", pesMult: 1.8, valMult: 1.15, color: "text-green-400", border: "border-green-400/30", bg: "bg-green-400/5" },
  ];
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-1">Cenários Comparativos</p>
        <p className="text-[10px] text-muted-foreground mb-3">Projeção pessimista (50% vol, -15% preço), realista e otimista (180% vol, +15% preço)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {scenarios.map(s => {
            const sp = Math.round(pes * s.pesMult);
            const sv = +(val * s.valMult).toFixed(2);
            const x = fullCost(sp, sv, med, docs, dur, dias);
            const mg = x.rec > 0 ? (x.res / x.rec * 100) : 0;
            return (
              <div key={s.name} className={`rounded-lg p-3 border ${s.border} ${s.bg}`}>
                <p className={`text-xs font-bold ${s.color} uppercase mb-2`}>{s.name}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Pacientes/mês</span><span className="font-mono font-semibold">{NL(sp)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor consulta</span><span className="font-mono">R$ {F2(sv)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Receita bruta</span><span className="font-mono font-semibold">{FK(x.rec)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Custo total</span><span className="font-mono text-destructive">{FK(x.cT)}</span></div>
                  <div className="border-t border-border/50 pt-1 mt-1 flex justify-between">
                    <span className="font-semibold">Resultado</span>
                    <span className={`font-mono font-bold ${x.res >= 0 ? "text-green-400" : "text-destructive"}`}>{FK(x.res)}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Margem</span><span className={`font-mono ${mg >= 0 ? "text-green-400" : "text-destructive"}`}>{mg.toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Médicos necessários</span><span className="font-mono">{x.dn}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── 2. Projeção 12 meses com crescimento ─── */
function GrowthProjectionCard({ val, pes, med, docs, dur, dias }: SimProps) {
  const [growthRate, setGrowthRate] = useState(15);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const projRec: number[] = [], projCst: number[] = [], projRes: number[] = [], projPes: number[] = [];
  let cumResult = 0;
  const cumResults: number[] = [];

  months.forEach(m => {
    const mp = Math.round(pes * Math.pow(1 + growthRate / 100, m - 1));
    const x = fullCost(mp, val, med, docs, dur, dias);
    projPes.push(mp);
    projRec.push(Math.round(x.rL));
    projCst.push(Math.round(x.cM + x.cIF + x.cIA + x.cS + x.cIV));
    projRes.push(Math.round(x.res));
    cumResult += x.res;
    cumResults.push(Math.round(cumResult));
  });

  const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const paybackMonth = cumResults.findIndex(v => v >= 0) + 1;
  const totalProfit = cumResults[11];
  const finalPes = projPes[11];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <p className="text-sm font-semibold">Projeção 12 Meses</p>
            <p className="text-[10px] text-muted-foreground">Crescimento mensal composto — receita, custo e resultado acumulado</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Crescimento/mês:</span>
            <input type="number" className="w-16 bg-secondary border border-border rounded px-2 py-1 text-right text-sm font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary"
              value={growthRate} min={-20} max={100} onChange={e => setGrowthRate(+e.target.value || 0)} />
            <span className="text-[10px] text-muted-foreground">%</span>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Pacientes mês 12</p>
            <p className="text-sm font-bold font-mono text-primary">{NL(finalPes)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Receita mês 12</p>
            <p className="text-sm font-bold font-mono text-blue-400">{FK(projRec[11])}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Lucro acumulado 12m</p>
            <p className={`text-sm font-bold font-mono ${totalProfit >= 0 ? "text-green-400" : "text-destructive"}`}>{FK(totalProfit)}</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase">Payback</p>
            <p className="text-sm font-bold font-mono text-warning">{paybackMonth > 0 ? `Mês ${paybackMonth}` : "> 12 meses"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="h-52">
            <Line data={{
              labels: monthLabels,
              datasets: [
                { label: "Receita", data: projRec, borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.04)", fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 },
                { label: "Custo", data: projCst, borderColor: "#f87171", backgroundColor: "rgba(248,113,113,.04)", fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2 },
              ],
            }} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: true, position: "bottom" as const, labels: { color: "#71717a", usePointStyle: true, padding: 8, font: { size: 9 } } } },
              scales: {
                x: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#71717a", font: { size: 9 } } },
                y: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#71717a", font: { size: 9 }, callback: (v: number | string) => FK(Number(v)) } },
              },
            }} />
          </div>
          <div className="h-52">
            <Bar data={{
              labels: monthLabels,
              datasets: [{
                label: "Resultado acumulado",
                data: cumResults,
                backgroundColor: cumResults.map(v => v >= 0 ? "rgba(74,222,128,.6)" : "rgba(248,113,113,.6)"),
                borderRadius: 3,
              }],
            }} options={{
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#71717a", font: { size: 9 } } },
                y: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#71717a", font: { size: 9 }, callback: (v: number | string) => FK(Number(v)) } },
              },
            }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── 3. Análise de Sensibilidade (heatmap) ─── */
function SensitivityCard({ val, pes, med, docs, dur, dias }: SimProps) {
  const priceSteps = [-30, -20, -10, 0, 10, 20, 30];
  const volSteps = [-40, -20, 0, 20, 40, 80];

  const getCellColor = (res: number) => {
    if (res > 10000) return "bg-green-500/40 text-green-200";
    if (res > 0) return "bg-green-500/20 text-green-300";
    if (res > -5000) return "bg-yellow-500/20 text-yellow-300";
    return "bg-red-500/30 text-red-300";
  };

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-1">Análise de Sensibilidade</p>
        <p className="text-[10px] text-muted-foreground mb-3">Resultado mensal variando preço (colunas) e volume (linhas) — identifique zonas de lucro e risco</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left text-muted-foreground font-medium">Vol \ Preço</th>
                {priceSteps.map(p => (
                  <th key={p} className="px-2 py-1.5 text-center text-muted-foreground font-medium">
                    {p >= 0 ? "+" : ""}{p}%<br />
                    <span className="text-[8px]">R$ {F2(val * (1 + p / 100))}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {volSteps.map(v => {
                const vPes = Math.round(pes * (1 + v / 100));
                return (
                  <tr key={v}>
                    <td className="px-2 py-1.5 font-medium text-muted-foreground">
                      {v >= 0 ? "+" : ""}{v}% <span className="text-[8px]">({NL(vPes)})</span>
                    </td>
                    {priceSteps.map(p => {
                      const sv = val * (1 + p / 100);
                      const x = fullCost(vPes, sv, med, docs, dur, dias);
                      return (
                        <td key={p} className={`px-2 py-1.5 text-center font-mono font-semibold rounded ${getCellColor(x.res)}`}>
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

/* ─── 4. Unit Economics & KPIs Executivos ─── */
function UnitEconomicsCard({ val, pes, dias, r, mgP, bm }: Omit<SimProps, 'med' | 'docs' | 'dur'> & { r: ReturnType<typeof fullCost>; mgP: number; bm: number }) {
  // Unit economics
  const cac = pes > 0 ? 35 : 0; // custo aquisição estimado (marketing)
  const avgConsultsPerPatient = 2.4; // média de consultas/paciente/ano
  const churnMonthly = 8; // % churn mensal
  const lifetimeMonths = churnMonthly > 0 ? Math.round(100 / churnMonthly) : 999;
  const ltv = val * avgConsultsPerPatient * (lifetimeMonths / 12);
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;
  const paybackMonths = mgP > 0 ? Math.ceil(cac / mgP) : Infinity;

  // Operational
  const revenuePerDoctor = r.dn > 0 ? r.rec / r.dn : 0;
  const costPerDoctor = r.dn > 0 ? r.cT / r.dn : 0;
  const profitPerDoctor = revenuePerDoctor - costPerDoctor;
  const utilizationRate = pes > 0 && r.cap > 0 ? (Math.ceil(pes / dias) / (r.cap * r.dn)) * 100 : 0;
  const grossMargin = r.rec > 0 ? ((r.rec - r.cT) / r.rec * 100) : 0;
  const burnRate = r.res < 0 ? Math.abs(r.res) : 0;

  const kpis: { label: string; value: string; sub: string; color: string }[] = [
    { label: "LTV (Lifetime Value)", value: "R$ " + NL(Math.round(ltv)), sub: `${lifetimeMonths} meses × ${avgConsultsPerPatient} consultas/ano`, color: "text-blue-400" },
    { label: "CAC (Custo Aquisição)", value: "R$ " + NL(cac), sub: "estimativa marketing digital", color: "text-pink-400" },
    { label: "LTV:CAC", value: ltvCacRatio.toFixed(1) + "x", sub: ltvCacRatio >= 3 ? "saudável (>3x)" : ltvCacRatio >= 1 ? "atenção (<3x)" : "insustentável", color: ltvCacRatio >= 3 ? "text-green-400" : ltvCacRatio >= 1 ? "text-warning" : "text-destructive" },
    { label: "Payback CAC", value: paybackMonths === Infinity ? "N/A" : paybackMonths + " meses", sub: "tempo para recuperar CAC", color: paybackMonths <= 6 ? "text-green-400" : "text-warning" },
    { label: "Margem Bruta", value: grossMargin.toFixed(1) + "%", sub: "receita - custos totais", color: grossMargin >= 30 ? "text-green-400" : grossMargin >= 0 ? "text-warning" : "text-destructive" },
    { label: "Utilização Médicos", value: Math.min(utilizationRate, 100).toFixed(0) + "%", sub: `${NL(Math.ceil(pes / dias))} atend/dia de ${r.cap * r.dn} cap.`, color: utilizationRate >= 80 ? "text-green-400" : utilizationRate >= 50 ? "text-primary" : "text-warning" },
    { label: "Receita/Médico", value: FK(revenuePerDoctor), sub: "faturamento por médico/mês", color: "text-blue-400" },
    { label: "Lucro/Médico", value: FK(profitPerDoctor), sub: "resultado por médico/mês", color: profitPerDoctor >= 0 ? "text-green-400" : "text-destructive" },
    { label: "Breakeven", value: bm === Infinity ? "impossível" : NL(bm) + " pac/mês", sub: `margem unitária R$ ${F2(mgP)}`, color: "text-warning" },
    { label: "Burn Rate", value: burnRate > 0 ? FK(burnRate) + "/mês" : "Lucrativo", sub: burnRate > 0 ? "caixa consumido mensal" : "sem queima de caixa", color: burnRate > 0 ? "text-destructive" : "text-green-400" },
  ];

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-1">Unit Economics & KPIs Executivos</p>
        <p className="text-[10px] text-muted-foreground mb-3">Métricas-chave para investidores — LTV, CAC, margens e eficiência operacional</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {kpis.map(k => (
            <div key={k.label} className="bg-secondary/30 rounded-lg p-2.5 text-center border border-border/50">
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className={`text-base font-bold font-mono mt-0.5 ${k.color}`}>{k.value}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Pricing Models Card — SUS + Privado (não interfere no cálculo principal) ─── */
function PricingModelsCard({ val, dur, pes }: { val: number; dur: number; pes: number }) {
  // Privado
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

  // SUS
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

  const vsRef = (recMes: number) => {
    const diff = recMes - refRecMes;
    const pct = refRecMes > 0 ? (diff / refRecMes * 100).toFixed(0) : "0";
    return { diff, pct, positive: diff >= 0 };
  };

  type ModelRow = { name: string; perConsulta: number; recMes: number; color: string; tag: string };

  const privadoModels: ModelRow[] = [
    { name: "Fixo (atual)", perConsulta: val, recMes: refRecMes, color: "text-primary", tag: "REF" },
    { name: "Por Minuto", perConsulta: perMinConsulta, recMes: perMinMes, color: "text-green-400", tag: "MIN" },
    { name: "Assinatura Mensal", perConsulta: mensalPerConsulta, recMes: mensalRecMes, color: "text-purple-400", tag: "MENSAL" },
    { name: "Assinatura Anual", perConsulta: anualPerConsulta, recMes: anualRecMes, color: "text-blue-400", tag: "ANUAL" },
    { name: "Convênio/Plano", perConsulta: convenioLiq, recMes: convenioMes, color: "text-orange-400", tag: "CONV" },
    { name: "Pacote Bundle", perConsulta: pacotePerConsulta, recMes: pacoteMes, color: "text-cyan-400", tag: "PACK" },
    { name: "Freemium + Premium", perConsulta: freemiumPerConsulta, recMes: freemiumMes, color: "text-pink-400", tag: "FREE" },
  ];
  const susModels: ModelRow[] = [
    { name: "Telessaúde SIGTAP", perConsulta: susTeleconsulta * (susPercRepasse / 100), recMes: susTelemedicinaMes, color: "text-emerald-400", tag: "BPA" },
    { name: "PSF/ESF Per Capita", perConsulta: susPsfPerConsulta, recMes: susPsfMes, color: "text-teal-400", tag: "PSF" },
    { name: "MAC (Média/Alta)", perConsulta: susMacPerConsulta, recMes: susMacMes, color: "text-amber-400", tag: "MAC" },
    { name: "NASF/eMulti", perConsulta: susNasfPerConsulta, recMes: susNasfMes, color: "text-lime-400", tag: "NASF" },
  ];

  const inputCls = "w-20 bg-secondary border border-border rounded px-2 py-1 text-right text-sm font-mono text-primary focus:outline-none focus:ring-1 focus:ring-primary";
  const lblCls = "text-[10px] text-muted-foreground";

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        <div>
          <p className="text-sm font-semibold">Modelos de Cobrança — SUS & Privado</p>
          <p className="text-[10px] text-muted-foreground">Compare todos os modelos de receita possíveis — independente do simulador principal (referência: R$ {F2(val)}/consulta fixo)</p>
        </div>

        {/* ═══ SEÇÃO PRIVADO ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Privado</span>
            <span className="flex-1 border-t border-border/50" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Por Minuto */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-green-400/20">
              <p className="text-[10px] font-semibold text-green-400 uppercase tracking-wider mb-2">Por Minuto</p>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>R$/min:</span>
                <input type="number" className={inputCls} value={valMin} min={0.5} step={0.01} onChange={e => setValMin(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Por consulta ({dur}min)</span><span className="font-mono font-semibold">R$ {F2(perMinConsulta)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-green-400">{FK(perMinMes)}</span></div>
              </div>
            </div>

            {/* Assinatura Mensal */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-purple-400/20">
              <p className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider mb-2">Assinatura Mensal</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>R$/mês:</span>
                <input type="number" className={inputCls} value={valMensal} min={1} step={1} onChange={e => setValMensal(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>Assinantes:</span>
                <input type="number" className={inputCls} value={assinMensal} min={1} step={10} onChange={e => setAssinMensal(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-purple-400">{FK(mensalRecMes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Equiv./consulta</span><span className="font-mono">R$ {F2(mensalPerConsulta)}</span></div>
              </div>
            </div>

            {/* Assinatura Anual */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-blue-400/20">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-2">Assinatura Anual</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>R$/ano:</span>
                <input type="number" className={inputCls} value={valAnual} min={10} step={10} onChange={e => setValAnual(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>Assinantes:</span>
                <input type="number" className={inputCls} value={assinAnual} min={1} step={10} onChange={e => setAssinAnual(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-blue-400">{FK(anualRecMes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Equiv./consulta</span><span className="font-mono">R$ {F2(anualPerConsulta)}</span></div>
              </div>
            </div>

            {/* Convênio / Plano de Saúde */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-orange-400/20">
              <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-2">Convênio / Plano</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>Tabela TUSS:</span>
                <input type="number" className={inputCls} value={valConvenio} min={1} step={0.5} onChange={e => setValConvenio(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>% Glosa:</span>
                <input type="number" className={inputCls} value={glosa} min={0} max={50} step={1} onChange={e => setGlosa(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Líquido/consulta</span><span className="font-mono font-semibold">R$ {F2(convenioLiq)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-orange-400">{FK(convenioMes)}</span></div>
              </div>
            </div>

            {/* Pacote Bundle */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-cyan-400/20">
              <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-2">Pacote Bundle</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>R$/pacote:</span>
                <input type="number" className={inputCls} value={valPacote} min={1} step={1} onChange={e => setValPacote(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>Consultas/pacote:</span>
                <input type="number" className={inputCls} value={consultasPacote} min={1} max={12} step={1} onChange={e => setConsultasPacote(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Por consulta</span><span className="font-mono font-semibold">R$ {F2(pacotePerConsulta)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-cyan-400">{FK(pacoteMes)}</span></div>
              </div>
            </div>

            {/* Freemium */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-pink-400/20">
              <p className="text-[10px] font-semibold text-pink-400 uppercase tracking-wider mb-2">Freemium + Premium</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>% Conversão:</span>
                <input type="number" className={inputCls} value={freemiumConv} min={1} max={100} step={1} onChange={e => setFreemiumConv(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>R$/premium:</span>
                <input type="number" className={inputCls} value={valPremium} min={1} step={1} onChange={e => setValPremium(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Pagantes ({freemiumConv}%)</span><span className="font-mono">{NL(freemiumPagantes)} de {NL(pes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-pink-400">{FK(freemiumMes)}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SEÇÃO SUS ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">SUS — Sistema Único de Saúde</span>
            <span className="flex-1 border-t border-border/50" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Telessaúde SIGTAP */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-emerald-400/20">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">Telessaúde SIGTAP</p>
              <p className="text-[8px] text-muted-foreground mb-2">Cód. 0301010072 — Teleconsulta médica BPA</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>R$/proc:</span>
                <input type="number" className={inputCls} value={susTeleconsulta} min={1} step={0.01} onChange={e => setSusTeleconsulta(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>% Repasse:</span>
                <input type="number" className={inputCls} value={susPercRepasse} min={10} max={100} step={5} onChange={e => setSusPercRepasse(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Líquido/consulta</span><span className="font-mono font-semibold">R$ {F2(susTeleconsulta * susPercRepasse / 100)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês ({NL(pes)})</span><span className="font-mono font-semibold text-emerald-400">{FK(susTelemedicinaMes)}</span></div>
              </div>
            </div>

            {/* PSF / ESF Per Capita */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-teal-400/20">
              <p className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider mb-1">PSF/ESF Per Capita</p>
              <p className="text-[8px] text-muted-foreground mb-2">Programa Saúde da Família — repasse fixo por pessoa cadastrada</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>Equipes:</span>
                <input type="number" className={inputCls} value={susPsfEquipes} min={1} step={1} onChange={e => setSusPsfEquipes(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>R$/capita:</span>
                <input type="number" className={inputCls} value={susPsfPerCapita} min={0.5} step={0.5} onChange={e => setSusPsfPerCapita(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>Pop./equipe:</span>
                <input type="number" className={inputCls} value={susPsfPopulacao} min={100} step={100} onChange={e => setSusPsfPopulacao(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Pop. coberta</span><span className="font-mono">{NL(susPsfEquipes * susPsfPopulacao)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-teal-400">{FK(susPsfMes)}</span></div>
              </div>
            </div>

            {/* MAC */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-amber-400/20">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-1">MAC (Média/Alta Complex.)</p>
              <p className="text-[8px] text-muted-foreground mb-2">Procedimentos ambulatoriais especializados — tabela SIGTAP</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>R$/proc:</span>
                <input type="number" className={inputCls} value={susMacValor} min={1} step={5} onChange={e => setSusMacValor(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>Qtd/mês:</span>
                <input type="number" className={inputCls} value={susMacQtd} min={1} step={5} onChange={e => setSusMacQtd(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-amber-400">{FK(susMacMes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Equiv./consulta</span><span className="font-mono">R$ {F2(susMacPerConsulta)}</span></div>
              </div>
            </div>

            {/* NASF / eMulti */}
            <div className="bg-secondary/30 rounded-lg p-3 border border-lime-400/20">
              <p className="text-[10px] font-semibold text-lime-400 uppercase tracking-wider mb-1">NASF / eMulti</p>
              <p className="text-[8px] text-muted-foreground mb-2">Núcleo de Apoio à Saúde da Família — custeio fixo por equipe</p>
              <div className="flex items-center gap-2 mb-1">
                <span className={lblCls}>Equipes:</span>
                <input type="number" className={inputCls} value={susNasfEquipes} min={1} step={1} onChange={e => setSusNasfEquipes(+e.target.value || 0)} />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={lblCls}>R$/equipe/mês:</span>
                <input type="number" className={inputCls} value={susNasfValor} min={1000} step={500} onChange={e => setSusNasfValor(+e.target.value || 0)} />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Receita/mês</span><span className="font-mono font-semibold text-lime-400">{FK(susNasfMes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Equiv./consulta</span><span className="font-mono">R$ {F2(susNasfPerConsulta)}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ TABELA COMPARATIVA ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Comparativo Geral</span>
            <span className="flex-1 border-t border-border/50" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium">Modelo</th>
                  <th className="px-2 py-2 text-left text-muted-foreground font-medium">Tipo</th>
                  <th className="px-2 py-2 text-right text-muted-foreground font-medium">R$/Consulta</th>
                  <th className="px-2 py-2 text-right text-muted-foreground font-medium">Receita/Mês</th>
                  <th className="px-2 py-2 text-right text-muted-foreground font-medium">vs Fixo</th>
                  <th className="px-2 py-2 text-right text-muted-foreground font-medium">Variação</th>
                </tr>
              </thead>
              <tbody>
                {[...privadoModels, ...susModels].map(m => {
                  const v = vsRef(m.recMes);
                  return (
                    <tr key={m.name} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className={`px-2 py-1.5 font-semibold ${m.color}`}>
                        <span className="inline-block w-10 text-[8px] bg-secondary rounded px-1 py-0.5 text-center font-mono mr-1.5">{m.tag}</span>
                        {m.name}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{susModels.includes(m) ? "SUS" : "Privado"}</td>
                      <td className="px-2 py-1.5 font-mono text-right">R$ {F2(m.perConsulta)}</td>
                      <td className={`px-2 py-1.5 font-mono font-semibold text-right ${m.color}`}>{FK(m.recMes)}</td>
                      <td className={`px-2 py-1.5 font-mono text-right ${v.positive ? "text-green-400" : "text-destructive"}`}>
                        {v.positive ? "+" : ""}{FK(v.diff)}
                      </td>
                      <td className={`px-2 py-1.5 font-mono text-right ${v.positive ? "text-green-400" : "text-destructive"}`}>
                        {v.positive ? "+" : ""}{v.pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══ RANKING ═══ */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-2">Ranking por receita mensal (maior → menor)</p>
          <div className="flex flex-wrap gap-1.5">
            {[...privadoModels, ...susModels]
              .sort((a, b) => b.recMes - a.recMes)
              .map((m, i) => (
                <div key={m.name} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium border ${i === 0 ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300" : "border-border bg-secondary/30 text-muted-foreground"}`}>
                  <span className="font-mono font-bold">{i + 1}.</span>
                  <span className={m.color}>{m.tag}</span>
                  <span className="font-mono">{FK(m.recMes)}</span>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminFinanceiro;
