import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { DoctorAuthProvider, useDoctorAuth } from '@/contexts/DoctorAuthContext';
import { Loader2 } from 'lucide-react';

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
const DoctorCompleteDoctor = lazy(() => import('@/pages/doctor/DoctorCompleteDoctor'));

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}

function DoctorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, profileComplete } = useDoctorAuth();

  if (loading) return <FullPageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!profileComplete) return <Navigate to="/completar-cadastro" replace />;
  return <>{children}</>;
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

function DoctorRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function DoctorApp() {
  return (
    <DoctorAuthProvider>
      <Toaster position="top-center" richColors closeButton />
      <DoctorRoutes />
    </DoctorAuthProvider>
  );
}
