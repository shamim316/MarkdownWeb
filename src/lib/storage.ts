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

export type ThemePref = 'system' | 'light' | 'grey' | 'dark';
/** The theme actually applied to the page. */
export type ResolvedTheme = 'light' | 'grey' | 'dark';
export type ViewMode = 'split' | 'editor' | 'preview';

export interface Prefs {
  theme: ThemePref;
  split: number;
  view: ViewMode;
  scrollSync: boolean;
  editorFontSize: number;
}

export const FONT_SIZE = { min: 10, max: 32, default: 14 } as const;

export function clampFontSize(size: number): number {
  return Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(size)));
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'system',
  split: 0.5,
  view: 'split',
  scrollSync: true,
  editorFontSize: FONT_SIZE.default,
};
