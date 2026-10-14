import { describe, expect, it } from "vitest";
import { normalizeValue, parseDateRange, parsePercentages, parseStatsText } from "../src/lib/parse";

// 牌譜屋の「基本」タブを OCR したときの典型的な出力（数字は架空）。
// 項目名が1文字ずつ区切られたり、読み間違えられたりする
const SAMPLE = `対戦 記録 順位 分 布
| 基本 立直 ほか 。 和 銃 分 布 幸運 度 最近 大 銃 。 よく 同 卓 す る 相手
記録 対戦 数 812 記録 段位 宗 2 記録 点数 950/2800
和 了 率 22.10% 放 寺 率 12.05% ツモ 率 40.12 名
ダマ 率 9.50% 流 局 率 15.00% 流 局 聴 牌 率 36.00% 三 位 / 四 位
副 需 率 30.25%% 立直 率 19.75%% 和 了 巡 数 11.950
平均 和子 6800 平均 放 逝 。 5300 平均 順位 2.481
飛び 率 5.00% 安定 段位 星 2.10 点数 期待 -1.2 (180) 支 ブッ クマ ー ク
EE に EE EE ro`;

describe("parseStatsText", () => {
  it("項目名を多少読み間違えていても、正しい項目に当てはめる", () => {
    const { stats } = parseStatsText(SAMPLE);
    expect(stats.games).toBe(812);
    expect(stats.recordRank).toBe("豪2");
    expect(stats.recordPoints).toBe("950/2800");
    expect(stats.winRate).toBe(22.1);
    expect(stats.dealInRate).toBe(12.05);
    expect(stats.tsumoRate).toBe(40.12);
    expect(stats.damaRate).toBe(9.5);
    expect(stats.drawRate).toBe(15);
    expect(stats.drawTenpaiRate).toBe(36);
    expect(stats.callRate).toBe(30.25);
    expect(stats.riichiRate).toBe(19.75);
    expect(stats.winTurns).toBe(11.95);
    expect(stats.avgWin).toBe(6800);
    expect(stats.avgDealIn).toBe(5300);
    expect(stats.avgRank).toBe(2.481);
    expect(stats.bustRate).toBe(5);
    expect(stats.stableRank).toBe("聖2.10");
    expect(stats.expectedPoints).toBe(-1.2);
  });

  it("項目名が読めなかった値は、表の並び順から当てはめる", () => {
    const text = `記録 対戦 数 1200 記録 段位 魂 1 記録 点数 10.0/20.0
和 了 率 21.00% 10.50% ツモ 率 36.00%
ダマ 率 10.00% REE 14.00% WERE 35.00%
BEE 3236% 立直 率 18.00% ATE 11.800
平均 和 了 6500 平均 放 銃 5100 平均 順位 2323
RUE 4.00% 安定 段位 聖 5.90 点数 期待 7.9`;
    const { stats } = parseStatsText(text);
    expect(stats.recordPoints).toBe("10.0/20.0");
    expect(stats.dealInRate).toBe(10.5);
    expect(stats.drawRate).toBe(14);
    expect(stats.drawTenpaiRate).toBe(35);
    // 小数点が抜けた値も、項目の桁数から補う
    expect(stats.callRate).toBe(32.36);
    expect(stats.avgRank).toBe(2.323);
    expect(stats.winTurns).toBe(11.8);
    expect(stats.bustRate).toBe(4);
  });

  it("期間を読む", () => {
    const { stats } = parseStatsText("2024-01-05 ~ 2025-02-28");
    expect(stats.startDate).toBe("2024-01-05");
    expect(stats.endDate).toBe("2025-02-28");
  });
});

describe("parseDateRange", () => {
  it("区切りの「-」が欠けていても読める", () => {
    expect(parseDateRange("--\n2019-08-23~2025-0817\n")).toEqual(["2019-08-23", "2025-08-17"]);
  });
  it("ありえない日付は無視する", () => {
    expect(parseDateRange("2019-13-23~2025-08-17")).toBeNull();
  });
});

describe("normalizeValue", () => {
  it("範囲内の値はそのまま", () => {
    expect(normalizeValue("winRate", "20.47")).toBe(20.47);
    expect(normalizeValue("games", "1,054")).toBe(1054);
  });
  it("小数点が抜けた値を直す", () => {
    expect(normalizeValue("dealInRate", "1120")).toBe(11.2);
    expect(normalizeValue("avgRank", "2518")).toBe(2.518);
  });
  it("直せない値は null", () => {
    expect(normalizeValue("avgRank", "9.5")).toBeNull();
  });
});

describe("parsePercentages", () => {
  it("円グラフの割合を拾う", () => {
    expect(parsePercentages("26.66% 22.20%\n28.27 %")).toEqual([26.66, 22.2, 28.27]);
  });
});
