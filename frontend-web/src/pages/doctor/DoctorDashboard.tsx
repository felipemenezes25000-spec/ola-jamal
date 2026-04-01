import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDoctorAuth } from '@/hooks/useDoctorAuth';
import { getRequests, getDoctorStats, getActiveCertificate, type MedicalRequest, type DoctorStats } from '@/services/doctorApi';
import { useRequestEvents } from '@/hooks/useSignalR';
import {
  getGreeting, getTypeIcon, getTypeLabel, getStatusInfo, getRiskBadge,
  getWaitingTime, parseApiList, isActionableStatus,
} from '@/lib/doctor-helpers';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, FileText, ArrowRight,
  CheckCircle2, AlertTriangle, Sparkles, Wifi, WifiOff, Brain, Video, Shield,
  RefreshCw, Users, ClipboardList, Stethoscope, CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { SkeletonStats, SkeletonQueue } from '@/components/ui/skeleton';

export default function DoctorDashboard() {
  const { user } = useDoctorAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Painel — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, []);

  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [reqData, statsData, certData] = await Promise.all([
        getRequests({ page: 1, pageSize: 50 }),
        getDoctorStats().catch(() => null),
        getActiveCertificate().catch(() => null),
      ]);
      const list = parseApiList<MedicalRequest>(reqData);
      setRequests(list);
      if (statsData) setStats(statsData);
      setHasCertificate(certData != null);
    } catch {
      setRequests([]);
      setError('Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadData().catch(() => { /* handled in loadData */ });
    const interval = setInterval(() => { if (!cancelled) loadData(); }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [loadData]);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { connected: realtimeConnected } = useRequestEvents(
    useCallback((event: { requestId: string; status: string; message?: string }) => {
      const statusNorm = (event.status || '').toLowerCase().replace(/-/g, '_');

      if (statusNorm === 'in_consultation' && event.requestId) {
        if (window.location.pathname.includes(`/video/${event.requestId}`)) {
          loadData();
          return;
        }

        let remaining = 5;
        const toastId = toast.info(`Consulta iniciada! Entrando em ${remaining}s...`, {
          duration: 7000,
          action: {
            label: 'Entrar agora',
            onClick: () => {
              if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
              navigate(`/video/${event.requestId}`);
            },
          },
        });

        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
            toast.dismiss(toastId);
            navigate(`/video/${event.requestId}`);
          } else {
            toast.info(`Consulta iniciada! Entrando em ${remaining}s...`, {
              id: toastId,
              duration: 7000,
              action: {
                label: 'Entrar agora',
                onClick: () => {
                  if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
                  navigate(`/video/${event.requestId}`);
                },
              },
            });
          }
        }, 1000);
      } else {
        toast.info(`Pedido atualizado: ${event.status}`, {
          description: event.message || 'Um pedido foi atualizado',
          action: {
            label: 'Ver',
            onClick: () => navigate(`/pedidos/${event.requestId}`),
          },
        });
      }

      loadData();
    }, [loadData, navigate])
  );

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => { if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; } };
  }, []);

  const pendentes = requests.filter(r => isActionableStatus(r.status));
  const consultasAtivas = requests.filter(r =>
    r.type === 'consultation' &&
    ['consultation_accepted', 'in_consultation', 'paid', 'consultation_ready'].includes(r.status?.toLowerCase() ?? '')
  );
  const comRiscoAlto = requests.filter(r =>
    r.aiRiskLevel && (r.aiRiskLevel.toLowerCase().includes('high') || r.aiRiskLevel.toLowerCase().includes('alto'))
  );
  const withAiSummary = requests.filter(r => r.aiSummaryForDoctor).slice(0, 3);

  const firstName = user?.name?.split(' ')[0] || 'Doutor(a)';

  function getMinutesSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      toast.success('Dados atualizados');
    } catch {
      toast.error('Erro ao atualizar');
    } finally {
      setRefreshing(false);
    }
  };

  const statsCards = [
    {
      label: 'Pendentes',
      value: stats?.pendingCount ?? pendentes.length,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/40',
      ringColor: 'ring-amber-200 dark:ring-amber-800',
      urgent: (stats?.pendingCount ?? pendentes.length) > 0,
      filterParam: 'pending',
    },
    {
      label: 'Concluidos',
      value: stats?.completedCount ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/40',
      ringColor: 'ring-emerald-200 dark:ring-emerald-800',
      urgent: false,
      filterParam: 'completed',
    },
    {
      label: 'Receitas',
      value: requests.filter(r => r.type === 'prescription').length,
      icon: ClipboardList,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/40',
      ringColor: 'ring-blue-200 dark:ring-blue-800',
      urgent: false,
      filterParam: 'prescription',
    },
    {
      label: 'Consultas',
      value: requests.filter(r => r.type === 'consultation').length,
      icon: Stethoscope,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-100 dark:bg-violet-900/40',
      ringColor: 'ring-violet-200 dark:ring-violet-800',
      urgent: false,
      filterParam: 'consultation',
    },
  ];

  const queue = pendentes
    .sort((a, b) => {
      const sa = getStatusInfo(a.status);
      const sb = getStatusInfo(b.status);
      if (sa.priority !== sb.priority) return sa.priority - sb.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    })
    .slice(0, 15);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <DoctorLayout>
      <div className="space-y-6 pb-8">
        {/* ── Greeting Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {getGreeting()}, Dr(a). {firstName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="capitalize">{today}</span>
              </span>
              <span className="hidden sm:inline text-border" aria-hidden>|</span>
              <span className={`flex items-center gap-1 text-xs font-medium ${realtimeConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                {realtimeConnected
                  ? <><Wifi className="h-3 w-3" /> Tempo real ativo</>
                  : <><WifiOff className="h-3 w-3" /> Conectando...</>
                }
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-1.5"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            {pendentes.length > 0 && (
              <Button onClick={() => navigate('/pedidos')} size="sm" className="gap-1.5">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Ver pedidos</span>
                <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] px-1.5 text-[10px] bg-white/20 text-white border-0">
                  {pendentes.length}
                </Badge>
              </Button>
            )}
          </div>
        </motion.div>

        {/* ── Certificate Alert ── */}
        <AnimatePresence>
          {!loading && hasCertificate === false && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800 rounded-xl shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/50 shrink-0">
                    <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                      Certificado Digital pendente
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 truncate">
                      Configure para assinar receitas digitalmente
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/perfil')}
                    className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50 shrink-0"
                  >
                    Configurar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading State ── */}
        {loading && (
          <div className="space-y-6">
            <SkeletonStats />
            <SkeletonQueue count={5} />
          </div>
        )}

        {/* ── Error State ── */}
        {!loading && error && (
          <Card className="border-red-200 dark:border-red-900 rounded-xl shadow-sm">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-3 rounded-2xl bg-red-100 dark:bg-red-900/40">
                <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">{error}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifique sua conexao e tente novamente.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            {/* ── Queue Hero Card (gradient navy) ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
            >
              <div className="relative overflow-hidden rounded-xl p-5 sm:p-6 bg-gradient-to-br from-[#0C4A6E] to-[#075985] text-white shadow-lg">
                {/* Decorative circles */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" aria-hidden />
                <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" aria-hidden />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm shrink-0">
                      <Users className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-sky-200">Fila de Atendimento</p>
                      <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                        {pendentes.length}
                      </p>
                      <p className="text-xs text-sky-300 mt-0.5">
                        {pendentes.length === 0
                          ? 'Nenhum paciente aguardando'
                          : pendentes.length === 1
                            ? 'paciente aguardando'
                            : 'pacientes aguardando'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate('/pedidos')}
                    size="sm"
                    className="gap-1.5 bg-white text-[#0C4A6E] hover:bg-sky-50 font-semibold shadow-md w-full sm:w-auto"
                  >
                    Ver fila <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* ── Stats Grid (4 columns on desktop, 2 on tablet, 1 on small mobile) ── */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {statsCards.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.35 }}
                >
                  <Card
                    className={`rounded-xl border-border/40 bg-white dark:bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group ${stat.urgent ? `ring-1 ${stat.ringColor}` : ''}`}
                    onClick={() => navigate(`/pedidos?status=${stat.filterParam}`)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver pedidos: ${stat.label} — ${stat.value}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/pedidos?status=${stat.filterParam}`); } }}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                          <p className="text-2xl sm:text-3xl font-bold mt-1.5 tracking-tight">{stat.value}</p>
                        </div>
                        <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                          <stat.icon className={`h-5 w-5 ${stat.color}`} aria-hidden />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* ── Alert Cards ── */}
            <AnimatePresence>
              {comRiscoAlto.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900 rounded-xl shadow-sm">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/50 shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-red-800 dark:text-red-300">
                          {comRiscoAlto.length} {comRiscoAlto.length === 1 ? 'pedido' : 'pedidos'} com risco alto identificado pela IA
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Requer atencao prioritaria
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/pedidos')}
                        className="gap-1 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/50 shrink-0 w-full sm:w-auto"
                      >
                        Ver <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {consultasAtivas.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10 rounded-xl shadow-sm">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 shrink-0">
                        <Video className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{consultasAtivas.length} consulta(s) aguardando atendimento</p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const withStarted = consultasAtivas.find(r => r.consultationStartedAt);
                            if (withStarted?.consultationStartedAt) {
                              const min = getMinutesSince(withStarted.consultationStartedAt);
                              return min < 60 ? `Iniciada ha ${min}min` : `Iniciada ha ${Math.floor(min / 60)}h`;
                            }
                            return 'Clique para iniciar videochamada com IA integrada';
                          })()}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => navigate('/consultas')} className="gap-1 w-full sm:w-auto">
                        Atender <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Main Content: 2 column layout on large screens ── */}
            <div className="grid gap-6 lg:grid-cols-3">

              {/* ── Recent Requests (left 2/3) ── */}
              <motion.div
                className="lg:col-span-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                <Card className="rounded-xl shadow-sm border-border/40">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold">Pedidos Recentes</CardTitle>
                      {pendentes.length > 15 && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/pedidos')} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                          Ver todos ({pendentes.length}) <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {queue.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-muted/60 dark:bg-muted/30 flex items-center justify-center mb-4">
                          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                        </div>
                        <p className="font-semibold text-foreground">Nenhum pedido pendente</p>
                        <p className="text-sm text-muted-foreground mt-1">Tudo em dia! Novos pedidos aparecerao aqui em tempo real.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {queue.map((req, i) => {
                          const Icon = getTypeIcon(req.type);
                          const statusInfo = getStatusInfo(req.status);
                          const risk = getRiskBadge(req.aiRiskLevel);
                          const waiting = getWaitingTime(req.createdAt);

                          return (
                            <motion.button
                              key={req.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + i * 0.03 }}
                              onClick={() => navigate(`/pedidos/${req.id}`)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 dark:hover:bg-muted/20 transition-all duration-150 text-left group border border-transparent hover:border-border/50"
                            >
                              <div className="p-2 rounded-lg bg-muted/70 dark:bg-muted/30 group-hover:bg-background transition-colors shrink-0">
                                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{req.patientName}</p>
                                  {req.aiSummaryForDoctor && (
                                    <Sparkles className="h-3 w-3 text-primary shrink-0" aria-label="Resumo de IA disponivel" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{getTypeLabel(req.type)}</span>
                                  {req.aiUrgency && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                      {req.aiUrgency}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Status & waiting: stack on small screens */}
                              <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2 shrink-0">
                                {risk && (
                                  <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${risk.color}`}>
                                    {risk.label}
                                  </span>
                                )}
                                <Badge variant={statusInfo.variant} className={`text-[10px] whitespace-nowrap ${statusInfo.color} ${statusInfo.bgColor}`}>
                                  {statusInfo.label}
                                </Badge>
                                <span className={`text-[11px] ${waiting.urgent ? 'text-red-500 dark:text-red-400 font-semibold' : 'text-muted-foreground'}`}>
                                  {waiting.label}
                                </span>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block shrink-0" />
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* ── Sidebar (right 1/3): AI Summaries + AI Feature Banner ── */}
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
              >
                {/* AI Summaries */}
                <Card className="rounded-xl shadow-sm border-border/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Resumos da IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {withAiSummary.length === 0 ? (
                      <div className="py-8 text-center">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-muted/60 dark:bg-muted/30 flex items-center justify-center mb-3">
                          <Brain className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Nenhum resumo de IA disponivel.
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1">
                          Os resumos aparecerao quando a IA analisar novos pedidos.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {withAiSummary.map((req) => (
                          <button
                            key={req.id}
                            onClick={() => navigate(`/pedidos/${req.id}`)}
                            className="w-full text-left p-3 rounded-lg border border-border/40 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-150 group"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium truncate">{req.patientName}</p>
                              <Badge variant="outline" className="text-[9px] shrink-0">
                                {getTypeLabel(req.type)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {req.aiSummaryForDoctor}
                            </p>
                            <p className="text-[10px] text-primary mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              Ver detalhes <ArrowRight className="h-3 w-3" />
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Feature Banner */}
                <Card className="rounded-xl shadow-sm border-border/40 bg-gradient-to-br from-background to-primary/[0.04] dark:to-primary/[0.08]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 shrink-0">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">Consulta Inteligente</p>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                          Transcricao em tempo real, anamnese automatica e sugestoes de conduta.
                        </p>
                        <Badge variant="outline" className="text-[9px] gap-1 mt-2">
                          <Shield className="h-3 w-3" /> CFM 2.454/2026
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </DoctorLayout>
  );
}
