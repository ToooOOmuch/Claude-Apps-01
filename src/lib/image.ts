/** ブラウザの ImageData と同じ形の画像データ（Node のテストでも使えるように独立させている） */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export type Rgb = readonly [number, number, number];

export function colorDistance(d: RgbaImage["data"], i: number, c: Rgb): number {
  return Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]);
}

export function crop(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.min(img.width - x, Math.floor(w));
  h = Math.min(img.height - y, Math.floor(h));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * img.width + x) * 4;
    out.set(img.data.subarray(src, src + w * 4), row * w * 4);
  }
  return { width: w, height: h, data: out };
}

/** 最近傍法での拡大（文字認識の前処理用） */
export function scale(img: RgbaImage, factor: number): RgbaImage {
  const w = Math.round(img.width * factor);
  const h = Math.round(img.height * factor);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.height - 1, Math.floor(y / factor));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / factor));
      const s = (sy * img.width + sx) * 4;
      const o = (y * w + x) * 4;
      out[o] = img.data[s];
      out[o + 1] = img.data[s + 1];
      out[o + 2] = img.data[s + 2];
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/** 条件に合う画素を黒、それ以外を白にした画像を作る */
export function binarize(img: RgbaImage, isInk: (r: number, g: number, b: number, x: number, y: number) => boolean): RgbaImage {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      const v = isInk(img.data[i], img.data[i + 1], img.data[i + 2], x, y) ? 0 : 255;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return { width: img.width, height: img.height, data: out };
}
