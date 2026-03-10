/**
 * DoctorApp — Entry point do portal do médico.
 *
 * Premium features integradas:
 * - Command Palette (Cmd+K)
 * - Dark mode com persistência
 * - Keyboard shortcuts (Cmd+1-5, Cmd+D)
 * - Skeleton loading (ao invés de spinner)
 * - Page transitions (framer-motion)
 * - Shortcuts help dialog (Cmd+/)
 */
import { lazy, Suspense, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { DoctorAuthProvider, useDoctorAuth } from '@/contexts/DoctorAuthContext';
import { CommandPalette } from '@/components/doctor/CommandPalette';
import { ShortcutsDialog } from '@/components/doctor/ShortcutsDialog';
import { OfflineBanner } from '@/components/doctor/OfflineBanner';
import { SkeletonPage } from '@/components/ui/skeleton';
import { useTheme } from '@/hooks/useTheme';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { AnimatePresence, motion } from 'framer-motion';

const DoctorLogin = lazy(() => import('@/pages/doctor/DoctorLogin'));
const DoctorRegister = lazy(() => import('@/pages/doctor/DoctorRegister'));
const DoctorDashboard = lazy(() => import('@/pages/doctor/DoctorDashboard'));
const DoctorRequests = lazy(() => import('@/pages/doctor/DoctorRequests'));
const DoctorRequestDetail = lazy(() => import('@/pages/doctor/DoctorRequestDetail'));
const DoctorRequestEditor = lazy(() => import('@/pages/doctor/DoctorRequestEditor'));
const DoctorConsultations = lazy(() => import('@/pages/doctor/DoctorConsultations'));
const DoctorPatientRecord = lazy(() => import('@/pages/doctor/DoctorPatientRecord'));
const DoctorNotifications = lazy(() => import('@/pages/doctor/DoctorNotifications'));
const DoctorProfile = lazy(() => import('@/pages/doctor/DoctorProfile'));
const DoctorVideoCall = lazy(() => import('@/pages/doctor/DoctorVideoCall'));
const DoctorConsultationSummary = lazy(() => import('@/pages/doctor/DoctorConsultationSummary'));
const DoctorCompleteDoctor = lazy(() => import('@/pages/doctor/DoctorCompleteDoctor'));

function FullPageLoader() {
  return <SkeletonPage />;
}

/** Wrapper com animação de transição entre páginas */
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function DoctorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, profileComplete } = useDoctorAuth();

  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!profileComplete) return <Navigate to="/completar-cadastro" replace />;
  return <PageTransition>{children}</PageTransition>;
}

function DoctorLoginOrRedirect() {
  const { isAuthenticated, loading, profileComplete } = useDoctorAuth();
  if (loading) return <FullPageLoader />;
  if (isAuthenticated) return <Navigate to={profileComplete ? '/dashboard' : '/completar-cadastro'} replace />;
  return <DoctorLogin />;
}

function DoctorCompleteOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, profileComplete } = useDoctorAuth();
  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profileComplete) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Shell principal — inclui command palette, shortcuts, e dark mode */
function DoctorShell() {
  const { isDark, toggleDarkMode } = useTheme();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const location = useLocation();

  useKeyboardShortcuts({
    onToggleDarkMode: toggleDarkMode,
    onShowShortcuts: () => setShortcutsOpen(true),
  });

  return (
    <>
      <OfflineBanner />
      {/* Command Palette — always available */}
      <CommandPalette onToggleDarkMode={toggleDarkMode} isDark={isDark} />

      {/* Shortcuts help dialog */}
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Routes */}
      <Suspense fallback={<FullPageLoader />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={<DoctorLoginOrRedirect />} />
            <Route path="/registro" element={<DoctorRegister />} />
            <Route path="/completar-cadastro" element={<DoctorCompleteOnlyRoute><DoctorCompleteDoctor /></DoctorCompleteOnlyRoute>} />

            <Route path="/" element={<DoctorProtectedRoute><DoctorDashboard /></DoctorProtectedRoute>} />
            <Route path="/dashboard" element={<DoctorProtectedRoute><DoctorDashboard /></DoctorProtectedRoute>} />
            <Route path="/pedidos" element={<DoctorProtectedRoute><DoctorRequests /></DoctorProtectedRoute>} />
            <Route path="/pedidos/:id" element={<DoctorProtectedRoute><DoctorRequestDetail /></DoctorProtectedRoute>} />
            <Route path="/pedidos/:id/editor" element={<DoctorProtectedRoute><DoctorRequestEditor /></DoctorProtectedRoute>} />
            <Route path="/consultas" element={<DoctorProtectedRoute><DoctorConsultations /></DoctorProtectedRoute>} />
            <Route path="/paciente/:patientId" element={<DoctorProtectedRoute><DoctorPatientRecord /></DoctorProtectedRoute>} />
            <Route path="/notificacoes" element={<DoctorProtectedRoute><DoctorNotifications /></DoctorProtectedRoute>} />
            <Route path="/perfil" element={<DoctorProtectedRoute><DoctorProfile /></DoctorProtectedRoute>} />
            <Route path="/video/:requestId" element={<DoctorProtectedRoute><DoctorVideoCall /></DoctorProtectedRoute>} />
            <Route path="/resumo-consulta/:requestId" element={<DoctorProtectedRoute><DoctorConsultationSummary /></DoctorProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </>
  );
}

export default function DoctorApp() {
  return (
    <DoctorAuthProvider>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          className: 'shadow-lg',
          duration: 4000,
        }}
      />
      <DoctorShell />
    </DoctorAuthProvider>
  );
}
