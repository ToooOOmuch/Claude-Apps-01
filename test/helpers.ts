import type { RgbaImage } from "../src/lib/image";
import { PIE_COLORS } from "../src/lib/pie";

/** 牌譜屋の順位分布に似た円グラフの画像を作る（扇形の間の白い線と、中の白い文字の代わりの四角つき） */
export function drawPie(rates: number[], opts = { width: 900, height: 500, cx: 650, cy: 250, r: 140 }): RgbaImage {
  const { width, height, cx, cy, r } = opts;
  const data = new Uint8ClampedArray(width * height * 4).fill(250);
  const total = rates.reduce((a, b) => a + b, 0);
  const bounds: number[] = [];
  let acc = 0;
  for (const v of rates) bounds.push((acc += v / total));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > r) continue;
      // 牌譜屋と同じく、真上から時計回りに 1位→4位
      const t = (Math.atan2(dx, -dy) / (Math.PI * 2) + 1) % 1;
      const k = bounds.findIndex((b) => t < b);
      const nearEdge = bounds.some((b) => Math.abs(t - b) * Math.PI * 2 * dist < 1.5);
      const i = (y * width + x) * 4;
      const c = nearEdge ? [255, 255, 255] : PIE_COLORS[k === -1 ? 3 : k];
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  }
  // 扇形の中ほどに白い「文字」
  acc = 0;
  for (const v of rates) {
    const mid = (acc + v / 2 / total) * Math.PI * 2;
    acc += v / total;
    const tx = Math.round(cx + Math.sin(mid) * r * 0.55);
    const ty = Math.round(cy - Math.cos(mid) * r * 0.55);
    for (let y = ty - 8; y < ty + 8; y++) for (let x = tx - 30; x < tx + 30; x++) data.fill(255, (y * width + x) * 4, (y * width + x) * 4 + 3);
  }
  // 折れ線グラフの点（小さい色つきの丸）も置いておく
  for (let y = 40; y < 50; y++) for (let x = 40; x < 50; x++) data.set([...PIE_COLORS[0], 255], (y * width + x) * 4);
  return { width, height, data };
}
