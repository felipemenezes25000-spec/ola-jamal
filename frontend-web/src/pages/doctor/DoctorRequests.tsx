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
import { motion, AnimatePresence } from 'framer-motion';
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
  const [fetchError, setFetchError] = useState(false);

  const fetchData = useCallback(async (p: number, status: FilterStatus, type: FilterType) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, pageSize: PAGE_SIZE };
      if (status !== 'all') params.status = STATUS_GROUP_MAP[status];
      if (type !== 'all') params.type = type;
      const data = await getRequests(params as Parameters<typeof getRequests>[0]);
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

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0);

  return (
    <DoctorLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* ── Header ── */}
        <div className="space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Pedidos</h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                {totalCount} {totalCount === 1 ? 'pedido' : 'pedidos'}
                {statusFilter !== 'all' && (
                  <span className="ml-1">— {STATUS_FILTERS.find(f => f.value === statusFilter)?.label}</span>
                )}
              </p>
            </div>
            {/* Filter toggle + clear — always visible */}
            <div className="flex items-center gap-2 shrink-0">
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { handleStatusFilter('all'); setTypeFilter('all'); }}
                  className="gap-1 text-xs text-muted-foreground hidden sm:inline-flex"
                >
                  <X className="h-3 w-3" /> Limpar
                </Button>
              )}
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                aria-label="Filtros"
                className="relative h-9 w-9"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Search bar — full width, always below title */}
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden />
            <Input
              placeholder="Buscar paciente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-10 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Filters Panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="shadow-sm border-border/50 rounded-xl">
                <CardContent className="p-3 sm:p-4 space-y-4">
                  {/* Type filters */}
                  <div className="space-y-2">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {TYPE_FILTERS.map(f => (
                        <button
                          key={f.value}
                          onClick={() => { setTypeFilter(f.value); setPage(1); syncUrl({ page: 1 }); }}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                            typeFilter === f.value
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status filters */}
                  <div className="space-y-2">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {STATUS_FILTERS.map(f => (
                        <button
                          key={f.value}
                          onClick={() => handleStatusFilter(f.value)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                            statusFilter === f.value
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {f.color && (
                            <span className={`h-2 w-2 rounded-full shrink-0 ${statusFilter === f.value ? 'bg-primary-foreground/70' : f.color}`} />
                          )}
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mobile clear button */}
                  {activeFilterCount > 0 && (
                    <div className="pt-1 sm:hidden">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { handleStatusFilter('all'); setTypeFilter('all'); }}
                        className="gap-1 text-xs text-muted-foreground w-full justify-center"
                      >
                        <X className="h-3 w-3" /> Limpar todos os filtros
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── List ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 gap-3">
            <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-primary" aria-hidden />
            <p className="text-xs text-muted-foreground">Carregando pedidos...</p>
          </div>
        ) : fetchError ? (
          <Card className="shadow-sm border-destructive/30 rounded-xl">
            <CardContent className="py-12 sm:py-16 text-center px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-destructive" />
              </div>
              <p className="font-medium text-destructive text-sm sm:text-base">Erro ao carregar pedidos</p>
              <p className="text-xs text-muted-foreground mt-1">Verifique sua conexão e tente novamente</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => fetchData(page, statusFilter, typeFilter)}
              >
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="shadow-sm rounded-xl">
            <CardContent className="py-12 sm:py-16 text-center px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <SortDesc className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground text-sm sm:text-base">Nenhum pedido encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Tente outra busca' : 'Tente ajustar os filtros'}
              </p>
              {(search || activeFilterCount > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => { setSearch(''); handleStatusFilter('all'); setTypeFilter('all'); }}
                >
                  <X className="h-3 w-3 mr-1" /> Limpar filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2 sm:space-y-3">
              {filtered.map((req, i) => {
                const Icon = getTypeIcon(req.type);
                const statusInfo = getStatusInfo(req.status);
                const risk = getRiskBadge(req.aiRiskLevel);
                const hasAiSummary = !!req.aiSummaryForDoctor;
                const hasRecording = !!req.consultationHasRecording;
                const medCount = req.medications?.length ?? 0;
                const examCount = req.exams?.length ?? 0;

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Card
                      className={`shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-border/50 hover:border-border group rounded-xl ${
                        risk && (req.aiRiskLevel?.toLowerCase().includes('high') || req.aiRiskLevel?.toLowerCase().includes('alto'))
                          ? 'border-l-2 border-l-red-400'
                          : ''
                      }`}
                      onClick={() => navigate(`/pedidos/${req.id}`)}
                    >
                      <CardContent className="p-3 sm:p-4 md:p-5">
                        {/* ── Mobile layout (< sm): stacked ── */}
                        <div className="flex sm:hidden flex-col gap-2.5">
                          {/* Top: icon + name + status */}
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-muted group-hover:bg-primary/5 transition-colors shrink-0">
                              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-sm truncate flex-1 min-w-0">{req.patientName}</p>
                                <Badge
                                  variant={statusInfo.variant}
                                  className={`text-[9px] shrink-0 whitespace-nowrap ${statusInfo.color} ${statusInfo.bgColor}`}
                                >
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              {/* Inline badges */}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-xs text-muted-foreground font-medium">{getTypeLabel(req.type)}</span>
                                {risk && (
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border leading-none ${risk.color}`}>
                                    {risk.label}
                                  </span>
                                )}
                                {hasAiSummary && <Sparkles className="h-3 w-3 text-primary shrink-0" aria-label="Resumo IA" />}
                                {hasRecording && <Video className="h-3 w-3 text-emerald-500 shrink-0" aria-label="Gravacao" />}
                              </div>
                            </div>
                          </div>

                          {/* Meta info */}
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap pl-[42px]">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                              {formatDate(req.createdAt)}
                            </span>
                            {medCount > 0 && (
                              <>
                                <span className="text-border">·</span>
                                <span className="flex items-center gap-1">
                                  <Pill className="h-3 w-3 shrink-0" aria-hidden />
                                  {medCount} {medCount === 1 ? 'med' : 'meds'}
                                </span>
                              </>
                            )}
                            {examCount > 0 && (
                              <>
                                <span className="text-border">·</span>
                                <span className="flex items-center gap-1">
                                  <FlaskConical className="h-3 w-3 shrink-0" aria-hidden />
                                  {examCount} {examCount === 1 ? 'exame' : 'exames'}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Symptoms */}
                          {req.symptoms && (
                            <p className="text-[11px] text-muted-foreground/80 line-clamp-2 italic pl-[42px]">
                              &ldquo;{req.symptoms}&rdquo;
                            </p>
                          )}

                          {/* AI urgency */}
                          {req.aiUrgency && req.aiUrgency !== 'routine' && (
                            <div className="flex items-center gap-1 pl-[42px]">
                              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                                {req.aiUrgency === 'urgent' ? 'Urgente' : req.aiUrgency === 'emergency' ? 'Emergencia' : req.aiUrgency}
                              </span>
                            </div>
                          )}

                          {/* Action row */}
                          <div className="flex items-center justify-end gap-2 pt-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-8 px-3 text-primary"
                              onClick={(e) => { e.stopPropagation(); navigate(`/pedidos/${req.id}`); }}
                            >
                              Ver <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </div>

                        {/* ── Desktop layout (>= sm): horizontal row ── */}
                        <div className="hidden sm:flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/5 transition-colors shrink-0 mt-0.5">
                            <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Patient + badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm truncate max-w-[200px] md:max-w-[300px] lg:max-w-none">{req.patientName}</p>
                              {risk && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border leading-none shrink-0 ${risk.color}`}>
                                  {risk.label}
                                </span>
                              )}
                              {hasAiSummary && (
                                <Sparkles className="h-3 w-3 text-primary shrink-0" aria-label="Resumo IA" />
                              )}
                              {hasRecording && (
                                <Video className="h-3 w-3 text-emerald-500 shrink-0" aria-label="Gravacao" />
                              )}
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span className="font-medium">{getTypeLabel(req.type)}</span>
                              <span className="text-border">·</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                                {formatDate(req.createdAt)}
                              </span>
                              {medCount > 0 && (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="flex items-center gap-1">
                                    <Pill className="h-3 w-3 shrink-0" aria-hidden />
                                    {medCount} {medCount === 1 ? 'med' : 'meds'}
                                  </span>
                                </>
                              )}
                              {examCount > 0 && (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="flex items-center gap-1">
                                    <FlaskConical className="h-3 w-3 shrink-0" aria-hidden />
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
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                                  {req.aiUrgency === 'urgent' ? 'Urgente' : req.aiUrgency === 'emergency' ? 'Emergencia' : req.aiUrgency}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Right side: status + arrow */}
                          <div className="flex items-center gap-3 shrink-0 pt-1">
                            <Badge
                              variant={statusInfo.variant}
                              className={`text-[10px] whitespace-nowrap ${statusInfo.color} ${statusInfo.bgColor}`}
                            >
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
