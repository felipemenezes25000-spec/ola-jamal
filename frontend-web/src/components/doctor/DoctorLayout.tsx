import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DoctorSidebar } from './DoctorSidebar';

interface DoctorLayoutProps {
  children: ReactNode;
  /** Hide sidebar and bottom nav (e.g. video call page) */
  fullscreen?: boolean;
}

export function DoctorLayout({ children, fullscreen }: DoctorLayoutProps) {
  const { pathname } = useLocation();

  if (fullscreen) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DoctorSidebar />
      <main className="flex-1 overflow-auto min-w-0">
        {/*
          Padding responsive:
          - Mobile: pt-14 (below hamburger), pb-20 (above bottom nav), px-4
          - Tablet: p-6 normal (sidebar visible, no bottom nav)
          - Desktop: p-8 comfortable
        */}
        <div key={pathname} className="page-enter pt-14 md:pt-0 pb-20 md:pb-0 px-4 sm:px-5 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
