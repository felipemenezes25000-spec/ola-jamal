import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  type NotificationItem,
} from '@/services/doctorApi';
import { toShortId } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Loader2, Bell, BellOff, CheckCheck, FileText,
  CreditCard, Stethoscope, ChevronRight,
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

export default function DoctorNotifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications({ page: 1, pageSize: 50 })
      .then(data => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
        setNotifications(list);
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = async (item: NotificationItem) => {
    if (item.read) {
      handleNavigate(item);
      return;
    }
    try {
      await markNotificationRead(item.id);
      setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n));
      handleNavigate(item);
    } catch { /* silent */ }
  };

  const handleNavigate = (item: NotificationItem) => {
    const requestId = item.data?.requestId as string | undefined;
    if (requestId) navigate(`/pedidos/${toShortId(requestId)}`);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Todas marcadas como lidas');
    } catch {
      toast.error('Erro ao marcar');
    }
  };

  const groups = groupByDate(
    [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

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
          {unreadCount > 0 && (
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
          <div className="space-y-6">
            {groups.map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.items.map((item, i) => {
                    const Icon = getCategoryIcon(item.type);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Card
                          className={`shadow-sm hover:shadow-md transition-all cursor-pointer group ${
                            !item.read ? 'border-primary/20 bg-primary/[0.02]' : 'border-border/50'
                          }`}
                          onClick={() => handleMarkRead(item)}
                        >
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                              !item.read ? 'bg-primary/10' : 'bg-muted'
                            }`}>
                              <Icon className={`h-4 w-4 ${!item.read ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${!item.read ? 'font-semibold' : 'font-medium'}`}>{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">{getTimeAgo(item.createdAt)}</span>
                              {!item.read && (
                                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                              )}
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
        )}
      </div>
    </DoctorLayout>
  );
}
