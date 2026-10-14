import { colorDistance, type Rgb, type RgbaImage } from "./image";

/** 牌譜屋の順位分布グラフの色（1位〜4位） */
export const PIE_COLORS: readonly Rgb[] = [
  [0x28, 0xa7, 0x45],
  [0x17, 0xa2, 0xb8],
  [0x6c, 0x75, 0x7d],
  [0xdc, 0x35, 0x45],
];

const COLOR_TOLERANCE = 45;

export interface PieGeometry {
  cx: number;
  cy: number;
  r: number;
}

function classify(d: RgbaImage["data"], i: number): number {
  let best = -1;
  let bestDist = COLOR_TOLERANCE;
  for (let k = 0; k < PIE_COLORS.length; k++) {
    const dist = colorDistance(d, i, PIE_COLORS[k]);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

/**
 * 画像の中から円グラフを探す。
 * 順位の色の画素がつながった大きなかたまり（＝扇形）を集め、その外枠から中心と半径を求める。
 * 折れ線グラフの点や凡例の文字のような小さなかたまりは無視する。
 */
export function findPie(img: RgbaImage): PieGeometry | null {
  const { width: w, height: h, data } = img;
  const label = new Int32Array(w * h).fill(-1);
  for (let p = 0; p < w * h; p++) label[p] = classify(data, p * 4) >= 0 ? 0 : -1;

  const minSize = Math.max(200, w * h * 0.004);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let found = 0;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (label[start] !== 0) continue;
    // 塗りつぶしでかたまりを1つ取り出す
    label[start] = 1;
    stack.push(start);
    let size = 0;
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
      if (x > 0 && label[p - 1] === 0) (label[p - 1] = 1), stack.push(p - 1);
      if (x < w - 1 && label[p + 1] === 0) (label[p + 1] = 1), stack.push(p + 1);
      if (y > 0 && label[p - w] === 0) (label[p - w] = 1), stack.push(p - w);
      if (y < h - 1 && label[p + w] === 0) (label[p + w] = 1), stack.push(p + w);
    }
    // 扇形はある程度大きく、外枠の中がぎっしり埋まっている
    const fill = size / ((bx1 - bx0 + 1) * (by1 - by0 + 1));
    if (size >= minSize && fill > 0.3) {
      found++;
      x0 = Math.min(x0, bx0);
      y0 = Math.min(y0, by0);
      x1 = Math.max(x1, bx1);
      y1 = Math.max(y1, by1);
    }
  }
  if (!found) return null;
  const r = Math.max(x1 - x0, y1 - y0) / 2;
  if (r < 20) return null;
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r };
}

/** 中心から見た角度 θ（ラジアン）の方向で、外周近くにある扇形の順位（0〜3）。見つからなければ -1 */
export function rankAtAngle(img: RgbaImage, pie: PieGeometry, theta: number): number {
  const votes = [0, 0, 0, 0];
  for (const f of [0.78, 0.84, 0.9]) {
    const x = Math.round(pie.cx + Math.cos(theta) * pie.r * f);
    const y = Math.round(pie.cy + Math.sin(theta) * pie.r * f);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    const k = classify(img.data, (y * img.width + x) * 4);
    if (k >= 0) votes[k]++;
  }
  const max = Math.max(...votes);
  return max ? votes.indexOf(max) : -1;
}

/**
 * 円の外周近くをぐるっと一周調べて、各順位の扇形が占める角度の割合（%）を求める。
 * 扇形の中の白い数字は内側にあるので、外周近くだけ見れば文字に邪魔されない。
 */
export function measureRankRates(img: RgbaImage, pie: PieGeometry): [number, number, number, number] {
  const counts = [0, 0, 0, 0];
  const steps = 7200;
  for (let s = 0; s < steps; s++) {
    const k = rankAtAngle(img, pie, (s / steps) * Math.PI * 2);
    if (k >= 0) counts[k]++;
  }
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map((c) => (c / total) * 100) as [number, number, number, number];
}
