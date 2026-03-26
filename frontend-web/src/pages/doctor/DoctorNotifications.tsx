import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  getNotifications, markNotificationRead,
  type NotificationItem,
} from '@/services/doctorApi';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRequestEvents } from '@/hooks/useSignalR';
import { parseApiList } from '@/lib/doctor-helpers';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, Bell, BellOff, CheckCheck, FileText,
  CreditCard, Stethoscope, ChevronRight, Clock, ExternalLink,
} from 'lucide-react';

function getCategoryIcon(type: string | undefined) {
  const t = (type ?? '').toLowerCase();
  if (t.includes('payment') || t.includes('pago')) return CreditCard;
  if (t.includes('consult')) return Stethoscope;
  if (t.includes('request') || t.includes('pedido')) return FileText;
  return Bell;
}

function getTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/** Notificações temporais (ex: "consulta em X min") com mais de 2h são expiradas. */
function isExpiredTemporal(item: NotificationItem): boolean {
  const msg = (item.message ?? '').toLowerCase();
  const title = (item.title ?? '').toLowerCase();
  const temporal = msg.includes('começa em') || msg.includes('minuto') || msg.includes('toque para entrar')
    || title.includes('começa em') || title.includes('minuto') || title.includes('toque para entrar');
  if (!temporal) return false;
  const ageMs = Date.now() - new Date(item.createdAt).getTime();
  return ageMs > 2 * 60 * 60 * 1000; // 2 horas
}

/** Extrai requestId do data (pode vir camelCase ou PascalCase do backend). */
function getRequestId(item: NotificationItem): string | undefined {
  const d = item.data;
  if (!d) return undefined;
  return (d.requestId ?? d.RequestId ?? d.request_id) as string | undefined;
}

function groupByDate(items: NotificationItem[]) {
  const groups: { label: string; items: NotificationItem[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  items.forEach(item => {
    const d = new Date(item.createdAt).toDateString();
    let label = '';
    if (d === today) label = 'Hoje';
    else if (d === yesterday) label = 'Ontem';
    else label = new Date(item.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

    const existing = groups.find(g => g.label === label);
    if (existing) existing.items.push(item);
    else groups.push({ label, items: [item] });
  });

  return groups;
}

const PAGE_SIZE = 20;

export default function DoctorNotifications() {
  const navigate = useNavigate();
  const { unreadCount, decrementUnreadCount, markAllReadOptimistic } = useNotifications();

  useEffect(() => {
    document.title = unreadCount > 0 ? `Alertas (${unreadCount}) — RenoveJá+` : 'Alertas — RenoveJá+';
    return () => { document.title = 'RenoveJá+'; };
  }, [unreadCount]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback((p: number) => {
    getNotifications({ page: p, pageSize: PAGE_SIZE })
      .then(data => {
        const parsed = data as { items?: NotificationItem[]; totalCount?: number } | NotificationItem[];
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
          setTotalCount(parsed.length);
        } else {
          setNotifications(parsed.items ?? parseApiList<NotificationItem>(data));
          setTotalCount(parsed.totalCount ?? 0);
        }
      })
      .catch(() => { setNotifications([]); setTotalCount(0); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNotifications(page);
  }, [page, fetchNotifications]);

  useRequestEvents(
    useCallback(() => {
      fetchNotifications(page);
    }, [fetchNotifications, page]),
  );

  const handleMarkRead = async (item: NotificationItem) => {
    if (item.read) {
      handleNavigate(item);
      return;
    }
    try {
      await markNotificationRead(item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      decrementUnreadCount();
      handleNavigate(item);
    } catch { /* silent */ }
  };

  const handleNavigate = (item: NotificationItem) => {
    const requestId = getRequestId(item);
    if (requestId) navigate(`/pedidos/${requestId}`);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllReadOptimistic();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Todas marcadas como lidas');
    } catch {
      toast.error('Erro ao marcar');
    }
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sorted = [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const groups = groupByDate(sorted);
  const hasAnyUnread = notifications.some(n => !n.read);

  return (
    <DoctorLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              Notificações
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">Central de alertas</p>
          </div>
          {(unreadCount > 0 || hasAnyUnread) && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2">
              <CheckCheck className="h-4 w-4" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="shadow-sm">
            <CardContent className="py-16 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground mt-1">Você receberá alertas de novos pedidos aqui</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-6">
              {groups.map(group => (
                <div key={group.label}>
                  {/* Separador de data — contraste alto em dark mode */}
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <p className="text-xs font-bold text-foreground/70 dark:text-foreground/60 uppercase tracking-wider whitespace-nowrap">
                      {group.label}
                    </p>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-2">
                    {group.items.map((item, i) => {
                      const Icon = getCategoryIcon(item.notificationType);
                      const expired = isExpiredTemporal(item);
                      const requestId = getRequestId(item);
                      const hasLink = !!requestId;

                      return (
                        <motion.div key={item.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                          <Card
                            className={`relative overflow-hidden transition-all cursor-pointer group ${
                              expired
                                ? 'border-border/30 shadow-none opacity-50'
                                : !item.read
                                  ? 'border-primary/30 bg-primary/[0.06] shadow-md ring-1 ring-primary/10 hover:shadow-lg'
                                  : 'border-border/50 shadow-sm opacity-80 hover:shadow-md'
                            }`}
                            onClick={() => handleMarkRead(item)}
                          >
                            <CardContent className="p-4 flex items-center gap-4">
                              {/* Barra lateral colorida para não lidas */}
                              {!item.read && !expired && (
                                <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary" />
                              )}
                              <div className={`p-2.5 rounded-xl shrink-0 ${
                                expired
                                  ? 'bg-muted/50'
                                  : !item.read ? 'bg-primary/15' : 'bg-muted'
                              }`}>
                                {expired
                                  ? <Clock className="h-4 w-4 text-muted-foreground/50" />
                                  : <Icon className={`h-4 w-4 ${!item.read ? 'text-primary' : 'text-muted-foreground'}`} />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm ${
                                    expired
                                      ? 'font-medium text-muted-foreground/60 line-through decoration-muted-foreground/30'
                                      : !item.read ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                                  }`}>
                                    {item.title}
                                  </p>
                                  {expired && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground/60 font-medium shrink-0">
                                      Expirada
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs mt-0.5 line-clamp-2 ${
                                  expired
                                    ? 'text-muted-foreground/40'
                                    : !item.read ? 'text-muted-foreground' : 'text-muted-foreground/70'
                                }`}>
                                  {item.message}
                                </p>
                                {/* Link para o pedido */}
                                {hasLink && !expired && (
                                  <p className="text-[11px] text-primary/70 mt-1 flex items-center gap-1 group-hover:text-primary transition-colors">
                                    <ExternalLink className="h-3 w-3" />
                                    Ver pedido
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs ${
                                  expired
                                    ? 'text-muted-foreground/40'
                                    : !item.read ? 'text-primary font-medium' : 'text-muted-foreground'
                                }`}>
                                  {getTimeAgo(item.createdAt)}
                                </span>
                                {!item.read && !expired && <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />}
                                <ChevronRight className={`h-4 w-4 transition-opacity ${
                                  hasLink
                                    ? 'text-muted-foreground opacity-0 group-hover:opacity-100'
                                    : 'hidden'
                                }`} />
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </DoctorLayout>
  );
}
