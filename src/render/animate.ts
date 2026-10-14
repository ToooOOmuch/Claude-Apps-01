import { FIELD_META, type PeriodStats } from "../lib/types";
import type { Design, RenderInput } from "./slides";

const lerp = (a: number | null, b: number | null, t: number) => (a === null || b === null ? b : a + (b - a) * t);

/** 「前」から「後」へ、数値を途中まで動かした成績を作る（文字の項目は「後」のまま） */
export function lerpPeriod(from: PeriodStats, to: PeriodStats, t: number): PeriodStats {
  const out: PeriodStats = { ...to, rankRates: [...to.rankRates] as PeriodStats["rankRates"] };
  for (const f of FIELD_META) (out[f.key] as number | null) = lerp(from[f.key], to[f.key], t);
  out.rankRates = to.rankRates.map((r, k) => lerp(from.rankRates[k], r, t)) as PeriodStats["rankRates"];
  // 対戦数は動かすと不自然なので「後」のまま
  out.games = to.games;
  return out;
}

/** 最初は速く、最後はゆっくり止まる */
export const easeOutCubic = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** アニメーションの途中（t: 0〜1）の描画用データ */
export function frameInput(input: RenderInput, t: number): RenderInput {
  const e = easeOutCubic(t);
  return { ...input, after: lerpPeriod(input.before, input.after, e), target: input.after, progress: e };
}

export interface RecordOptions {
  /** 「前」から「後」へ動く時間（ミリ秒） */
  animateMs?: number;
  /** 動き終わってから止めておく時間（ミリ秒） */
  holdMs?: number;
  onProgress?(ratio: number): void;
}

/** ブラウザが録画できる形式。MP4 が使えればそちらを優先する（動画編集ソフトで扱いやすいため） */
export function pickVideoType(): { mimeType: string; ext: "mp4" | "webm" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.640028", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm", "webm"],
  ];
  const hit = candidates.find(([t]) => MediaRecorder.isTypeSupported(t));
  return hit ? { mimeType: hit[0], ext: hit[1] } : null;
}

/** 図が「前」から「後」へ動く様子を、キャンバスごと録画する */
export async function recordDesign(canvas: HTMLCanvasElement, design: Design, input: RenderInput, opts: RecordOptions = {}): Promise<{ blob: Blob; ext: string }> {
  const type = pickVideoType();
  if (!type) throw new Error("このブラウザは動画の書き出しに対応していません（Chrome か Edge をお使いください）");
  const animateMs = opts.animateMs ?? 1600;
  const holdMs = opts.holdMs ?? 2400;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, { mimeType: type.mimeType, videoBitsPerSecond: 16_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  const draw = (t: number) => {
    ctx.reset();
    design.draw(ctx, frameInput(input, t));
  };
  draw(0);
  recorder.start();
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      // 止まっている間も毎フレーム描き直す（描き直さないと録画にフレームが入らない）
      draw(elapsed / animateMs);
      opts.onProgress?.(Math.min(1, elapsed / (animateMs + holdMs)));
      if (elapsed < animateMs + holdMs) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  // 録画が終わったら、止まった状態の図に戻す
  ctx.reset();
  design.draw(ctx, input);
  return { blob: new Blob(chunks, { type: type.mimeType.split(";")[0] }), ext: type.ext };
}
