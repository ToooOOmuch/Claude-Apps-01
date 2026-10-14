import { BETTER_DIRECTION } from "../lib/compare";
import type { NumericKey, PeriodStats } from "../lib/types";

/** 比べる項目（順位の割合も含む） */
export type MetricKey = NumericKey | "rank1" | "rank4";

export const METRIC_LABELS: Partial<Record<MetricKey, string>> = {
  rank1: "トップ率",
  rank4: "ラス率",
  winRate: "和了率",
  dealInRate: "放銃率",
  callRate: "副露率",
  riichiRate: "立直率",
  damaRate: "ダマ率",
  bustRate: "飛び率",
  avgRank: "平均順位",
};

export function metric(p: PeriodStats, key: MetricKey): number | null {
  if (key === "rank1") return p.rankRates[0];
  if (key === "rank4") return p.rankRates[3];
  return p[key];
}

/** 大きく変わったとみなす差（ポイント） */
export const BIG_CHANGE = 3;
/** ほぼ変わらないとみなす差（ポイント） */
export const SMALL_CHANGE = 2;

const RATE_KEYS: MetricKey[] = ["rank1", "rank4", "winRate", "dealInRate", "callRate", "riichiRate", "damaRate", "bustRate"];

/** 麻雀の動画でよく話題になる順 */
const FAMILIARITY: MetricKey[] = ["winRate", "dealInRate", "riichiRate", "callRate", "rank1", "rank4", "bustRate", "damaRate"];

export interface Change {
  key: MetricKey;
  label: string;
  before: number;
  after: number;
  diff: number;
  /** 良くなったら 1、悪くなったら -1、良し悪しのない項目は 0 */
  verdict: 1 | -1 | 0;
}

export function changes(before: PeriodStats, after: PeriodStats, keys: MetricKey[] = RATE_KEYS): Change[] {
  return keys.flatMap((key) => {
    const a = metric(before, key);
    const b = metric(after, key);
    if (a === null || b === null) return [];
    const d = b - a;
    const better = BETTER_DIRECTION[key] ?? 0;
    const verdict = (better === 0 || Math.abs(d) < 1e-9 ? 0 : Math.sign(d * better)) as 1 | -1 | 0;
    return [{ key, label: METRIC_LABELS[key] ?? key, before: a, after: b, diff: d, verdict }];
  });
}

/** 大きく変わった項目と、ほとんど変わらなかった項目に分ける */
export function splitChanges(before: PeriodStats, after: PeriodStats) {
  const all = changes(before, after);
  const big = all.filter((c) => Math.abs(c.diff) >= BIG_CHANGE).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  // 「ほぼ同じ」は、視聴者になじみのある項目から順に並べる（見出しにも先頭の2つを使う）
  const small = all.filter((c) => Math.abs(c.diff) < SMALL_CHANGE).sort((x, y) => FAMILIARITY.indexOf(x.key) - FAMILIARITY.indexOf(y.key));
  return { big, small };
}

const pt = (v: number) => `${Math.abs(v).toFixed(1)}pt`;

/** 「平均順位が0.195良くなった」 */
export function avgRankHeadline(before: PeriodStats, after: PeriodStats): string {
  if (before.avgRank === null || after.avgRank === null) return "平均順位の変化";
  const d = after.avgRank - before.avgRank;
  if (Math.abs(d) < 0.02) return "平均順位はほとんど変わらなかった";
  return `平均順位が ${Math.abs(d).toFixed(3)} ${d < 0 ? "良くなった" : "悪くなった"}`;
}

/** 「トップが6.4pt増え、ラスが4.8pt減った」 */
export function rankHeadline(before: PeriodStats, after: PeriodStats): string {
  const [c1, c4] = changes(before, after, ["rank1", "rank4"]);
  if (!c1 || !c4) return "順位の割合";
  const top = Math.abs(c1.diff) < 0.5 ? "トップはほぼ同じ" : `トップが${pt(c1.diff)}${c1.diff > 0 ? "増え" : "減り"}`;
  const last = Math.abs(c4.diff) < 0.5 ? "ラスはほぼ同じ" : `ラスが${pt(c4.diff)}${c4.diff > 0 ? "増えた" : "減った"}`;
  return `${top}、${last}`;
}

/** 「大きく変わったのはトップ率とラス率」 */
export function contrastHeadline(before: PeriodStats, after: PeriodStats): string {
  const { big, small } = splitChanges(before, after);
  if (!big.length) return "大きく変わった項目はなかった";
  const names = big.slice(0, 2).map((c) => c.label).join("と");
  if (!small.length) return `大きく変わったのは${names}`;
  return `${small.slice(0, 2).map((c) => c.label).join("・")}はほぼ同じ。変わったのは${names}`;
}

/** 100戦あたりの回数（合計がちょうど100になるよう、端数の大きい順に1ずつ足す） */
export function per100(rates: PeriodStats["rankRates"]): [number, number, number, number] | null {
  if (rates.some((r) => r === null)) return null;
  const r = rates as number[];
  const total = r.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const exact = r.map((v) => (v / total) * 100);
  const floor = exact.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  exact
    .map((v, k) => ({ k, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ k }) => {
      if (left > 0) {
        floor[k]++;
        left--;
      }
    });
  return floor as [number, number, number, number];
}

/** 「100戦あたり、トップが22回→29回」 */
export function per100Headline(before: PeriodStats, after: PeriodStats): string {
  const a = per100(before.rankRates);
  const b = per100(after.rankRates);
  if (!a || !b) return "100戦あたりの回数";
  return `100戦あたり、トップ ${a[0]}回→${b[0]}回、ラス ${a[3]}回→${b[3]}回`;
}
