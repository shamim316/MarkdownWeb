/** localStorage helpers that never throw (private mode, blocked storage, quota). */

export function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const DRAFT_KEY = 'markdownweb:draft';
export const PREFS_KEY = 'markdownweb:prefs';

export interface Draft {
  content: string;
  fileName: string;
  savedAt: number;
}

export type ThemePref = 'system' | 'light' | 'dark';
export type ViewMode = 'split' | 'editor' | 'preview';

export interface Prefs {
  theme: ThemePref;
  split: number;
  view: ViewMode;
  scrollSync: boolean;
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', split: 0.5, view: 'split', scrollSync: true };
