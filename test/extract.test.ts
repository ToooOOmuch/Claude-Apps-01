import { describe, expect, it } from "vitest";
import { averageRankFromRates, extractFromScreenshot, type OcrEngine } from "../src/lib/extract";
import { drawPie } from "./helpers";

/** 決まった文章を返すだけの OCR（読み取りの流れを確かめるため） */
function fakeOcr(japanese: string, dates = ""): OcrEngine {
  return {
    async recognize(_img, mode) {
      if (mode === "japanese") return { text: japanese, words: [] };
      if (mode === "dates") return { text: dates, words: [] };
      return { text: "", words: [] };
    },
  };
}

describe("extractFromScreenshot", () => {
  it("文字と円グラフの両方から成績を組み立てる", async () => {
    const img = drawPie([22.2, 26.66, 28.27, 22.87]);
    const r = await extractFromScreenshot(img, fakeOcr("記録 対戦 数 1054\n平均 順位 2.518", "2019-08-23~2025-08-17"));
    expect(r.stats.games).toBe(1054);
    expect(r.stats.avgRank).toBe(2.518);
    expect(r.stats.startDate).toBe("2019-08-23");
    expect(r.stats.rankRates.map((v) => Math.round(v!))).toEqual([22, 27, 28, 23]);
  });

  it("平均順位が順位の割合と合わなければ、割合から計算した値にする", async () => {
    const img = drawPie([28.6, 28.53, 24.82, 18.05]);
    const r = await extractFromScreenshot(img, fakeOcr("記録 対戦 数 1374\n平均 順位 2.823"));
    expect(r.stats.avgRank).toBeCloseTo(2.323, 2);
    expect(r.notes.join()).toContain("平均順位");
  });
});

describe("averageRankFromRates", () => {
  it("1位〜4位の割合から平均順位を計算する", () => {
    expect(averageRankFromRates([25, 25, 25, 25])).toBe(2.5);
    expect(averageRankFromRates([null, 25, 25, 25])).toBeNull();
  });
});
