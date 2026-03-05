/**
 * triagePersistence.ts — Persistência de estado do assistente
 *
 * AsyncStorage com cache in-memory, versionamento, e cleanup automático.
 * Cooldown, dedupe, e mute — tudo persistente entre sessões.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TriagePersistedState, BannerPositionMode, BannerFloatingPosition } from './triage.types';

const STORAGE_KEY = '@renoveja:triage_v2';
const CURRENT_VERSION = 2;
const MAX_COOLDOWN_ENTRIES = 200; // Evita crescimento ilimitado

// ── In-memory cache ─────────────────────────────────────────

let _cache: TriagePersistedState | null = null;
let _dirty = false;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function defaultState(): TriagePersistedState {
  return { cooldowns: {}, mutedKeys: [], sessionCounts: {}, version: CURRENT_VERSION };
}

// ── Load / Save ─────────────────────────────────────────────

async function load(): Promise<TriagePersistedState> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) { _cache = defaultState(); return _cache; }

    const parsed = JSON.parse(raw) as TriagePersistedState;

    // Version migration
    if (!parsed.version || parsed.version < CURRENT_VERSION) {
      _cache = { ...defaultState(), mutedKeys: parsed.mutedKeys || [] };
    } else {
      _cache = parsed;
    }

    // Cleanup expired cooldowns (older than 30 days)
    const cutoff = Date.now() - 30 * 24 * 3600_000;
    const entries = Object.entries(_cache.cooldowns);
    if (entries.length > MAX_COOLDOWN_ENTRIES) {
      const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_COOLDOWN_ENTRIES);
      _cache.cooldowns = Object.fromEntries(sorted.filter(([, ts]) => ts > cutoff));
      _dirty = true;
    }
  } catch {
    _cache = defaultState();
  }
  return _cache;
}

/** Debounced save — não bloqueia a UI */
function scheduleSave(): void {
  if (_saveTimer) return;
  _dirty = true;
  _saveTimer = setTimeout(async () => {
    _saveTimer = null;
    if (!_dirty || !_cache) return;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_cache));
      _dirty = false;
    } catch { /* Silent */ }
  }, 500);
}

// ── Public API ──────────────────────────────────────────────

/** Verifica se uma mensagem pode ser exibida (não em cooldown e não mutada). */
export async function canShow(key: string, cooldownMs: number): Promise<boolean> {
  const state = await load();

  // Check muted
  if (state.mutedKeys.includes(key)) return false;

  // Check cooldown
  const lastShown = state.cooldowns[key];
  if (lastShown && Date.now() - lastShown < cooldownMs) return false;

  // Session count: permite 1 por "visita" à tela; resetSessionCounts limpa ao abrir o app
  const sessionMax = 1;
  if ((state.sessionCounts[key] || 0) >= sessionMax) return false;

  return true;
}

/** Marca mensagem como exibida (atualiza cooldown e session count). */
export async function markShown(key: string): Promise<void> {
  const state = await load();
  state.cooldowns[key] = Date.now();
  state.sessionCounts[key] = (state.sessionCounts[key] || 0) + 1;
  scheduleSave();
}

/** Muta permanentemente uma mensagem ("Não mostrar novamente"). */
export async function muteKey(key: string): Promise<void> {
  const state = await load();
  if (!state.mutedKeys.includes(key)) {
    state.mutedKeys.push(key);
    scheduleSave();
  }
}

/** Desmuta uma mensagem. */
export async function unmuteKey(key: string): Promise<void> {
  const state = await load();
  state.mutedKeys = state.mutedKeys.filter(k => k !== key);
  scheduleSave();
}

/** Reseta contagem de sessão para uma key (chamar ao sair da tela). Permite dicas ao voltar. */
export async function resetSessionCountForKey(key: string): Promise<void> {
  await load();
  if (_cache && _cache.sessionCounts[key]) {
    delete _cache.sessionCounts[key];
    _dirty = true;
    scheduleSave();
  }
}

/** Limpa contagem de sessão (chamar ao abrir o app). Permite que mensagens apareçam novamente na nova sessão. */
export async function resetSessionCounts(): Promise<void> {
  await load(); // Garante que _cache está carregado
  if (_cache) {
    _cache.sessionCounts = {};
    _dirty = true;
    scheduleSave();
  }
}

/** Reset tudo (debug/settings). */
export async function clearAll(): Promise<void> {
  _cache = defaultState();
  _dirty = false;
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Retorna lista de keys mutadas (para UI de settings). */
export async function getMutedKeys(): Promise<string[]> {
  const state = await load();
  return [...state.mutedKeys];
}

/** Retorna quantas vezes o usuário visitou a Home. */
export async function getHomeVisitCount(): Promise<number> {
  const state = await load();
  return state.homeVisitCount ?? 0;
}

/** Incrementa contador de visitas à Home. */
export async function incrementHomeVisit(): Promise<void> {
  const state = await load();
  state.homeVisitCount = (state.homeVisitCount ?? 0) + 1;
  scheduleSave();
}

/** Marca InfoCard da home como dismissado (não mostrar mais). */
export async function dismissHomeInfoCard(): Promise<void> {
  const state = await load();
  state.homeInfoCardDismissed = true;
  scheduleSave();
}

/** Verifica se deve mostrar o InfoCard da home (primeiras 5 visitas, não dismissado). */
export async function shouldShowHomeInfoCard(): Promise<boolean> {
  const state = await load();
  if (state.homeInfoCardDismissed) return false;
  const count = state.homeVisitCount ?? 0;
  return count < 5;
}

/** Reativa todas as mensagens mutadas (settings). */
export async function unmuteAll(): Promise<void> {
  const state = await load();
  // Ao reativar, limpamos mutes e também cooldowns / contagem de sessão
  // para a Dra. Renova realmente "voltar a falar" em todas as telas.
  state.mutedKeys = [];
  state.cooldowns = {};
  state.sessionCounts = {};
  scheduleSave();
}

// ── Posição da Dra. Renova (arrastar / acompanhar) ──────────

/** Retorna posição da Dra. Renova: 'fixed' (acompanha no fundo) ou 'floating' (arrastável). */
export async function getBannerPositionMode(): Promise<BannerPositionMode> {
  const state = await load();
  return state.bannerPositionMode ?? 'fixed';
}

/** Define modo da Dra. Renova. */
export async function setBannerPositionMode(mode: BannerPositionMode): Promise<void> {
  const state = await load();
  state.bannerPositionMode = mode;
  scheduleSave();
}

/** Retorna posição flutuante salva (quando modo = floating). */
export async function getBannerFloatingPosition(): Promise<BannerFloatingPosition | null> {
  const state = await load();
  return state.bannerFloatingPosition ?? null;
}

/** Salva posição flutuante da Dra. Renova. */
export async function setBannerFloatingPosition(pos: BannerFloatingPosition): Promise<void> {
  const state = await load();
  state.bannerFloatingPosition = pos;
  scheduleSave();
}
