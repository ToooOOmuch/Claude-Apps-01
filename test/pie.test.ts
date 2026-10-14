import { describe, expect, it } from "vitest";
import { findPie, measureRankRates } from "../src/lib/pie";
import { drawPie } from "./helpers";

describe("円グラフの読み取り", () => {
  it("円の位置と大きさを見つける", () => {
    const pie = findPie(drawPie([25, 25, 25, 25]))!;
    expect(pie.cx).toBeCloseTo(650, -1);
    expect(pie.cy).toBeCloseTo(250, -1);
    expect(pie.r).toBeCloseTo(140, -1);
  });

  it("扇形の角度から、順位の割合を ±0.3% で求める（実際の牌譜屋の画像では ±0.06% 程度）", () => {
    const rates = [28.6, 28.53, 24.82, 18.05];
    const img = drawPie(rates);
    const measured = measureRankRates(img, findPie(img)!);
    measured.forEach((m, k) => expect(Math.abs(m - rates[k])).toBeLessThan(0.3));
  });

  it("円グラフがなければ null", () => {
    const blank = { width: 100, height: 100, data: new Uint8ClampedArray(100 * 100 * 4).fill(255) };
    expect(findPie(blank)).toBeNull();
  });
});
