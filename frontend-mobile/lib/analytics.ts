import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const QUEUE_STORAGE_KEY = '@renoveja:analytics_queue';
const SESSION_STORAGE_KEY = '@renoveja:analytics_session';
const FLUSH_INTERVAL_MS = 30_000;
const FLUSH_THRESHOLD = 20;
const MAX_QUEUE_SIZE = 500;

type FunnelStep =
  | 'registration_started'
  | 'registration_completed'
  | 'registration_failed'
  | 'login_started'
  | 'login_completed'
  | 'login_failed'
  | 'request_started'
  | 'request_completed'
  | 'request_failed'
  | 'payment_started'
  | 'payment_pix_generated'
  | 'payment_card_submitted'
  | 'payment_completed'
  | 'payment_failed'
  | 'signing_started'
  | 'signing_completed'
  | 'signing_failed'
  | 'download_started'
  | 'download_completed'
  | 'record_opened'
  | 'record_section_viewed';

interface AnalyticsEvent {
  event: string;
  timestamp: string;
  sessionId: string;
  device: DeviceInfo;
  properties: Record<string, unknown>;
}

interface DeviceInfo {
  platform: string;
  osVersion: string | null;
  appVersion: string | null;
  deviceModel: string | null;
}

function generateId(): string {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * 16)];
  }
  return id;
}

function getDeviceInfo(): DeviceInfo {
  return {
    platform: Platform.OS,
    osVersion: Device.osVersion,
    appVersion: Constants.expoConfig?.version ?? null,
    deviceModel: Device.modelName,
  };
}

class FunnelAnalytics {
  private queue: AnalyticsEvent[] = [];
  private sessionId: string = '';
  private deviceInfo: DeviceInfo;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;
  private initialized = false;
  private baseUrl: string;
  private screenEntryTimes: Map<string, number> = new Map();

  constructor() {
    this.deviceInfo = getDeviceInfo();
    this.baseUrl = '';
  }

  async init(baseUrl?: string): Promise<void> {
    if (this.initialized) return;

    if (baseUrl) this.baseUrl = baseUrl;

    this.sessionId = await this.getOrCreateSession();
    await this.restoreQueue();
    this.startFlushTimer();
    this.initialized = true;
  }

  private async getOrCreateSession(): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) {
        const parsed = JSON.parse(existing);
        const age = Date.now() - parsed.createdAt;
        if (age < 30 * 60 * 1000) return parsed.id;
      }
    } catch {}

    const id = generateId();
    try {
      await AsyncStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ id, createdAt: Date.now() }),
      );
    } catch {}
    return id;
  }

  private async restoreQueue(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const restored: AnalyticsEvent[] = JSON.parse(raw);
        this.queue = [...restored, ...this.queue].slice(-MAX_QUEUE_SIZE);
        await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      }
    } catch {}
  }

  private async persistQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {}
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private enqueue(event: string, properties: Record<string, unknown> = {}): void {
    const entry: AnalyticsEvent = {
      event,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId || 'uninitialized',
      device: this.deviceInfo,
      properties,
    };

    this.queue.push(entry);

    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }

    if (this.queue.length >= FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;

    this.isFlushing = true;
    const batch = [...this.queue];
    this.queue = [];

    try {
      const url = this.baseUrl
        ? `${this.baseUrl}/api/analytics/events`
        : '/api/analytics/events';

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });

      if (!res.ok && res.status >= 500) {
        this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE_SIZE);
        await this.persistQueue();
      }
    } catch (err) {
      this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE_SIZE);
      await this.persistQueue();

      if (__DEV__) {
        console.debug('[Analytics] flush failed, events re-queued:', (err as Error)?.message);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  trackFunnel(step: FunnelStep, properties: Record<string, unknown> = {}): void {
    this.enqueue(`funnel.${step}`, properties);
  }

  trackScreenView(screen: string): void {
    this.screenEntryTimes.set(screen, Date.now());
    this.enqueue('navigation.screen_view', { screen });
  }

  trackScreenExit(screen: string): void {
    const entryTime = this.screenEntryTimes.get(screen);
    if (entryTime) {
      const durationMs = Date.now() - entryTime;
      this.screenEntryTimes.delete(screen);
      this.enqueue('navigation.screen_exit', { screen, duration_ms: durationMs });
    }
  }

  trackApiLatency(endpoint: string, durationMs: number, status: number): void {
    this.enqueue('api.latency', {
      endpoint,
      duration_ms: durationMs,
      status,
    });
  }

  trackError(
    type: string,
    message: string,
    screen?: string,
    context?: Record<string, unknown>,
  ): void {
    this.enqueue('error', {
      error_type: type,
      message: message.slice(0, 500),
      screen,
      ...context,
    });
  }

  async onAppBackground(): Promise<void> {
    await this.flush();
    await this.persistQueue();
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }
}

export const analytics = new FunnelAnalytics();

export function trackFunnelEvent(
  step: FunnelStep,
  properties: Record<string, unknown> = {},
): void {
  analytics.trackFunnel(step, properties);
}

export function trackScreenView(screen: string): void {
  analytics.trackScreenView(screen);
}

export function trackScreenExit(screen: string): void {
  analytics.trackScreenExit(screen);
}

export function trackApiLatency(
  endpoint: string,
  durationMs: number,
  status: number,
): void {
  analytics.trackApiLatency(endpoint, durationMs, status);
}

export function trackError(
  type: string,
  message: string,
  screen?: string,
  context?: Record<string, unknown>,
): void {
  analytics.trackError(type, message, screen, context);
}

export type { FunnelStep, AnalyticsEvent, DeviceInfo };
export { FunnelAnalytics };
