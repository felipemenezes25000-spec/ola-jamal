import { useState, useEffect, useCallback } from 'react';
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
  Loader2, Clock, FileText, ArrowRight,
  CheckCircle2, AlertTriangle, Sparkles, Wifi, WifiOff, Brain, Video, Shield,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [hasCertificate, setHasCertificate] = useState<boolean | null>(null);

  const loadData = useCallback(async () => {
    try {
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time updates via SignalR
  const { connected: realtimeConnected } = useRequestEvents(
    useCallback((event: { requestId: string; status: string; message?: string }) => {
      toast.info(`Pedido atualizado: ${event.status}`, {
        description: event.message || 'Um pedido foi atualizado',
        action: {
          label: 'Ver',
          onClick: () => navigate(`/pedidos/${event.requestId}`),
        },
      });
      // Refresh data on event
      loadData();
    }, [loadData, navigate])
  );

  const pendentes = requests.filter(r => isActionableStatus(r.status));
  const consultasAtivas = requests.filter(r =>
    r.type === 'consultation' &&
    ['consultation_accepted', 'in_consultation', 'paid', 'consultation_ready'].includes(r.status?.toLowerCase() ?? '')
  );
  const comRiscoAlto = requests.filter(r =>
    r.aiRiskLevel && (r.aiRiskLevel.toLowerCase().includes('high') || r.aiRiskLevel.toLowerCase().includes('alto'))
  );

  const firstName = user?.name?.split(' ')[0] || 'Doutor(a)';

  function getMinutesSince(dateStr: string): number {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  }

  const statsCards = [
    {
      label: 'Pendentes',
      value: stats?.pendingCount ?? pendentes.length,
      icon: Clock,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
      urgent: (stats?.pendingCount ?? pendentes.length) > 0,
    },
    {
      label: 'Em análise',
      value: stats?.inReviewCount ?? 0,
      icon: Brain,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Concluídos',
      value: stats?.completedCount ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
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

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              {getGreeting()}, Dr. {firstName}
            </h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  loadData()
                    .then(() => toast.success('Dados atualizados'))
                    .catch(() => toast.error('Erro ao atualizar'));
                }}
                aria-label="Atualizar dados"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <span className="text-border">•</span>
              <span className={`flex items-center gap-1 text-xs ${realtimeConnected ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                {realtimeConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {realtimeConnected ? 'Tempo real ativo' : 'Conectando...'}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            {pendentes.length > 0 && (
              <Button onClick={() => navigate('/pedidos')} size="sm" className="gap-2">
                <FileText className="h-4 w-4" /> Ver pedidos ({pendentes.length})
              </Button>
            )}
          </div>
        </div>

        {/* Certificate Alert */}
        {!loading && hasCertificate === false && (
          <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-200">
                  Certificado Digital pendente
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Configure para assinar receitas digitalmente
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate('/perfil')} className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/50">
                Configurar
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Carregando painel...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {statsCards.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className={`shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 border-border/50 ${stat.urgent ? 'ring-1 ring-orange-300' : ''}`}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                          <p className="text-3xl font-bold mt-1 tracking-tight">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                          <stat.icon className={`h-5 w-5 ${stat.color}`} aria-hidden />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Critical Alerts */}
            <AnimatePresence>
              {comRiscoAlto.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/50">
                        <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-red-800 dark:text-red-300">
                          {comRiscoAlto.length} {comRiscoAlto.length === 1 ? 'pedido' : 'pedidos'} com risco alto identificado pela IA
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Requer atenção prioritária — a IA identificou sinais de urgência clínica
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => navigate('/pedidos')} className="gap-1 border-red-300 text-red-700 hover:bg-red-100">
                        Ver <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {consultasAtivas.length > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Video className="h-5 w-5 text-primary" aria-hidden />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{consultasAtivas.length} consulta(s) aguardando atendimento</p>
                        <p className="text-xs text-muted-foreground">
                          {(() => {
                            const withStarted = consultasAtivas.find(r => r.consultationStartedAt);
                            if (withStarted?.consultationStartedAt) {
                              const min = getMinutesSince(withStarted.consultationStartedAt);
                              return min < 60 ? `Iniciada há ${min}min` : `Iniciada há ${Math.floor(min / 60)}h`;
                            }
                            return 'Clique para iniciar videochamada com IA integrada';
                          })()}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => navigate('/consultas')} className="gap-1">
                        Atender <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* AI-powered feature banner */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Card className="shadow-sm border-border/50 bg-gradient-to-r from-background to-primary/[0.03]">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Consulta Inteligente com IA</p>
                    <p className="text-xs text-muted-foreground">
                      Transcrição em tempo real (Daily.co) • Anamnese automática (Gemini/GPT-4o) • Sugestões de conduta • Evidências científicas
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                    <Shield className="h-3 w-3" /> CFM 2.454/2026
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>

            {/* Queue */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Fila de Atendimento</CardTitle>
                    {pendentes.length > 15 && (
                      <Button variant="ghost" size="sm" onClick={() => navigate('/pedidos')} className="text-xs gap-1">
                        Ver todos ({pendentes.length}) <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {queue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="font-medium text-muted-foreground">Nenhum pedido pendente</p>
                      <p className="text-xs text-muted-foreground mt-1">Tudo em dia!</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
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
                            transition={{ delay: 0.4 + i * 0.04 }}
                            onClick={() => navigate(`/pedidos/${req.id}`)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all duration-150 text-left group border border-transparent hover:border-border/50"
                          >
                            <div className="p-2 rounded-lg bg-muted group-hover:bg-background transition-colors shrink-0">
                              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{req.patientName}</p>
                                {req.aiSummaryForDoctor && (
                                  <Sparkles className="h-3 w-3 text-primary shrink-0" aria-label="Resumo de IA disponível" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{getTypeLabel(req.type)}</span>
                                {req.aiUrgency && (
                                  <span className="text-[10px] text-amber-600">• {req.aiUrgency}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {risk && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${risk.color}`}>
                                  {risk.label}
                                </span>
                              )}
                              <Badge variant={statusInfo.variant} className={`text-[10px] ${statusInfo.color} ${statusInfo.bgColor}`}>
                                {statusInfo.label}
                              </Badge>
                              <span className={`text-xs ${waiting.urgent ? 'text-red-500 font-semibold' : 'text-muted-foreground'}`}>
                                {waiting.label}
                              </span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </DoctorLayout>
  );
}
