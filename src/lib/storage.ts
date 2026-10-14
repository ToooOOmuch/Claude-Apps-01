import type { Texts } from "../render/slides";
import type { ThemeId } from "../render/theme";
import type { PeriodStats } from "./types";

export interface SavedState {
  periods: PeriodStats[];
  beforeId: string | null;
  afterId: string | null;
  texts: Texts;
  themeId: ThemeId;
}

const KEY = "jantama-studio:v1";

export const DEFAULT_TEXTS: Texts = {
  title: "学ぶ前と後で、成績はこう変わった",
  beforeLabel: "学ぶ前",
  afterLabel: "学んだ後",
  markerLabel: "ここで学んだ",
  thumbHeadline: "ある学びで激変",
  thumbSub: "和了率はほぼ同じなのに…",
};

/** ブラウザに保存しておいた入力内容を読む。読めなければ null（初回や、保存が禁止された環境） */
export function load(): SavedState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<SavedState>;
    if (!Array.isArray(s.periods)) return null;
    return {
      periods: s.periods,
      beforeId: s.beforeId ?? null,
      afterId: s.afterId ?? null,
      texts: { ...DEFAULT_TEXTS, ...s.texts },
      themeId: s.themeId ?? "dark",
    };
  } catch {
    return null;
  }
}

export function save(state: SavedState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 保存できなくてもアプリは使える
  }
}
