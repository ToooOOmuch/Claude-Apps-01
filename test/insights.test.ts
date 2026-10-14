import { describe, expect, it } from "vitest";
import { emptyPeriod, type PeriodStats } from "../src/lib/types";
import { avgRankHeadline, contrastHeadline, per100, per100Headline, rankHeadline, splitChanges } from "../src/render/insights";

const make = (patch: Partial<PeriodStats>): PeriodStats => ({ ...emptyPeriod("x"), ...patch });
const before = make({ avgRank: 2.518, rankRates: [22.2, 26.66, 28.27, 22.87], winRate: 20.47, dealInRate: 11.2, callRate: 33.98, bustRate: 6.55 });
const after = make({ avgRank: 2.323, rankRates: [28.6, 28.53, 24.82, 18.05], winRate: 21.87, dealInRate: 10.27, callRate: 32.36, bustRate: 4.08 });

describe("見出しの自動生成", () => {
  it("平均順位", () => {
    expect(avgRankHeadline(before, after)).toBe("平均順位が 0.195 良くなった");
    expect(avgRankHeadline(after, before)).toBe("平均順位が 0.195 悪くなった");
    expect(avgRankHeadline(before, { ...before, avgRank: 2.51 })).toBe("平均順位はほとんど変わらなかった");
  });

  it("トップとラス", () => {
    expect(rankHeadline(before, after)).toBe("トップが6.4pt増え、ラスが4.8pt減った");
  });

  it("変わったもの・変わらなかったもの", () => {
    const { big, small } = splitChanges(before, after);
    expect(big.map((c) => c.label)).toEqual(["トップ率", "ラス率"]);
    expect(small.map((c) => c.label)).toEqual(["和了率", "放銃率", "副露率"]);
    // ラス率は減ると良い項目なので「改善」
    expect(big[1].verdict).toBe(1);
    expect(contrastHeadline(before, after)).toBe("和了率・放銃率はほぼ同じ。変わったのはトップ率とラス率");
  });

  it("100戦あたりの回数は合計がちょうど100", () => {
    const counts = per100([22.2, 26.66, 28.27, 22.87])!;
    expect(counts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(counts).toEqual([22, 27, 28, 23]);
    expect(per100Headline(before, after)).toBe("100戦あたり、トップ 22回→29回、ラス 23回→18回");
  });
});
