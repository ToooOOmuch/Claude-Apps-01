import type { NumericKey, PeriodStats } from "./types";

/** 標準正規分布の累積分布関数（Abramowitz & Stegun 7.1.26 による近似） */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** 順位の割合（%）から、1戦あたりの順位のばらつき（分散）を求める */
export function rankVariance(rates: PeriodStats["rankRates"]): number | null {
  if (rates.some((r) => r === null)) return null;
  const p = (rates as number[]).map((r) => r / 100);
  const sum = p.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const mean = p.reduce((a, pi, i) => a + pi * (i + 1), 0) / sum;
  return p.reduce((a, pi, i) => a + pi * (i + 1 - mean) ** 2, 0) / sum;
}

export interface Significance {
  z: number;
  /** この差が偶然で出る確率（両側） */
  p: number;
}

/** 平均順位の差が偶然で出る確率 */
export function avgRankSignificance(a: PeriodStats, b: PeriodStats): Significance | null {
  const va = rankVariance(a.rankRates);
  const vb = rankVariance(b.rankRates);
  if (va === null || vb === null || !a.games || !b.games || a.avgRank === null || b.avgRank === null) return null;
  const se = Math.sqrt(va / a.games + vb / b.games);
  if (!se) return null;
  const z = (a.avgRank - b.avgRank) / se;
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

/** 割合（%）の差が偶然で出る確率 */
export function rateSignificance(pa: number | null, na: number | null, pb: number | null, nb: number | null): Significance | null {
  if (pa === null || pb === null || !na || !nb) return null;
  const a = pa / 100;
  const b = pb / 100;
  const se = Math.sqrt((a * (1 - a)) / na + (b * (1 - b)) / nb);
  if (!se) return null;
  const z = (a - b) / se;
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))) };
}

export function formatProbability(p: number): string {
  if (p < 0.0001) return "0.01%未満";
  if (p < 0.01) return `約${(p * 100).toFixed(2)}%`;
  return `約${(p * 100).toFixed(1)}%`;
}

/** 値が増えると良いのか、減ると良いのか（色分けに使う）。どちらでもないものは 0 */
export const BETTER_DIRECTION: Partial<Record<NumericKey | "rank1" | "rank4", 1 | -1 | 0>> = {
  avgRank: -1,
  winRate: 1,
  dealInRate: -1,
  bustRate: -1,
  expectedPoints: 1,
  avgWin: 1,
  avgDealIn: -1,
  winTurns: -1,
  rank1: 1,
  rank4: -1,
};

export function sortByStart(periods: PeriodStats[]): PeriodStats[] {
  return [...periods].sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
}
