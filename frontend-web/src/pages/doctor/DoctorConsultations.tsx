import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { getRequests, type MedicalRequest } from '@/services/doctorApi';
import { parseApiList, getStatusInfo } from '@/lib/doctor-helpers';
import { motion } from 'framer-motion';
import {
  Loader2, Stethoscope, User, Calendar, Video, ArrowRight, CheckCircle2, AlertTriangle,
} from 'lucide-react';

const ACTIVE_STATUSES = 'submitted,pending,searching_doctor,approved_pending_payment,paid,consultation_ready,consultation_accepted,in_consultation';
const HISTORY_STATUSES = 'completed,delivered,consultation_finished,signed,pending_post_consultation,rejected,cancelled';

type TabValue = 'active' | 'history';
const PAGE_SIZE = 20;

export default function DoctorConsultations() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Consultas — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, []);

  const [tab, setTab] = useState<TabValue>('active');
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchData = useCallback(async (t: TabValue, p: number) => {
    setLoading(true);
    try {
      const status = t === 'active' ? ACTIVE_STATUSES : HISTORY_STATUSES;
      const data = await getRequests({ page: p, pageSize: PAGE_SIZE, type: 'consultation', status } as Parameters<typeof getRequests>[0]);
      setFetchError(false);
      const parsed = data as { items?: MedicalRequest[]; totalCount?: number } | MedicalRequest[];
      if (Array.isArray(parsed)) {
        setRequests(parsed);
        setTotalCount(parsed.length);
      } else {
        setRequests(parsed.items ?? parseApiList<MedicalRequest>(data));
        setTotalCount(parsed.totalCount ?? 0);
      }
    } catch {
      setRequests([]);
      setTotalCount(0);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(tab, page);
  }, [tab, page, fetchData]);

  const handleTabChange = (t: TabValue) => {
    setTab(t);
    setPage(1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <Stethoscope className="h-6 w-6 text-primary" />
              Consultas
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {totalCount} {totalCount === 1 ? 'consulta' : 'consultas'} — {tab === 'active' ? 'Ativas' : 'Histórico'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => handleTabChange('active')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'active' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'
            }`}
          >
            Ativas
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === 'history' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground'
            }`}
          >
            Histórico
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : fetchError ? (
          <Card className="shadow-sm border-destructive/30">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <p className="font-medium text-destructive">Erro ao carregar consultas</p>
              <p className="text-xs text-muted-foreground mt-1">Verifique sua conexão e tente novamente</p>
              <Button
                variant="outline" size="sm" className="mt-4"
                onClick={() => fetchData(tab, page)}
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : requests.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <Stethoscope className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">
                {tab === 'active' ? 'Nenhuma consulta ativa' : 'Nenhuma consulta no histórico'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {requests.map((req, i) => {
                const statusInfo = getStatusInfo(req.status);
                const statusNorm = req.status.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
                const canVideo = ['consultation_accepted', 'consultation_ready', 'in_consultation'].includes(statusNorm);

                return (
                  <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card className="shadow-sm hover:shadow-md transition-all border-border/50 hover:border-border group">
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                          {/* Icon + Info */}
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                            <div className="p-2.5 sm:p-3 rounded-xl bg-primary/5 shrink-0">
                              <Stethoscope className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <p className="font-semibold text-sm truncate">{req.patientName}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 shrink-0" />
                                  {new Date(req.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {req.consultationStartedAt && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                    Iniciada em {new Date(req.consultationStartedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Status + Action */}
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0 pl-[52px] sm:pl-0">
                            <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </div>
                            {canVideo ? (
                              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigate(`/video/${req.id}`); }}>
                                <Video className="h-3.5 w-3.5" /> Vídeo
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/pedidos/${req.id}`)} className="gap-1 whitespace-nowrap">
                                Ver <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </DoctorLayout>
  );
}
