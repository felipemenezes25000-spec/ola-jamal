/**
 * DoctorQueue — Fila de pedidos aguardando médico, com paginação server-side.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  getRequests, assignToQueue, type MedicalRequest,
} from '@/services/doctorApi';
import { useDoctorAuth } from '@/hooks/useDoctorAuth';
import { parseApiList, getTypeIcon, getTypeLabel, formatDateSafe } from '@/lib/doctor-helpers';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, Users, ArrowRight, Clock, RefreshCw, CheckCircle2,
} from 'lucide-react';

const PAGE_SIZE = 20;
/** Statuses de pedidos disponíveis na fila (sem médico atribuído). */
const QUEUE_STATUSES = 'submitted,searching_doctor,pending,analyzing';

export default function DoctorQueue() {
  const navigate = useNavigate();
  useDoctorAuth();

  const [items, setItems] = useState<MedicalRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Fila de Pedidos — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, []);

  const loadQueue = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await getRequests({ page: p, pageSize: PAGE_SIZE, status: QUEUE_STATUSES } as Parameters<typeof getRequests>[0]);
      const parsed = data as { items?: MedicalRequest[]; totalCount?: number } | MedicalRequest[];
      if (Array.isArray(parsed)) {
        setItems(parsed);
        setTotalCount(parsed.length);
      } else {
        setItems(parsed.items ?? parseApiList<MedicalRequest>(data));
        setTotalCount(parsed.totalCount ?? 0);
      }
    } catch {
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(page); }, [page, loadQueue]);

  const handleAccept = async (id: string) => {
    setAccepting(id);
    try {
      await assignToQueue(id);
      toast.success('Pedido aceito! Redirecionando...');
      navigate(`/pedidos/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aceitar');
    } finally {
      setAccepting(null);
    }
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Fila de pedidos
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalCount > 0
                ? `${totalCount} ${totalCount === 1 ? 'pedido aguardando' : 'pedidos aguardando'} um médico`
                : 'Pedidos aguardando um médico disponível'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadQueue(page)} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">Fila vazia</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nenhum pedido aguardando médico no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item, i) => {
                const TypeIcon = getTypeIcon(item.type);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="shadow-sm hover:shadow-md transition-all">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                          <TypeIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{item.patientName || 'Paciente'}</p>
                            <Badge variant="outline" className="text-[10px]">{getTypeLabel(item.type)}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDateSafe(item.createdAt)}
                            </span>
                            {item.symptoms && (
                              <span className="truncate max-w-[200px]">{item.symptoms}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(item.id)}
                          disabled={accepting === item.id}
                          className="gap-1.5 shrink-0"
                        >
                          {accepting === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5" />
                          )}
                          Assumir
                        </Button>
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
