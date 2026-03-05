/**
 * GlobalAssistantBanner — Dra. Renoveja em todas as telas (exceto pagamento)
 *
 * Renderiza no layout raiz. Esconde em: /payment, auth (login/registro), splash.
 * Integra "Tire dúvidas" no estado companion.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { DraggableAssistantBanner } from './DraggableAssistantBanner';
import type { CTAAction } from '../../lib/triage/triage.types';
import { theme } from '../../lib/theme';

function shouldHideBanner(
  pathname: string | null | undefined,
  isLoggedIn: boolean,
  userRole?: string | null
): boolean {
  // Usuário não logado — esconde (auth ainda não carregou ou não está logado)
  if (!isLoggedIn) return true;
  // Médico: nunca mostrar Dra. Renoveja nas telas do médico (fallback por role)
  if (userRole === 'doctor') return true;
  // Pathname vazio/undefined — pode ser hidratação inicial; mostra por segurança
  if (!pathname || typeof pathname !== 'string') return false;
  // Telas de pagamento (dados privados)
  if (pathname.includes('/payment')) return true;
  // Vídeo e telas de resumo/plano: evitar sobreposição com controles críticos e modais
  if (
    pathname.includes('/video') ||
    pathname.includes('/consultation-summary') ||
    pathname.includes('/care-plans') ||
    pathname.includes('/request-detail/')
  ) return true;
  // Auth: login, registro, etc.
  if (pathname.includes('(auth)') || pathname.includes('login') || pathname.includes('register') ||
      pathname.includes('complete-') || pathname.includes('forgot-password') || pathname.includes('reset-password')) return true;
  // Splash / index (rota raiz)
  if (pathname === '/' || pathname === '/index' || pathname === '') return true;
  // Já na tela de ajuda — evita empilhar infinitas instâncias ao tocar no banner
  if (pathname.includes('help-faq')) return true;
  // Notificações/Alertas — ícone flutuante sobrepõe os cards de notificação
  if (pathname.includes('notifications')) return true;
  // Painel do médico e rotas médico: doctor-request, doctor-patient, doctor-patient-summary, certificate
  if (pathname.includes('(doctor)') || pathname.includes('doctor-') || pathname.includes('certificate/')) return true;
  return false;
}

export function GlobalAssistantBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isLoggedIn = !!user;

  if (shouldHideBanner(pathname, isLoggedIn, user?.role)) return null;

  const handleAction: (action: CTAAction) => void = (action) => {
    if (!action) return;
    if (action === 'teleconsulta' || action === 'consulta_breve' || action === 'agendar_retorno') {
      router.push('/new-request/consultation');
    }
    if (action === 'ver_servicos') {
      if (user?.role === 'patient') router.push('/(patient)/requests');
      else router.push('/(doctor)/dashboard');
    }
    if (action === 'renovar_receita') {
      router.push('/new-request/prescription');
    }
    if (action === 'pedir_exames') {
      router.push('/new-request/exam');
    }
    if (action === 'tire_duvidas') {
      router.push('/help-faq');
    }
  };

  const handleCompanionPress = () => {
    // Evita empilhar help-faq quando já está na tela (proteção extra)
    if (pathname?.includes('help-faq')) return;
    router.push('/help-faq');
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <DraggableAssistantBanner
        onAction={handleAction}
        onCompanionPress={handleCompanionPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    // Mantém acima do conteúdo normal, mas abaixo de modais nativos.
    zIndex: theme.zIndex.fixed,
    pointerEvents: 'box-none',
  },
});
