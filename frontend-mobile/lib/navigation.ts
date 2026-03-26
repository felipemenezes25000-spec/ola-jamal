/**
 * Typed Navigation Helpers
 *
 * Wraps Expo Router's push/replace with proper typing to eliminate
 * `as any` casts throughout the codebase.
 *
 * Usage:
 *   import { nav } from '../lib/navigation';
 *   nav.push(router, '/request-detail/123');
 *   nav.replace(router, '/(doctor)/dashboard');
 */

import type { Router } from 'expo-router';

type AnyRouter = Pick<Router, 'push' | 'replace' | 'back'>;

/**
 * Known app routes — extend as new routes are added.
 * This allows type-safe navigation without `as any`.
 */
export type AppRoute =
  // Auth
  | '/(auth)/login'
  | '/(auth)/register'
  | '/(auth)/complete-doctor'
  | '/(auth)/complete-profile'
  | '/(auth)/forgot-password'
  | '/(auth)/reset-password'
  // Patient
  | '/(patient)/home'
  | '/(patient)/requests'
  | '/(patient)/profile'
  | '/(patient)/record'
  | '/(patient)/notifications'
  // Doctor
  | '/(doctor)/dashboard'
  | '/(doctor)/requests'
  | '/(doctor)/profile'
  | '/(doctor)/notifications'
  // Shared
  | '/onboarding'
  | '/terms'
  | '/privacy'
  | '/help-faq'
  | '/settings'
  | '/about'
  | '/change-password'
  | '/dados'
  | '/certificate/upload'
  | '/new-request/prescription'
  | '/new-request/exam'
  | '/new-request/consultation'
  | '/doctor-requests'
  // Dynamic routes (template literals)
  | `/request-detail/${string}`
  | `/doctor-request/${string}`
  | `/doctor-request/editor/${string}`
  | `/video/${string}`
  | `/consultation-summary/${string}`
  | `/post-consultation-emit/${string}`
  | `/doctor-patient/${string}`
  | `/doctor-patient-summary/${string}`;

export const nav = {
  push(router: AnyRouter, route: AppRoute) {
    router.push(route as any);
  },
  replace(router: AnyRouter, route: AppRoute) {
    router.replace(route as any);
  },
};
