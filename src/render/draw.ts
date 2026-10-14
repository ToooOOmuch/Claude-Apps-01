import { FONT_FAMILY, type Theme } from "./theme";

export type Ctx = CanvasRenderingContext2D;

export function font(ctx: Ctx, size: number, weight: 400 | 500 | 700 | 900 = 400) {
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
}

/** 幅に収まるまで文字を小さくして、そのサイズを返す */
export function fitFont(ctx: Ctx, text: string, maxWidth: number, size: number, weight: 400 | 500 | 700 | 900 = 700, minSize = 12): number {
  font(ctx, size, weight);
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    font(ctx, size, weight);
  }
  return size;
}

export function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  opts: { size: number; weight?: 400 | 500 | 700 | 900; color: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; maxWidth?: number },
) {
  if (opts.maxWidth) fitFont(ctx, s, opts.maxWidth, opts.size, opts.weight ?? 400);
  else font(ctx, opts.size, opts.weight ?? 400);
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "left";
  ctx.textBaseline = opts.baseline ?? "alphabetic";
  ctx.fillText(s, x, y);
}

/** サムネイル用の、太いふち取りのある文字 */
export function outlinedText(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  opts: { size: number; color: string; stroke: string; strokeWidth: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; maxWidth?: number },
) {
  if (opts.maxWidth) fitFont(ctx, s, opts.maxWidth, opts.size, 900);
  else font(ctx, opts.size, 900);
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = opts.baseline ?? "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = opts.strokeWidth;
  ctx.strokeStyle = opts.stroke;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = opts.color;
  ctx.fillText(s, x, y);
}

export function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function fillBackground(ctx: Ctx, theme: Theme, w: number, h: number) {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, w, h);
}

/** クロマキー用テーマのときだけ、図の下に暗い板を敷く */
export function panel(ctx: Ctx, theme: Theme, x: number, y: number, w: number, h: number) {
  if (!theme.panel) return;
  ctx.fillStyle = theme.panel;
  roundRect(ctx, x, y, w, h, 32);
  ctx.fill();
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 2, dash: number[] = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string | null, stroke?: string, strokeWidth = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

/** 右向きの矢印（「前 → 後」の間に置く） */
export function arrow(ctx: Ctx, x: number, y: number, length: number, thickness: number, color: string) {
  const head = thickness * 2.2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - thickness / 2);
  ctx.lineTo(x + length - head, y - thickness / 2);
  ctx.lineTo(x + length - head, y - head * 0.8);
  ctx.lineTo(x + length, y);
  ctx.lineTo(x + length - head, y + head * 0.8);
  ctx.lineTo(x + length - head, y + thickness / 2);
  ctx.lineTo(x, y + thickness / 2);
  ctx.closePath();
  ctx.fill();
}

export function fmt(v: number | null, digits: number, unit = ""): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}${unit}`;
}

/** 差を「+6.40」「−0.195」のように符号つきで書く */
export function fmtDiff(v: number | null, digits: number, unit = ""): string {
  if (v === null || !Number.isFinite(v)) return "—";
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return `±${s}${unit}`;
  return `${v > 0 ? "+" : "−"}${s}${unit}`;
}

/** 良くなった・悪くなった・どちらでもない の色 */
export function diffColor(theme: Theme, diff: number | null, better: 1 | -1 | 0 | undefined): string {
  if (diff === null || !better || Math.abs(diff) < 1e-9) return theme.subText;
  return diff * better > 0 ? theme.good : theme.bad;
}
