import { describe, expect, it } from "vitest";
import { buildScript } from "../src/lib/script";
import { DEFAULT_TEXTS, parseBackup } from "../src/lib/storage";
import { emptyPeriod, type PeriodStats } from "../src/lib/types";
import { easeOutCubic, frameInput, lerpPeriod } from "../src/render/animate";
import { THEMES } from "../src/render/theme";

const make = (patch: Partial<PeriodStats>): PeriodStats => ({ ...emptyPeriod("x"), ...patch });
const before = make({ games: 1054, room: "玉", avgRank: 2.518, rankRates: [22.2, 26.66, 28.27, 22.87], winRate: 20.47, dealInRate: 11.2, stableRank: "豪1.41" });
const after = make({ games: 1374, room: "玉", avgRank: 2.323, rankRates: [28.6, 28.53, 24.82, 18.05], winRate: 21.87, dealInRate: 10.27, stableRank: "聖5.90" });

describe("台本の下書き", () => {
  const script = buildScript(before, after, DEFAULT_TEXTS);
  it("平均順位・トップとラス・変わらなかった項目・段位に触れる", () => {
    expect(script).toContain("玉の間の学ぶ前が1,054戦、学んだ後が1,374戦");
    expect(script).toContain("2.518から2.323へ、0.195良くなりました");
    expect(script).toContain("運だけでは説明しにくい差です");
    expect(script).toContain("トップが22回から29回、ラスが23回から18回");
    expect(script).toContain("和了率は20.5%から21.9%、放銃率は11.2%から10.3%と、ほとんど変わっていません");
    expect(script).toContain("豪1.41から聖5.90");
  });
});

describe("アニメーション", () => {
  it("途中の値は前と後の間になり、対戦数と文字は後のまま", () => {
    const mid = lerpPeriod(before, after, 0.5);
    expect(mid.avgRank).toBeCloseTo((2.518 + 2.323) / 2);
    expect(mid.rankRates[0]).toBeCloseTo(25.4);
    expect(mid.games).toBe(1374);
    expect(mid.stableRank).toBe("聖5.90");
  });
  it("最初と最後", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    const input = { before, after, periods: [before, after], texts: DEFAULT_TEXTS, theme: THEMES.dark };
    expect(frameInput(input, 1).after.avgRank).toBeCloseTo(2.323);
    expect(frameInput(input, 0).target).toBe(after);
  });
});

describe("データの保存と読み込み", () => {
  it("保存した内容を読み戻せる", () => {
    const raw = JSON.stringify({ periods: [after], beforeId: null, afterId: "x", texts: { title: "題" }, themeId: "light" });
    const s = parseBackup(raw)!;
    expect(s.periods[0].avgRank).toBe(2.323);
    expect(s.texts.title).toBe("題");
    expect(s.texts.beforeLabel).toBe(DEFAULT_TEXTS.beforeLabel);
    expect(s.themeId).toBe("light");
  });
  it("古い形式で足りない項目は空で補う", () => {
    const s = parseBackup(JSON.stringify({ periods: [{ id: "a", avgRank: 2.4 }] }))!;
    expect(s.periods[0].rankRates).toEqual([null, null, null, null]);
    expect(s.themeId).toBe("dark");
  });
  it("壊れたファイルは null", () => {
    expect(parseBackup("not json")).toBeNull();
    expect(parseBackup(JSON.stringify({ foo: 1 }))).toBeNull();
  });
});
