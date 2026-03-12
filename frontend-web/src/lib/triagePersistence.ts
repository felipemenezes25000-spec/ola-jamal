/**
 * Persistência de estado do assistente (web).
 * Alinhado ao mobile triagePersistence — mutedKeys, unmuteAll, getMutedKeys.
 */
const STORAGE_KEY = 'renoveja:triage_v2';

interface TriageState {
  mutedKeys: string[];
  version: number;
}

function load(): TriageState {
  if (typeof window === 'undefined') return { mutedKeys: [], version: 2 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mutedKeys: [], version: 2 };
    const parsed = JSON.parse(raw) as TriageState;
    return {
      mutedKeys: Array.isArray(parsed.mutedKeys) ? parsed.mutedKeys : [],
      version: parsed.version ?? 2,
    };
  } catch {
    return { mutedKeys: [], version: 2 };
  }
}

function save(state: TriageState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* silent */
  }
}

export async function getMutedKeys(): Promise<string[]> {
  const state = load();
  return [...state.mutedKeys];
}

export async function unmuteAll(): Promise<void> {
  save({ mutedKeys: [], version: 2 });
}
