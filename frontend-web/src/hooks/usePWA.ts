/**
 * Hook para PWA: registro do Service Worker e prompt de instalação.
 * Só ativa no subdomínio do médico (medico.*).
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Check iOS (iOS doesn't fire beforeinstallprompt)
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isiOS && !isStandalone);

    // Register service worker only on doctor portal
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (import.meta.env.DEV) console.log('[PWA] Service Worker registered:', reg.scope);
          // Check for updates periodically
          updateIntervalRef.current = setInterval(() => reg.update(), 60 * 60 * 1000);
        })
        .catch((err) => {
          if (import.meta.env.DEV) console.warn('[PWA] SW registration failed:', err);
        });
    }

    // Listen for install prompt (Chrome, Edge, Samsung)
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detect when app was installed
    const installedHandler = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPromptRef.current = null;
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return false;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;

    if (outcome === 'accepted') {
      setCanInstall(false);
      setIsInstalled(true);
      deferredPromptRef.current = null;
      return true;
    }
    return false;
  }, []);

  return {
    canInstall,
    isInstalled,
    isIOS,
    promptInstall,
    /** True if running as installed PWA */
    isStandalone: isInstalled,
  };
}
