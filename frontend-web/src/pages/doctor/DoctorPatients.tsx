/**
 * DoctorPatients — Lista de pacientes recentes do médico com paginação.
 * Busca pedidos paginados e extrai patientId + patientName únicos.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { getRequests, type MedicalRequest } from '@/services/doctorApi';
import { parseApiList, getTypeIcon, getTypeLabel } from '@/lib/doctor-helpers';
import { Users, Search, ChevronRight, AlertTriangle } from 'lucide-react';

interface PatientItem {
  patientId: string;
  patientName: string;
  lastRequest: MedicalRequest;
}

function extractUniquePatients(requests: MedicalRequest[]): PatientItem[] {
  const byPatient = new Map<string, MedicalRequest>();
  for (const r of requests) {
    const pid = r.patientId;
    if (!pid) continue;
    const existing = byPatient.get(pid);
    if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
      byPatient.set(pid, r);
    }
  }
  return Array.from(byPatient.entries()).map(([patientId, lastRequest]) => ({
    patientId,
    patientName: lastRequest.patientName ?? 'Paciente',
    lastRequest,
  })).sort(
    (a, b) =>
      new Date(b.lastRequest.createdAt).getTime() -
      new Date(a.lastRequest.createdAt).getTime(),
  );
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

const PAGE_SIZE = 20;

export default function DoctorPatients() {
  useEffect(() => {
    document.title = 'Pacientes — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, []);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [requests, setRequests] = useState<MedicalRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const loadData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getRequests({ page: p, pageSize: PAGE_SIZE * 2 });
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
    loadData(page);
  }, [page, loadData]);

  const patients = useMemo(() => extractUniquePatients(requests), [requests]);
  const filteredPatients = useMemo(() => {
    if (!debouncedSearch.trim()) return patients;
    const q = debouncedSearch.toLowerCase().trim();
    return patients.filter(
      (p) => p.patientName.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q),
    );
  }, [patients, debouncedSearch]);

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DoctorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Pacientes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Pacientes com atendimentos recentes</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* List */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pacientes recentes</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl">
                    <div className="h-10 w-10 rounded-full shrink-0 animate-pulse bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-8 w-24 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <p className="font-medium text-destructive">Erro ao carregar pacientes</p>
                <p className="text-xs text-muted-foreground mt-1">Verifique sua conexão e tente novamente</p>
                <Button
                  variant="outline" size="sm" className="mt-4"
                  onClick={() => loadData(page)}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="font-medium text-muted-foreground">Nenhum paciente encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {debouncedSearch.trim() ? 'Tente outro termo de busca.' : 'Os pacientes aparecerão aqui após atendimentos.'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {filteredPatients.map((p) => {
                    const Icon = getTypeIcon(p.lastRequest.type);
                    return (
                      <button
                        key={p.patientId}
                        type="button"
                        onClick={() => navigate(`/paciente/${p.patientId}`)}
                        className="w-full flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left group"
                      >
                        {/* Avatar + Info */}
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-sm font-bold text-primary">{getInitials(p.patientName)}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{p.patientName}</p>
                            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-0.5">
                              <Icon className="h-3 w-3 shrink-0" />
                              <span>{getTypeLabel(p.lastRequest.type)}</span>
                              <span className="hidden xs:inline">·</span>
                              <span>{new Date(p.lastRequest.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </p>
                          </div>
                        </div>
                        {/* Action */}
                        <div className="pl-[52px] sm:pl-0 shrink-0">
                          <Button variant="outline" size="sm" className="gap-1 whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigate(`/paciente/${p.patientId}`); }}>
                            Ver prontuário <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Pagination page={page} pageSize={PAGE_SIZE * 2} totalCount={totalCount} onPageChange={handlePageChange} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorLayout>
  );
}
