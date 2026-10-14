import { describe, expect, it } from "vitest";
import { avgRankSignificance, formatProbability, rankVariance, rateSignificance } from "../src/lib/compare";
import { emptyPeriod } from "../src/lib/types";

const period = (games: number, rates: [number, number, number, number]) => {
  const p = emptyPeriod("x");
  p.games = games;
  p.rankRates = rates;
  p.avgRank = rates.reduce((a, r, k) => a + (r / 100) * (k + 1), 0);
  return p;
};

describe("偶然で出る確率", () => {
  it("順位が均等なら分散は 1.25", () => {
    expect(rankVariance([25, 25, 25, 25])).toBeCloseTo(1.25);
  });

  it("1000戦以上で平均順位が 0.2 違えば、偶然とは考えにくい", () => {
    const s = avgRankSignificance(period(1054, [22.2, 26.66, 28.27, 22.87]), period(1374, [28.6, 28.53, 24.82, 18.05]))!;
    expect(Math.abs(s.z)).toBeGreaterThan(4);
    expect(s.p).toBeLessThan(0.0001);
  });

  it("戦数が少なければ、同じ差でも偶然で起こりうる", () => {
    const s = avgRankSignificance(period(30, [22.2, 26.66, 28.27, 22.87]), period(30, [28.6, 28.53, 24.82, 18.05]))!;
    expect(s.p).toBeGreaterThan(0.05);
  });

  it("割合の差", () => {
    expect(rateSignificance(22.87, 1054, 18.05, 1374)!.p).toBeLessThan(0.01);
    expect(rateSignificance(null, 1, 1, 1)).toBeNull();
  });

  it("確率の書き方", () => {
    expect(formatProbability(0.00001)).toBe("0.01%未満");
    expect(formatProbability(0.0036)).toBe("約0.36%");
    expect(formatProbability(0.2)).toBe("約20.0%");
  });
});
