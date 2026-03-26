import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { getRequests, type MedicalRequest } from '@/services/doctorApi';
import { getTypeIcon, getTypeLabel, getStatusInfo, getRiskBadge, parseApiList } from '@/lib/doctor-helpers';
import { motion } from 'framer-motion';
import {
  Loader2, Search, Filter, ArrowRight, Calendar, SortDesc, X,
  Sparkles, Video, AlertTriangle, Pill, FlaskConical,
} from 'lucide-react';

type FilterType = 'all' | 'prescription' | 'exam' | 'consultation';
type FilterStatus = 'all' | 'pending' | 'in_review' | 'completed' | 'rejected';

const VALID_STATUS_FILTERS = ['all', 'pending', 'in_review', 'completed', 'rejected'] as const;

/** Mapeia grupo de filtro → lista de statuses do backend para query server-side. */
const STATUS_GROUP_MAP: Record<string, string> = {
  pending: 'submitted,pending,paid,searching_doctor,approved_pending_payment',
  in_review: 'in_review,approved,consultation_ready,consultation_accepted,in_consultation,pending_post_consultation',
  completed: 'signed,completed,delivered,consultation_finished',
  rejected: 'rejected,cancelled',
};

const TYPE_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'prescription', label: 'Receitas' },
  { value: 'exam', label: 'Exames' },
  { value: 'consultation', label: 'Consultas' },
];

const STATUS_FILTERS: { value: FilterStatus; label: string; color?: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes', color: 'bg-orange-500' },
  { value: 'in_review', label: 'Em análise', color: 'bg-blue-500' },
  { value: 'completed', label: 'Concluídos', color: 'bg-emerald-500' },
  { value: 'rejected', label: 'Recusados', color: 'bg-red-500' },
];

const PAGE_SIZE = 20;

export default function DoctorRequests() {
  useEffect(() => {
    document.title = 'Pedidos — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, []);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = searchParams.get('status') as FilterStatus | null;
  const initialPage = Number(searchParams.get('page')) || 1;

  const [statusFilter, setStatusFilter] = useState<FilterStatus>(
    initialStatus && (VALID_STATUS_FILTERS as readonly string[]).includes(initialStatus) ? initialStatus : 'all'
  );
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(statusFilter !== 'all');

  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (p: number, status: FilterStatus, type: FilterType) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, pageSize: PAGE_SIZE };
      if (status !== 'all') params.status = STATUS_GROUP_MAP[status];
      if (type !== 'all') params.type = type;
      const data = await getRequests(params as Parameters<typeof getRequests>[0]);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(page, statusFilter, typeFilter);
  }, [page, statusFilter, typeFilter, fetchData]);

  // Filtro local apenas para busca textual (status e tipo já vão pro server)
  const filtered = search
    ? requests.filter(r => {
        const q = search.toLowerCase();
        return r.patientName?.toLowerCase().includes(q) || r.symptoms?.toLowerCase().includes(q) || r.notes?.toLowerCase().includes(q);
      })
    : requests;

  const syncUrl = (params: { status?: string; page?: number }) => {
    const next = new URLSearchParams(searchParams);
    if (params.status !== undefined) {
      if (params.status === 'all') next.delete('status');
      else next.set('status', params.status);
    }
    if (params.page !== undefined) {
      if (params.page <= 1) next.delete('page');
      else next.set('page', String(params.page));
    }
    setSearchParams(next, { replace: true });
  };

  const handleStatusFilter = (value: FilterStatus) => {
    setStatusFilter(value);
    setPage(1);
    syncUrl({ status: value, page: 1 });
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    syncUrl({ page: p });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'}
              {statusFilter !== 'all' && (
                <span className="ml-1">— {STATUS_FILTERS.find(f => f.value === statusFilter)?.label}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            {statusFilter !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => handleStatusFilter('all')} className="gap-1 text-xs text-muted-foreground">
                <X className="h-3 w-3" /> Limpar filtro
              </Button>
            )}
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Filtros"
              className="relative"
            >
              <Filter className="h-4 w-4" />
              {(statusFilter !== 'all' || typeFilter !== 'all') && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-4 flex flex-wrap gap-6">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</p>
                  <div className="flex gap-2">
                    {TYPE_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => { setTypeFilter(f.value); setPage(1); syncUrl({ page: 1 }); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          typeFilter === f.value ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >{f.label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => handleStatusFilter(f.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                          statusFilter === f.value ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {f.color && <span className={`h-2 w-2 rounded-full ${statusFilter === f.value ? 'bg-primary-foreground/70' : f.color}`} />}
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <SortDesc className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">Nenhum pedido encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {filtered.map((req, i) => {
                const Icon = getTypeIcon(req.type);
                const statusInfo = getStatusInfo(req.status);
                const risk = getRiskBadge(req.aiRiskLevel);
                const hasAiSummary = !!req.aiSummaryForDoctor;
                const hasRecording = !!req.consultationHasRecording;
                const medCount = req.medications?.length ?? 0;
                const examCount = req.exams?.length ?? 0;

                return (
                  <motion.div key={req.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                    <Card
                      className={`shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-border/50 hover:border-border group ${
                        risk && (req.aiRiskLevel?.toLowerCase().includes('high') || req.aiRiskLevel?.toLowerCase().includes('alto'))
                          ? 'border-l-2 border-l-red-400'
                          : ''
                      }`}
                      onClick={() => navigate(`/pedidos/${req.id}`)}
                    >
                      <CardContent className="p-4 sm:p-5">
                        {/* Row 1: Header */}
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/5 transition-colors shrink-0 mt-0.5">
                            <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Patient + badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm truncate">{req.patientName}</p>
                              {risk && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border leading-none ${risk.color}`}>
                                  {risk.label}
                                </span>
                              )}
                              {hasAiSummary && (
                                <Sparkles className="h-3 w-3 text-primary shrink-0" aria-label="Resumo IA" />
                              )}
                              {hasRecording && (
                                <Video className="h-3 w-3 text-emerald-500 shrink-0" aria-label="Gravação" />
                              )}
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium">{getTypeLabel(req.type)}</span>
                              <span className="text-border">·</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" aria-hidden />
                                {formatDate(req.createdAt)}
                              </span>
                              {medCount > 0 && (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="flex items-center gap-1">
                                    <Pill className="h-3 w-3" aria-hidden />
                                    {medCount} {medCount === 1 ? 'med' : 'meds'}
                                  </span>
                                </>
                              )}
                              {examCount > 0 && (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="flex items-center gap-1">
                                    <FlaskConical className="h-3 w-3" aria-hidden />
                                    {examCount} {examCount === 1 ? 'exame' : 'exames'}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Symptoms */}
                            {req.symptoms && (
                              <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-1 italic">
                                &ldquo;{req.symptoms}&rdquo;
                              </p>
                            )}

                            {/* AI urgency indicator */}
                            {req.aiUrgency && req.aiUrgency !== 'routine' && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                                  {req.aiUrgency === 'urgent' ? 'Urgente' : req.aiUrgency === 'emergency' ? 'Emergência' : req.aiUrgency}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Right side: status + arrow */}
                          <div className="flex items-center gap-3 shrink-0 pt-1">
                            <Badge variant={statusInfo.variant} className={`text-[10px] ${statusInfo.color} ${statusInfo.bgColor}`}>
                              {statusInfo.label}
                            </Badge>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
