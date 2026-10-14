import { binarize, crop, scale, type RgbaImage } from "./image";
import { parseDateRange, parsePercentages, parseStatsText } from "./parse";
import { findPie, measureRankRates, rankAtAngle } from "./pie";
import type { PeriodStats } from "./types";

/** 1位〜4位の割合（%）から平均順位を計算する */
export function averageRankFromRates(rates: PeriodStats["rankRates"]): number | null {
  if (rates.some((r) => r === null)) return null;
  const total = (rates as number[]).reduce((a, b) => a + b, 0);
  if (Math.abs(total - 100) > 1) return null;
  return (rates as number[]).reduce((a, r, k) => a + r * (k + 1), 0) / total;
}

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
}

/**
 * japanese: 画面全体の日本語と数字
 * digits: 円グラフの「22.20%」のような数字だけ
 * dates: 期間ボタンの「2019-08-23 ~ 2025-08-17」
 */
export type OcrMode = "japanese" | "digits" | "dates";

/** 文字認識の実装（ブラウザでは tesseract.js のワーカー、テストでは Node 版を渡す） */
export interface OcrEngine {
  recognize(img: RgbaImage, mode: OcrMode): Promise<OcrResult>;
}

export interface ExtractResult {
  stats: PeriodStats;
  /** 画像から読み取れた項目 */
  found: Set<keyof PeriodStats>;
  /** 確認してほしい点 */
  notes: string[];
  /** デバッグ用: 読み取った文章 */
  rawText: string;
}

/** 牌譜屋のスクリーンショット1枚から成績を読み取る */
export async function extractFromScreenshot(img: RgbaImage, ocr: OcrEngine, id = "p"): Promise<ExtractResult> {
  const notes: string[] = [];

  // 小さい文字も読めるように2倍に拡大してから読む
  const factor = img.width < 2000 ? 2 : 1;
  const full = await ocr.recognize(scale(img, factor), "japanese");
  const { stats, found } = parseStatsText(full.text, id);

  const pie = findPie(img);
  if (!pie) {
    notes.push("順位分布の円グラフが見つかりませんでした。1位〜4位の割合は手で入力してください。");
  } else {
    const measured = measureRankRates(img, pie);
    const rates: (number | null)[] = measured.map((v) => Math.round(v * 100) / 100);
    let exact = 0;
    try {
      // 円グラフの中の白い数字だけを黒く抜き出して読む
      const size = pie.r * 2;
      const x0 = pie.cx - pie.r;
      const y0 = pie.cy - pie.r;
      const area = crop(img, x0, y0, size, size);
      const ink = binarize(area, (r, g, b, x, y) => {
        const dx = x - pie.r;
        const dy = y - pie.r;
        return r > 200 && g > 200 && b > 200 && dx * dx + dy * dy < (pie.r * 0.92) ** 2;
      });
      const pieFactor = 3;
      const res = await ocr.recognize(scale(ink, pieFactor), "digits");
      for (const word of res.words) {
        const [value] = parsePercentages(word.text);
        if (value === undefined) continue;
        const cx = x0 + (word.bbox.x0 + word.bbox.x1) / 2 / pieFactor;
        const cy = y0 + (word.bbox.y0 + word.bbox.y1) / 2 / pieFactor;
        const k = rankAtAngle(img, pie, Math.atan2(cy - pie.cy, cx - pie.cx));
        // 角度から測った値と大きくずれていなければ、読み取った正確な値を使う
        if (k >= 0 && Math.abs(measured[k] - value) < 1) {
          rates[k] = value;
          exact++;
        }
      }
    } catch {
      // 数字が読めなくても、角度から測った値があるので続ける
    }
    stats.rankRates = rates as PeriodStats["rankRates"];
    found.add("rankRates");
    if (exact < 4) {
      notes.push("順位の割合の一部は円グラフの角度から計算した値です（誤差 ±0.1% 程度）。");
    }
  }

  // 平均順位は順位の割合から計算できるので、読み取った値と照らし合わせる
  const computed = averageRankFromRates(stats.rankRates);
  if (computed !== null && (stats.avgRank === null || Math.abs(stats.avgRank - computed) > 0.01)) {
    if (stats.avgRank !== null) notes.push(`平均順位の読み取り値（${stats.avgRank}）が順位の割合と合わないため、割合から計算した値にしました。`);
    stats.avgRank = Math.round(computed * 1000) / 1000;
    found.add("avgRank");
  }

  if (!found.has("startDate")) {
    // 期間ボタンは画面の下の方にある。濃い色の文字だけ抜き出して読み直す
    const bottom = crop(img, 0, img.height * 0.75, img.width, img.height * 0.25);
    for (const threshold of [130, 160, 100]) {
      const ink = binarize(bottom, (r, g, b) => r < threshold && g < threshold && b < threshold);
      const res = await ocr.recognize(scale(ink, 3), "dates");
      const range = parseDateRange(res.text);
      if (range) {
        [stats.startDate, stats.endDate] = range;
        found.add("startDate");
        found.add("endDate");
        break;
      }
    }
  }

  const missing: string[] = [];
  if (!found.has("games")) missing.push("対戦数");
  if (!found.has("avgRank")) missing.push("平均順位");
  if (!found.has("startDate")) missing.push("期間");
  if (missing.length) notes.push(`読み取れなかった項目: ${missing.join("・")}。手で入力してください。`);

  return { stats, found, notes, rawText: full.text };
}
