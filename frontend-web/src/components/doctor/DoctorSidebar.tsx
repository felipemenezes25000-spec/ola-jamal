import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/admin/NavLink';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDoctorAuth } from '@/hooks/useDoctorAuth';
import { useNotifications } from '@/contexts/NotificationContext';
import { usePWA } from '@/hooks/usePWA';
import { useWebPush } from '@/hooks/useWebPush';
import {
  LayoutDashboard, FileText, Bell, User, Menu, X, LogOut,
  Stethoscope, Video, Download, Share2, Settings, BellRing, Users, Shield, Inbox,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { to: '/pedidos', label: 'Pedidos', icon: FileText },
  { to: '/fila', label: 'Fila', icon: Inbox },
  { to: '/consultas', label: 'Consultas', icon: Video },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/notificacoes', label: 'Alertas', icon: Bell },
  { to: '/perfil', label: 'Perfil', icon: User },
  { to: '/certificado', label: 'Certificado', icon: Shield },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function DoctorSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useDoctorAuth();
  const { unreadCount } = useNotifications();
  const { canInstall, isIOS, isInstalled, promptInstall } = usePWA();
  const { supported: pushSupported, permission: pushPermission, requestPermission } = useWebPush(isAuthenticated);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(
    () => sessionStorage.getItem('pwa-install-dismissed') === '1',
  );
  const [pushDismissed, setPushDismissed] = useState(
    () => sessionStorage.getItem('push-permission-dismissed') === '1',
  );

  const dismissPush = () => {
    setPushDismissed(true);
    sessionStorage.setItem('push-permission-dismissed', '1');
  };

  const handleEnablePush = async () => {
    const granted = await requestPermission();
    if (granted) setPushDismissed(true);
  };

  const dismissInstall = () => {
    setInstallDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'MD';

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  const isVideoPage = location.pathname.startsWith('/video/');

  // Don't show sidebar/nav on video call page
  if (isVideoPage) return null;

  return (
    <>
      {/* ── Mobile: Hamburger button (top-left) ── */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 md:hidden rounded-xl bg-card/90 backdrop-blur-sm p-2.5 shadow-lg border border-border/50"
        aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* ── Mobile: Backdrop overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Desktop/Tablet: Side drawer ── */}
      <aside
        className={cn(
          'fixed md:sticky top-0 left-0 z-40 h-screen w-64 lg:w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="p-4 lg:p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm shrink-0">
              <Stethoscope className="h-4 w-4 lg:h-5 lg:w-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-0.5">
                <span className="font-bold text-base lg:text-lg text-foreground">Renove</span>
                <span className="font-bold text-base lg:text-lg text-primary">Já</span>
                <span className="text-primary font-bold text-base lg:text-lg">+</span>
              </div>
              <p className="text-[10px] lg:text-xs text-muted-foreground -mt-0.5 truncate">Portal do Médico</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto" aria-label="Menu principal">
          {navItems.map((item) => {
            const isActive =
              item.to === '/dashboard'
                ? location.pathname === '/' || location.pathname === '/dashboard'
                : location.pathname.startsWith(item.to);
            const isAlerts = item.to === '/notificacoes';
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive && 'text-primary')} aria-hidden />
                <span className="truncate">{item.label}</span>
                {isAlerts && unreadCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground animate-in zoom-in-50 duration-200">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* PWA Install Banner (sidebar) */}
        {!isInstalled && !installDismissed && (canInstall || isIOS) && (
          <div className="mx-3 lg:mx-4 mb-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs font-semibold text-foreground mb-1.5">Instalar aplicativo</p>
            <p className="text-[10px] text-muted-foreground mb-2.5 leading-relaxed">
              Adicione o portal como app no seu dispositivo para acesso rápido.
            </p>
            {canInstall ? (
              <div className="flex gap-2">
                <button
                  onClick={promptInstall}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <Download className="h-3 w-3" /> Instalar
                </button>
                <button
                  onClick={dismissInstall}
                  className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Depois
                </button>
              </div>
            ) : isIOS ? (
              <div className="space-y-2">
                <button
                  onClick={() => setShowIOSGuide(!showIOSGuide)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                >
                  <Share2 className="h-3 w-3" /> Como instalar
                </button>
                {showIOSGuide && (
                  <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/50 rounded-lg p-2">
                    <p>1. Toque em <strong>Compartilhar</strong> <Share2 className="h-2.5 w-2.5 inline" /></p>
                    <p>2. Role e toque em <strong>"Adicionar à Tela de Início"</strong></p>
                    <p>3. Toque em <strong>Adicionar</strong></p>
                  </div>
                )}
                <button onClick={dismissInstall} className="w-full text-[10px] text-muted-foreground">
                  Não mostrar novamente
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Push Notification Banner */}
        {pushSupported && pushPermission === 'default' && !pushDismissed && (
          <div className="mx-3 lg:mx-4 mb-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5 text-primary" />
              Ativar alertas
            </p>
            <p className="text-[10px] text-muted-foreground mb-2.5 leading-relaxed">
              Receba notificações de novos pedidos mesmo com a aba minimizada.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleEnablePush}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Bell className="h-3 w-3" /> Ativar
              </button>
              <button
                onClick={dismissPush}
                className="px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Depois
              </button>
            </div>
          </div>
        )}

        {/* User info + logout */}
        <div className="p-3 lg:p-4 border-t border-sidebar-border space-y-3">
          {user && (
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 relative overflow-hidden ring-2 ring-primary/20">
                <span className="text-[10px] lg:text-xs font-bold text-primary">{initials}</span>
                {user.avatarUrl && (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="absolute inset-0 w-full h-full rounded-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs lg:text-sm font-medium truncate">{user.name}</p>
                <p className="text-[10px] lg:text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs lg:text-sm text-muted-foreground hover:text-destructive transition-colors w-full px-1 py-1.5 rounded-lg hover:bg-destructive/5"
          >
            <LogOut className="h-3.5 w-3.5 lg:h-4 lg:w-4" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
       *  Mobile: Bottom Tab Navigation
       *  Visible only on small screens, acts like a native app
       * ══════════════════════════════════════════════════════ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-card/95 backdrop-blur-lg border-t border-border/50 safe-area-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navegação principal"
      >
        <div className="flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
            const isActive =
              item.to === '/dashboard'
                ? location.pathname === '/' || location.pathname === '/dashboard'
                : location.pathname.startsWith(item.to);
            const isAlerts = item.to === '/notificacoes';
            return (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 min-w-[56px]',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:scale-95',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="relative">
                  <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} aria-hidden />
                  {isAlerts && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold bg-destructive text-destructive-foreground">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium leading-tight',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
