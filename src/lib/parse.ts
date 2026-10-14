import { emptyPeriod, type NumericKey, type PeriodStats, type TextKey } from "./types";

/** 牌譜屋の画面に出る項目名と、どのデータに入れるか */
const NUMERIC_LABELS: { label: string; key: NumericKey }[] = [
  { label: "記録対戦数", key: "games" },
  { label: "和了率", key: "winRate" },
  { label: "放銃率", key: "dealInRate" },
  { label: "ツモ率", key: "tsumoRate" },
  { label: "ダマ率", key: "damaRate" },
  { label: "流局率", key: "drawRate" },
  { label: "流局聴牌率", key: "drawTenpaiRate" },
  { label: "副露率", key: "callRate" },
  { label: "立直率", key: "riichiRate" },
  { label: "和了巡数", key: "winTurns" },
  { label: "平均和了", key: "avgWin" },
  { label: "平均放銃", key: "avgDealIn" },
  { label: "平均順位", key: "avgRank" },
  { label: "飛び率", key: "bustRate" },
  { label: "点数期待", key: "expectedPoints" },
];
const TEXT_LABELS: { label: string; key: TextKey }[] = [
  { label: "記録段位", key: "recordRank" },
  { label: "記録点数", key: "recordPoints" },
  { label: "安定段位", key: "stableRank" },
];

/**
 * 「基本」タブの並び順（3列×6行）。
 * 項目名だけ読み取れなかった値を、同じ行のほかの項目から位置で当てはめるのに使う。
 */
const GRID: (NumericKey | TextKey)[][] = [
  ["games", "recordRank", "recordPoints"],
  ["winRate", "dealInRate", "tsumoRate"],
  ["damaRate", "drawRate", "drawTenpaiRate"],
  ["callRate", "riichiRate", "winTurns"],
  ["avgWin", "avgDealIn", "avgRank"],
  ["bustRate", "stableRank", "expectedPoints"],
];

/** 値としてありうる範囲と、小数点以下の桁数（小数点が読めなかったときに補うため） */
const FORMAT: Partial<Record<NumericKey, { min: number; max: number; decimals: number }>> = {
  games: { min: 1, max: 1e6, decimals: 0 },
  avgRank: { min: 1, max: 4, decimals: 3 },
  winTurns: { min: 3, max: 25, decimals: 3 },
  avgWin: { min: 500, max: 50000, decimals: 0 },
  avgDealIn: { min: 500, max: 50000, decimals: 0 },
  expectedPoints: { min: -300, max: 300, decimals: 1 },
};
const RATE_FORMAT = { min: 0, max: 100, decimals: 2 };

/** 読み取った数字を、その項目としてありうる値に直す。直せなければ null */
export function normalizeValue(key: NumericKey, raw: string): number | null {
  const f = FORMAT[key] ?? RATE_FORMAT;
  const cleaned = raw.replace(/,/g, "").replace(/−/g, "-");
  const v = parseFloat(cleaned);
  if (!Number.isFinite(v)) return null;
  if (v >= f.min && v <= f.max) return v;
  // 「2.323」が「2323」と読まれたような場合は、決まった桁数の位置に小数点を補う
  if (!cleaned.includes(".") && f.decimals > 0) {
    const fixed = v / 10 ** f.decimals;
    if (fixed >= f.min && fixed <= f.max) return fixed;
  }
  return null;
}

/** 段位の頭につく文字。OCR が読み間違えやすい字も、正しい字に直す */
const RANK_CHARS: Record<string, string> = {
  士: "士",
  傑: "傑",
  豪: "豪",
  宗: "豪",
  家: "豪",
  聖: "聖",
  星: "聖",
  魂: "魂",
  鬼: "魂",
};

/** 最長共通部分列の長さ（項目名の読み間違いに強い比較のため） */
function lcs(a: string, b: string): number {
  const dp = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let prev = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return (2 * lcs(a, b)) / (a.length + b.length);
}

function bestLabel<T extends { label: string }>(text: string, candidates: T[]): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const item of candidates) {
    // 長い文字列の末尾に項目名があることが多い（前の値の単位などが残るため）
    const tail = text.slice(-item.label.length - 1);
    const score = Math.max(similarity(text, item.label), similarity(tail, item.label));
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 0.6 ? best : null;
}

/** OCR 結果の1行を、文字だけの部分（項目名）と数値の部分に分ける */
const SEGMENT = /([^\d\-+−]*?)([-+−]?\d[\d,]*(?:\.\d+)?)(\s*%)?(?:\s*\/\s*(\d+(?:\.\d+)?))?(?:\s*[(（]\s*\d+\s*[)）])?/g;

