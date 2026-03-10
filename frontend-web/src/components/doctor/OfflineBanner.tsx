/**
 * Banner fixo no topo quando o usuário está offline.
 * Alinhado ao mobile (OfflineBanner).
 */
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected !== false) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[999] flex items-center justify-center gap-2 bg-destructive text-destructive-foreground py-2 px-4"
      role="alert"
      aria-live="assertive"
      aria-label="Sem conexão com a internet"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span className="text-sm font-semibold">Sem conexão com a internet</span>
    </div>
  );
}
