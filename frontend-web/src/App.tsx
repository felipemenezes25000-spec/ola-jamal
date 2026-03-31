import { AdminSubdomainRedirect } from '@/components/AdminSubdomainRedirect';
import { isAuthenticated, validateAdminToken } from '@/services/adminApi';
import { Loader2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

const DoctorApp = lazy(() => import('@/DoctorApp'));
const Index = lazy(() => import('@/pages/Index'));
const Verify = lazy(() => import('@/pages/Verify'));
const RecuperarSenha = lazy(() => import('@/pages/RecuperarSenha'));
const Cookies = lazy(() => import('@/pages/Cookies'));
const PublicPrivacy = lazy(() => import('@/pages/PublicPrivacy'));
const PublicTerms = lazy(() => import('@/pages/PublicTerms'));
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminMedicos = lazy(() => import('@/pages/admin/AdminMedicos'));
const AdminFinanceiro = lazy(() => import('@/pages/admin/AdminFinanceiro'));
const AdminRelatorios = lazy(() => import('@/pages/admin/AdminRelatorios'));
const AdminConfiguracoes = lazy(() => import('@/pages/admin/AdminConfiguracoes'));
const AdminNotFound = lazy(() => import('@/pages/admin/AdminNotFound'));

// Detecta se a sessão atual deve renderizar o portal médico.
//
// Ordem de prioridade:
//   1. Variável de ambiente VITE_PORTAL=doctor  →  sempre portal médico
//      (setar em .env.local para dev sem query param toda vez)
//   2. Subdomínio medico.*  →  produção
//   3. Query param ?portal=doctor  →  dev/staging explícito
//   4. Path conhecido de rota do médico  →  dev com rota direta
//
// REMOVIDO: detecção via localStorage — frágil e desnecessária porque
// as rotas do médico (/dashboard, /pedidos, etc.) já são detectadas pelo path.
function isDoctorPortal(): boolean {
  const path = window.location.pathname;
  const host = window.location.hostname;

  // Admin é sempre o app admin, nunca médico
  if (path.startsWith('/admin')) return false;

  // 1. Variável de build/env — máxima prioridade em dev
  if (import.meta.env.VITE_PORTAL === 'doctor') return true;

  // 2. Subdomínio medico.* — SEMPRE portal do médico (inclusive em /)
  if (host === 'medico.renovejasaude.com.br' || host.startsWith('medico.'))
    return true;

  // Rotas públicas no domínio principal — nunca portal médico
  if (
    path === '/' ||
    path.startsWith('/verify') ||
    path.startsWith('/recuperar-senha') ||
    path.startsWith('/cookies') ||
    path.startsWith('/privacidade') ||
    path.startsWith('/termos')
  )
    return false;

  // 3. Query param explícito — dev/staging
  if (new URLSearchParams(window.location.search).get('portal') === 'doctor')
    return true;

  // 4. Path de rota do médico — dev com URL direta
  if (host === 'localhost' || host === '127.0.0.1') {
    const doctorPaths = [
      '/login',
      '/registro',
      '/dashboard',
      '/pedidos',
      '/consultas',
      '/pacientes',
      '/notificacoes',
      '/perfil',
      '/video',
      '/configuracoes',
      '/certificado',
      '/fila',
      '/sobre',
      '/ajuda',
      '/termos',
      '/privacidade',
      '/completar-cadastro',
      '/resumo-consulta',
      '/paciente',
    ];
    return doctorPaths.some((dp) => path === dp || path.startsWith(dp + '/'));
  }

  return false;
}

function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>(() =>
    isAuthenticated() ? 'checking' : 'invalid'
  );

  useEffect(() => {
    if (status !== 'checking') return;
    const controller = new AbortController();
    validateAdminToken(controller.signal).then((ok) => {
      if (!controller.signal.aborted) setStatus(ok ? 'valid' : 'invalid');
    });
    return () => controller.abort();
  }, [status]);

  if (status === 'invalid') return <Navigate to="/admin/login" replace />;
  if (status === 'checking') return <FallbackLoader />;
  return <>{children}</>;
}

function FallbackLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  if (isDoctorPortal()) {
    return (
      <Suspense fallback={<FallbackLoader />}>
        <DoctorApp />
      </Suspense>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <AdminSubdomainRedirect />
      <Suspense fallback={<FallbackLoader />}>
        <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/verify/:id" element={<Verify />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/cookies" element={<Cookies />} />
        <Route path="/privacidade" element={<PublicPrivacy />} />
        <Route path="/termos" element={<PublicTerms />} />

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/medicos"
          element={
            <AdminProtectedRoute>
              <AdminMedicos />
            </AdminProtectedRoute>
          }
        />

        {/* Financeiro — submenu */}
        <Route
          path="/admin/financeiro"
          element={<Navigate to="/admin/financeiro/simulacoes" replace />}
        />
        <Route
          path="/admin/financeiro/simulacoes"
          element={
            <AdminProtectedRoute>
              <AdminFinanceiro />
            </AdminProtectedRoute>
          }
        />
        <Route
          path="/admin/financeiro/relatorios"
          element={
            <AdminProtectedRoute>
              <AdminRelatorios />
            </AdminProtectedRoute>
          }
        />

        <Route
          path="/admin/configuracoes"
          element={
            <AdminProtectedRoute>
              <AdminConfiguracoes />
            </AdminProtectedRoute>
          }
        />
        <Route path="/admin/*" element={<AdminNotFound />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
