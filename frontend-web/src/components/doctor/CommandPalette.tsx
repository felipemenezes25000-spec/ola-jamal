/**
 * CommandPalette — Busca universal estilo Spotlight/Linear
 *
 * Atalho: Cmd+K (Mac) / Ctrl+K (Windows)
 *
 * Busca em:
 * - Navegação (Painel, Pedidos, Consultas, Perfil, etc.)
 * - Ações rápidas (Novo pedido, Alterar senha, etc.)
 * - Pacientes recentes (quando há dados)
 * - Atalhos de teclado disponíveis
 *
 * Inspirado em Linear e Raycast.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDoctorAuth } from '@/hooks/useDoctorAuth';
import { useNotifications } from '@/contexts/NotificationContext';
import { getRequests, type MedicalRequest } from '@/services/doctorApi';
import { parseApiList } from '@/lib/doctor-helpers';
import {
  LayoutDashboard, FileText, Video, Bell, User, Search,
  LogOut, Moon, Sun, ArrowRight,
  Keyboard, Lock, Shield, Zap, RefreshCw, Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  category: 'navigation' | 'action' | 'patient' | 'shortcut';
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  onToggleDarkMode?: () => void;
  isDark?: boolean;
}

function extractRecentPatients(requests: MedicalRequest[], limit: number): { patientId: string; patientName: string }[] {
  const byPatient = new Map<string, MedicalRequest>();
  for (const r of requests) {
    const pid = r.patientId;
    if (!pid) continue;
    const existing = byPatient.get(pid);
    if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
      byPatient.set(pid, r);
    }
  }
  return Array.from(byPatient.entries())
    .sort((a, b) => new Date(b[1].createdAt).getTime() - new Date(a[1].createdAt).getTime())
    .slice(0, limit)
    .map(([patientId, r]) => ({ patientId, patientName: r.patientName ?? 'Paciente' }));
}

export function CommandPalette({ onToggleDarkMode, isDark }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentPatients, setRecentPatients] = useState<{ patientId: string; patientName: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { signOut, refreshUser } = useDoctorAuth();
  const { refreshUnreadCount } = useNotifications();

  const runAndClose = useCallback((fn: () => void) => {
    fn();
    setOpen(false);
    setQuery('');
  }, []);

  const handleRefreshData = useCallback(async () => {
    await Promise.all([refreshUser(), refreshUnreadCount()]);
    toast.success('Dados atualizados');
  }, [refreshUser, refreshUnreadCount]);

  const baseItems: CommandItem[] = useMemo(() => [
    // Navigation
    { id: 'nav-dashboard', label: 'Painel', description: 'Ir para o painel principal', icon: LayoutDashboard, category: 'navigation', action: () => navigate('/dashboard'), keywords: ['home', 'início', 'dashboard'] },
    { id: 'nav-pedidos', label: 'Pedidos', description: 'Ver todos os pedidos', icon: FileText, category: 'navigation', action: () => navigate('/pedidos'), keywords: ['requests', 'receitas', 'exames'] },
    { id: 'nav-pacientes', label: 'Buscar paciente', description: 'Lista de pacientes', icon: Users, category: 'navigation', action: () => navigate('/pacientes'), keywords: ['pacientes', 'buscar', 'lista'] },
    { id: 'nav-consultas', label: 'Consultas', description: 'Consultas por vídeo', icon: Video, category: 'navigation', action: () => navigate('/consultas'), keywords: ['video', 'telemedicina'] },
    { id: 'nav-notificacoes', label: 'Notificações', description: 'Alertas e avisos', icon: Bell, category: 'navigation', action: () => navigate('/notificacoes'), keywords: ['alertas', 'avisos'] },
    { id: 'nav-perfil', label: 'Meu Perfil', description: 'Dados profissionais e certificado', icon: User, category: 'navigation', action: () => navigate('/perfil'), keywords: ['conta', 'crm', 'certificado'] },

    // Actions
    { id: 'act-refresh', label: 'Atualizar dados', description: 'Recarregar perfil e notificações', icon: RefreshCw, category: 'action', action: () => handleRefreshData(), keywords: ['refresh', 'recarregar', 'atualizar'] },
    { id: 'act-darkmode', label: isDark ? 'Modo claro' : 'Modo escuro', description: 'Alternar tema da interface', icon: isDark ? Sun : Moon, category: 'action', action: () => onToggleDarkMode?.(), keywords: ['tema', 'theme', 'dark', 'light', 'noite'] },
    { id: 'act-password', label: 'Alterar senha', description: 'Modificar sua senha de acesso', icon: Lock, category: 'action', action: () => navigate('/perfil'), keywords: ['senha', 'password', 'segurança'] },
    { id: 'act-certificate', label: 'Certificado digital', description: 'Gerenciar certificado ICP-Brasil', icon: Shield, category: 'action', action: () => navigate('/perfil'), keywords: ['pfx', 'p12', 'assinatura', 'icp'] },
    { id: 'act-logout', label: 'Sair', description: 'Encerrar sessão', icon: LogOut, category: 'action', action: () => signOut(), keywords: ['logout', 'deslogar'] },

    // Shortcuts info
    { id: 'short-search', label: 'Buscar (Cmd+K)', description: 'Abrir busca rápida', icon: Search, category: 'shortcut', action: () => {}, keywords: ['atalho'] },
    { id: 'short-nav', label: 'Navegar (↑↓ Enter)', description: 'Selecionar com teclado', icon: Keyboard, category: 'shortcut', action: () => {}, keywords: ['atalho'] },
  ], [navigate, isDark, onToggleDarkMode, signOut, handleRefreshData]);

  const patientItems: CommandItem[] = useMemo(() =>
    recentPatients.map((p) => ({
      id: `patient-${p.patientId}`,
      label: p.patientName,
      description: 'Abrir prontuário',
      icon: User,
      category: 'patient' as const,
      action: () => navigate(`/paciente/${p.patientId}`),
      keywords: [p.patientName],
    })),
  [recentPatients, navigate]);

  const allItems = useMemo(() => [...baseItems.filter(i => i.category !== 'patient'), ...patientItems], [baseItems, patientItems]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems.filter(i => i.category !== 'shortcut');
    const q = query.toLowerCase();
    return allItems.filter(i => {
      const searchable = [i.label, i.description, ...(i.keywords || [])].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }, [allItems, query]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getRequests({ page: 1, pageSize: 50 })
      .then((data) => {
        if (!cancelled) {
          const list = parseApiList<MedicalRequest>(data);
          setRecentPatients(extractRecentPatients(list, 5));
        }
      })
      .catch(() => { if (!cancelled) setRecentPatients([]); });
    return () => { cancelled = true; };
  }, [open]);

  // Reset selection when results change (defer to avoid sync setState in effect)
  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0));
  }, [filtered.length]);

  // Global shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery('');
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      runAndClose(filtered[selectedIndex].action);
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  const grouped = {
    navigation: filtered.filter(i => i.category === 'navigation'),
    patient: filtered.filter(i => i.category === 'patient'),
    action: filtered.filter(i => i.category === 'action'),
    shortcut: filtered.filter(i => i.category === 'shortcut'),
  };

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150 w-full h-full cursor-default"
        onClick={() => { setOpen(false); setQuery(''); }}
        aria-label="Fechar busca"
      />

      {/* Palette */}
      <div className="fixed inset-x-0 top-[15%] z-[101] flex justify-center px-4">
        <div
          className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200"
          role="dialog"
          aria-label="Busca rápida"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar páginas, ações, atalhos..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 py-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono border border-border/50">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2" role="listbox">
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhum resultado para &quot;{query}&quot;</p>
              </div>
            ) : (
              <>
                {grouped.navigation.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Navegação
                    </p>
                    {grouped.navigation.map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => runAndClose(item.action)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                            globalIdx === selectedIndex
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground hover:bg-muted/50',
                          )}
                          role="option"
                          aria-selected={globalIdx === selectedIndex}
                        >
                          <div className={cn(
                            'p-2 rounded-lg shrink-0',
                            globalIdx === selectedIndex ? 'bg-primary/10' : 'bg-muted',
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <ArrowRight className={cn(
                            'h-3.5 w-3.5 shrink-0 transition-opacity',
                            globalIdx === selectedIndex ? 'opacity-100 text-primary' : 'opacity-0',
                          )} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {grouped.patient.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Pacientes recentes
                    </p>
                    {grouped.patient.map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => runAndClose(item.action)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                            globalIdx === selectedIndex
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground hover:bg-muted/50',
                          )}
                          role="option"
                          aria-selected={globalIdx === selectedIndex}
                        >
                          <div className={cn(
                            'p-2 rounded-lg shrink-0',
                            globalIdx === selectedIndex ? 'bg-primary/10' : 'bg-muted',
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <ArrowRight className={cn(
                            'h-3.5 w-3.5 shrink-0 transition-opacity',
                            globalIdx === selectedIndex ? 'opacity-100 text-primary' : 'opacity-0',
                          )} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {grouped.action.length > 0 && (
                  <div className="mb-1">
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Ações
                    </p>
                    {grouped.action.map((item) => {
                      const globalIdx = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => runAndClose(item.action)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
                            globalIdx === selectedIndex
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground hover:bg-muted/50',
                          )}
                          role="option"
                          aria-selected={globalIdx === selectedIndex}
                        >
                          <div className={cn(
                            'p-2 rounded-lg shrink-0',
                            globalIdx === selectedIndex ? 'bg-primary/10' : 'bg-muted',
                          )}>
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <Zap className={cn(
                            'h-3.5 w-3.5 shrink-0 transition-opacity',
                            globalIdx === selectedIndex ? 'opacity-100 text-primary' : 'opacity-0',
                          )} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 font-mono">↑↓</kbd> navegar</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 font-mono">↵</kbd> selecionar</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 font-mono">esc</kbd> fechar</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded bg-muted border border-border/50 font-mono">⌘K</kbd> busca rápida
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
