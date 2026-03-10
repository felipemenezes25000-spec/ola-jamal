import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRequests, type MedicalRequest } from '@/services/doctorApi';
import { parseApiList, getTypeIcon, getTypeLabel, getStatusInfo } from '@/lib/doctor-helpers';
import { motion } from 'framer-motion';
import {
  Loader2, Search, Filter, ArrowRight, User, Calendar, SortDesc,
} from 'lucide-react';

/** Status do backend (camelCase) normalizado para comparação. */
function norm(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function matchesStatusFilter(status: string, filter: string): boolean {
  const n = norm(status);
  switch (filter) {
    case 'pending':
      return ['submitted', 'pending', 'in_review', 'searching_doctor', 'approved_pending_payment', 'consultation_ready', 'consultation_accepted'].includes(n);
    case 'paid':
      return ['paid', 'in_consultation'].includes(n);
    case 'signed':
      return ['signed', 'delivered', 'consultation_finished', 'completed'].includes(n);
    case 'rejected':
      return ['rejected', 'cancelled'].includes(n);
    default:
      return true;
  }
}

type FilterType = 'all' | 'prescription' | 'exam' | 'consultation';
type FilterStatus = 'all' | 'pending' | 'paid' | 'signed' | 'rejected';

const TYPE_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'prescription', label: 'Receitas' },
  { value: 'exam', label: 'Exames' },
  { value: 'consultation', label: 'Consultas' },
];

const STATUS_FILTERS: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'paid', label: 'Pagos' },
  { value: 'signed', label: 'Assinados' },
  { value: 'rejected', label: 'Recusados' },
];

export default function DoctorRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    getRequests({ page: 1, pageSize: 500 })
      .then(data => setRequests(parseApiList<MedicalRequest>(data)))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = [...requests];
    if (typeFilter !== 'all') result = result.filter(r => r.type === typeFilter);
    if (statusFilter !== 'all') result = result.filter(r => matchesStatusFilter(r.status, statusFilter));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.patientName?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }, [requests, typeFilter, statusFilter, search]);

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
              {filtered.length} {filtered.length === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Buscar paciente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              aria-label="Filtros"
            >
              <Filter className="h-4 w-4" />
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
                        onClick={() => setTypeFilter(f.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {STATUS_FILTERS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setStatusFilter(f.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          statusFilter === f.value
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
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
          <div className="space-y-2">
            {filtered.map((req, i) => {
              const Icon = getTypeIcon(req.type);
              const statusInfo = getStatusInfo(req.status);
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className="shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-border/50 hover:border-border group"
                    onClick={() => navigate(`/pedidos/${req.id}`)}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/5 transition-colors shrink-0">
                          <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" aria-hidden />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                            <p className="font-semibold text-sm truncate">{req.patientName}</p>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-medium">{getTypeLabel(req.type)}</span>
                            <span className="text-border">|</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" aria-hidden />
                              {formatDate(req.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
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
        )}
      </div>
    </DoctorLayout>
  );
}
