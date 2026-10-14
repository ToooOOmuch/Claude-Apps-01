export type ThemeId = "dark" | "light" | "chroma";

export interface Theme {
  id: ThemeId;
  name: string;
  /** 画面全体の背景 */
  background: string;
  /** 図を載せる板（クロマキーのときだけ背景と違う色になる） */
  panel: string | null;
  text: string;
  subText: string;
  mutedText: string;
  grid: string;
  /** 1位〜4位（良い順位は青、悪い順位は赤） */
  rank: [string, string, string, string];
  /** 順位の帯の上に乗せる文字の色 */
  rankLabel: [string, string, string, string];
  /** 「後」を目立たせる色 */
  accent: string;
  /** 「前」の色（控えめ） */
  before: string;
  good: string;
  bad: string;
}

const DARK: Omit<Theme, "id" | "name" | "background" | "panel"> = {
  text: "#f3f2ee",
  subText: "#c4c2b8",
  mutedText: "#8d8b84",
  grid: "#33363d",
  rank: ["#3d8bf0", "#8cc0ff", "#ffae7a", "#f0574a"],
  rankLabel: ["#ffffff", "#0b1a2e", "#2e1608", "#ffffff"],
  accent: "#ffc94a",
  before: "#8d8b84",
  good: "#4cc38a",
  bad: "#f0574a",
};

export const THEMES: Record<ThemeId, Theme> = {
  dark: { id: "dark", name: "ダーク", background: "#14161b", panel: null, ...DARK },
  light: {
    id: "light",
    name: "ライト",
    background: "#fbfaf7",
    panel: null,
    text: "#111111",
    subText: "#4f4e4a",
    mutedText: "#8a8983",
    grid: "#e3e1db",
    rank: ["#1f63c4", "#5fa0ea", "#f2905f", "#d23a2f"],
    rankLabel: ["#ffffff", "#0b1a2e", "#2e1608", "#ffffff"],
    accent: "#d9480f",
    before: "#9a9993",
    good: "#0b8a3e",
    bad: "#d23a2f",
  },
  // 動画編集で背景を抜く用。図は暗い板の上に描くので、抜いた後も読みやすい
  chroma: { id: "chroma", name: "グリーンバック", background: "#00b140", panel: "#14161b", ...DARK },
};

export const FONT_FAMILY = `"Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif`;