function clean(s: string): string {
  // 空白や記号を取り除き、漢字・かな・英字だけにする
  return s.replace(/[\s。、・,.:;'"`|!?()（）[\]【】{}<>_~^=*#@&$\\/%-]/g, "");
}

const isTextKey = (key: NumericKey | TextKey): key is TextKey => TEXT_LABELS.some((t) => t.key === key);

interface Segment {
  key: keyof PeriodStats | null;
  raw: string;
}

export interface ParseResult {
  stats: PeriodStats;
  /** 読み取れた項目 */
  found: Set<keyof PeriodStats>;
}

/**
 * OCR で読み取った文章から、牌譜屋の「基本」タブの成績を取り出す。
 * 項目名は多少読み間違えていても、似ている名前に当てはめる。
 */
export function parseStatsText(text: string, id = "p"): ParseResult {
  const stats = emptyPeriod(id);
  const found = new Set<keyof PeriodStats>();
  const scores = new Map<string, number>();

  const take = (key: keyof PeriodStats, score: number) => {
    if ((scores.get(key) ?? 0) >= score) return false;
    scores.set(key, score);
    found.add(key);
    return true;
  };

  const lineSegments: Segment[][] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/−/g, "-");
    SEGMENT.lastIndex = 0;
    let m: RegExpExecArray | null;
    // この行で項目名が分からなかった値（あとで位置から当てはめる）
    const segments: Segment[] = [];
    lineSegments.push(segments);
    while ((m = SEGMENT.exec(line))) {
      if (!m[0]) {
        SEGMENT.lastIndex++;
        continue;
      }
      const labelText = clean(m[1]);
      const seg: Segment = { key: null, raw: m[2] };
      segments.push(seg);
      if (!labelText) continue;

      // 段位（例: 「記録段位 豪3」「安定段位 聖5.90」）は、項目名の最後の1文字が段位の字
      const rankChar = RANK_CHARS[labelText.slice(-1)];
      if (rankChar) {
        const hit = bestLabel(labelText.slice(0, -1), TEXT_LABELS);
        if (hit && hit.item.key !== "recordPoints") {
          seg.key = hit.item.key;
          if (take(hit.item.key, hit.score)) stats[hit.item.key] = `${rankChar}${m[2]}`;
          continue;
        }
      }
      // 記録点数（例: 1148/3600）
      if (m[4]) {
        const hit = bestLabel(labelText, TEXT_LABELS);
        if (hit && hit.item.key === "recordPoints") {
          seg.key = "recordPoints";
          if (take("recordPoints", hit.score)) stats.recordPoints = `${m[2]}/${m[4]}`;
          continue;
        }
      }
      const hit = bestLabel(labelText, NUMERIC_LABELS);
      const value = hit && normalizeValue(hit.item.key, m[2]);
      if (hit && value !== null) {
        seg.key = hit.item.key;
        if (take(hit.item.key, hit.score)) (stats[hit.item.key] as number | null) = value;
      }
    }
  }

  // 項目名が読めなかった値は、「基本」タブの並び順（3列×6行）から当てはめる。
  // 表の1行目（記録対戦数の行）を見つけ、そこから下の6行を順に見る
  const anchor = lineSegments.findIndex((segs) => segs.some((seg) => seg.key === "games"));
  const rows: Segment[][] =
    anchor >= 0
      ? GRID.map((_, r) => lineSegments[anchor + r] ?? [])
      : // 1行目が見つからなければ、項目が1つでも分かった行だけ当てはめる
        GRID.map((row) => lineSegments.find((segs) => segs.some((seg, j) => seg.key === row[j])) ?? []);
  rows.forEach((segs, r) => {
    segs.slice(0, 3).forEach((seg, j) => {
      const key = GRID[r][j];
      if (seg.key || found.has(key) || isTextKey(key)) return;
      const value = normalizeValue(key, seg.raw);
      if (value === null) return;
      (stats[key] as number | null) = value;
      found.add(key);
    });
  });

  // 期間（例: 2019-08-23 ~ 2025-08-17）
  const range = parseDateRange(text);
  if (range) {
    [stats.startDate, stats.endDate] = range;
    found.add("startDate");
    found.add("endDate");
  }
  return { stats, found };
}

/** 円グラフの中の「22.20%」のような文字を拾う */
export function parsePercentages(text: string): number[] {
  return [...text.matchAll(/(\d{1,3})\s*[.,]\s*(\d{2})\s*%/g)]
    .map((m) => parseFloat(`${m[1]}.${m[2]}`))
    .filter((v) => v >= 0 && v <= 100);
}

const DATE = String.raw`(20\d\d)\s*[-/.]?\s*(\d\d)\s*[-/.]?\s*(\d\d)`;
const DATE_RANGE = new RegExp(`${DATE}\\s*[~〜～\\-–]+\\s*${DATE}`);

/** 「2019-08-23 ~ 2025-08-17」のような期間を読む（区切りの「-」が読めていなくてもよい） */
export function parseDateRange(text: string): [string, string] | null {
  const m = text.replace(/\s+/g, " ").match(DATE_RANGE);
  if (!m) return null;
  const valid = (mo: string, d: string) => +mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31;
  if (!valid(m[2], m[3]) || !valid(m[5], m[6])) return null;
  return [`${m[1]}-${m[2]}-${m[3]}`, `${m[4]}-${m[5]}-${m[6]}`];
}
