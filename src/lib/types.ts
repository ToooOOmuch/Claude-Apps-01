/** 牌譜屋の「基本」タブ＋順位分布から読み取る、ある期間の成績 */
export interface PeriodStats {
  id: string;
  /** グラフに出す名前（例: 「学ぶ前」「2025年後半」） */
  label: string;
  startDate: string; // YYYY-MM-DD（不明なら空）
  endDate: string;
  room: string; // 例: 玉
  games: number | null; // 記録対戦数
  recordRank: string; // 記録段位（例: 豪3）
  recordPoints: string; // 記録点数（例: 1148/3600）
  winRate: number | null; // 和了率 %
  dealInRate: number | null; // 放銃率 %
  tsumoRate: number | null; // ツモ率 %
  damaRate: number | null; // ダマ率 %
  drawRate: number | null; // 流局率 %
  drawTenpaiRate: number | null; // 流局聴牌率 %
  callRate: number | null; // 副露率 %
  riichiRate: number | null; // 立直率 %
  winTurns: number | null; // 和了巡数
  avgWin: number | null; // 平均和了
  avgDealIn: number | null; // 平均放銃
  avgRank: number | null; // 平均順位
  bustRate: number | null; // 飛び率 %
  stableRank: string; // 安定段位（例: 聖5.90）
  expectedPoints: number | null; // 点数期待
  /** 1位〜4位の割合 % */
  rankRates: [number | null, number | null, number | null, number | null];
}

export type NumericKey = {
  [K in keyof PeriodStats]: PeriodStats[K] extends number | null ? K : never;
}[keyof PeriodStats];

export type TextKey = "recordRank" | "recordPoints" | "stableRank";

export function emptyPeriod(id: string, label = ""): PeriodStats {
  return {
    id,
    label,
    startDate: "",
    endDate: "",
    room: "",
    games: null,
    recordRank: "",
    recordPoints: "",
    winRate: null,
    dealInRate: null,
    tsumoRate: null,
    damaRate: null,
    drawRate: null,
    drawTenpaiRate: null,
    callRate: null,
    riichiRate: null,
    winTurns: null,
    avgWin: null,
    avgDealIn: null,
    avgRank: null,
    bustRate: null,
    stableRank: "",
    expectedPoints: null,
    rankRates: [null, null, null, null],
  };
}

/** 画面に出す項目の名前と単位 */
export const FIELD_META: { key: NumericKey; label: string; unit: "%" | "" ; digits: number }[] = [
  { key: "games", label: "対戦数", unit: "", digits: 0 },
  { key: "avgRank", label: "平均順位", unit: "", digits: 3 },
  { key: "winRate", label: "和了率", unit: "%", digits: 2 },
  { key: "dealInRate", label: "放銃率", unit: "%", digits: 2 },
  { key: "callRate", label: "副露率", unit: "%", digits: 2 },
  { key: "riichiRate", label: "立直率", unit: "%", digits: 2 },
  { key: "damaRate", label: "ダマ率", unit: "%", digits: 2 },
  { key: "tsumoRate", label: "ツモ率", unit: "%", digits: 2 },
  { key: "drawRate", label: "流局率", unit: "%", digits: 2 },
  { key: "drawTenpaiRate", label: "流局聴牌率", unit: "%", digits: 2 },
  { key: "bustRate", label: "飛び率", unit: "%", digits: 2 },
  { key: "winTurns", label: "和了巡数", unit: "", digits: 3 },
  { key: "avgWin", label: "平均和了", unit: "", digits: 0 },
  { key: "avgDealIn", label: "平均放銃", unit: "", digits: 0 },
  { key: "expectedPoints", label: "点数期待", unit: "", digits: 1 },
];

export const RANK_LABELS = ["1位", "2位", "3位", "4位"] as const;
