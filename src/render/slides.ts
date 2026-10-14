import { avgRankSignificance, BETTER_DIRECTION, formatProbability, rateSignificance } from "../lib/compare";
import { FIELD_META, RANK_LABELS, type NumericKey, type PeriodStats } from "../lib/types";
import {
  arrow,
  circle,
  diffColor,
  fillBackground,
  fitFont,
  fmt,
  fmtDiff,
  font,
  line,
  outlinedText,
  panel,
  roundRect,
  text,
  type Ctx,
} from "./draw";
import type { Theme } from "./theme";

export interface Texts {
  /** 動画用の図の見出し */
  title: string;
  beforeLabel: string;
  afterLabel: string;
  /** 推移グラフの区切り線につける文字 */
  markerLabel: string;
  /** サムネイルの大見出し */
  thumbHeadline: string;
  /** サムネイルの小見出し */
  thumbSub: string;
}

export interface RenderInput {
  before: PeriodStats;
  after: PeriodStats;
  /** 推移グラフ用の全期間（開始日の順） */
  periods: PeriodStats[];
  texts: Texts;
  theme: Theme;
}

export interface Design {
  id: string;
  name: string;
  kind: "video" | "thumbnail";
  width: number;
  height: number;
  draw(ctx: Ctx, input: RenderInput): void;
}

const VIDEO_W = 1920;
const VIDEO_H = 1080;
const THUMB_W = 1280;
const THUMB_H = 720;
const M = 110; // 動画用の余白

/** 図の下地の色（白抜きの点を塗るのに使う） */
const surface = (theme: Theme) => theme.panel ?? theme.background;

const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);

function sub(p: PeriodStats): string {
  const parts = [p.room && `${p.room}の間`, p.games !== null && `${p.games.toLocaleString()}戦`].filter(Boolean);
  return parts.join(" ・ ");
}

function header(ctx: Ctx, input: RenderInput, title: string) {
  const { theme, before, after, texts } = input;
  text(ctx, title, M, 150, { size: 64, weight: 900, color: theme.text, maxWidth: VIDEO_W - M * 2 - 520 });
  const line2 = `${texts.beforeLabel}（${sub(before) || "—"}）  →  ${texts.afterLabel}（${sub(after) || "—"}）`;
  text(ctx, line2, M, 210, { size: 30, color: theme.subText, maxWidth: VIDEO_W - M * 2 });
}

function footer(ctx: Ctx, input: RenderInput, note: string) {
  if (!note) return;
  text(ctx, note, VIDEO_W - M, VIDEO_H - 92, { size: 26, color: input.theme.mutedText, align: "right" });
}

function significanceNote(input: RenderInput): string {
  const s = avgRankSignificance(input.before, input.after);
  return s ? `平均順位の差が偶然で出る確率: ${formatProbability(s.p)}` : "";
}

/** 「前の値 → 後の値」を横に並べる。全体の幅を返す */
function beforeAfter(
  ctx: Ctx,
  x: number,
  y: number,
  a: string,
  b: string,
  opts: { size: number; theme: Theme; align?: "left" | "center" },
): number {
  const { theme, size } = opts;
  font(ctx, Math.round(size * 0.72), 700);
  const wa = ctx.measureText(a).width;
  font(ctx, size, 900);
  const wb = ctx.measureText(b).width;
  const gap = size * 0.25;
  const arrowLen = size * 0.7;
  const total = wa + gap + arrowLen + gap + wb;
  let cx = opts.align === "center" ? x - total / 2 : x;
  text(ctx, a, cx, y, { size: Math.round(size * 0.72), weight: 700, color: theme.before });
  cx += wa + gap;
  arrow(ctx, cx, y - size * 0.3, arrowLen, Math.max(4, size * 0.09), theme.mutedText);
  cx += arrowLen + gap;
  text(ctx, b, cx, y, { size, weight: 900, color: theme.accent });
  return total;
}

// ───────────────────────── 動画用 ─────────────────────────

const hero: Design = {
  id: "hero",
  name: "結果まとめ",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, before, after } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    header(ctx, input, input.texts.title);

    // 主役: 平均順位
    text(ctx, "平均順位", VIDEO_W / 2, 360, { size: 40, weight: 700, color: theme.subText, align: "center" });
    beforeAfter(ctx, VIDEO_W / 2, 560, fmt(before.avgRank, 3), fmt(after.avgRank, 3), { size: 210, theme, align: "center" });
    const d = diff(before.avgRank, after.avgRank);
    text(ctx, `${fmtDiff(d, 3)}（${d !== null && d < 0 ? "改善" : d !== null && d > 0 ? "悪化" : "変化なし"}）`, VIDEO_W / 2, 650, {
      size: 44,
      weight: 700,
      color: diffColor(theme, d, -1),
      align: "center",
    });

    // 下の3つのカード
    const tiles: { label: string; a: string; b: string; d: string; color: string }[] = [
      {
        label: "1位率",
        a: fmt(before.rankRates[0], 1, "%"),
        b: fmt(after.rankRates[0], 1, "%"),
        d: fmtDiff(diff(before.rankRates[0], after.rankRates[0]), 1, "pt"),
        color: diffColor(theme, diff(before.rankRates[0], after.rankRates[0]), 1),
      },
      {
        label: "4位率",
        a: fmt(before.rankRates[3], 1, "%"),
        b: fmt(after.rankRates[3], 1, "%"),
        d: fmtDiff(diff(before.rankRates[3], after.rankRates[3]), 1, "pt"),
        color: diffColor(theme, diff(before.rankRates[3], after.rankRates[3]), -1),
      },
      {
        label: "安定段位",
        a: before.stableRank || "—",
        b: after.stableRank || "—",
        d: "",
        color: theme.subText,
      },
    ];
    const tileW = (VIDEO_W - M * 2 - 60) / 3;
    tiles.forEach((t, i) => {
      const x = M + i * (tileW + 30);
      const y = 730;
      ctx.fillStyle = theme.grid;
      roundRect(ctx, x, y, tileW, 230, 24);
      ctx.fill();
      text(ctx, t.label, x + 40, y + 62, { size: 34, weight: 700, color: theme.subText });
      if (t.d) text(ctx, t.d, x + tileW - 40, y + 62, { size: 34, weight: 700, color: t.color, align: "right" });
      beforeAfter(ctx, x + tileW / 2, y + 170, t.a, t.b, { size: 76, theme, align: "center" });
    });
    footer(ctx, input, significanceNote(input));
  },
};

/** 横に積み上げた順位の帯を1本描く */
function rankBar(ctx: Ctx, theme: Theme, rates: PeriodStats["rankRates"], x: number, y: number, w: number, h: number, labelSize: number) {
  const total = rates.reduce<number>((a, r) => a + (r ?? 0), 0) || 100;
  let cx = x;
  const gap = 3;
  rates.forEach((r, k) => {
    const sw = ((r ?? 0) / total) * w;
    if (sw <= 0) return;
    ctx.fillStyle = theme.rank[k];
    const radius: [number, number, number, number] = [k === 0 ? 10 : 0, k === 3 ? 10 : 0, k === 3 ? 10 : 0, k === 0 ? 10 : 0];
    roundRect(ctx, cx + (k ? gap / 2 : 0), y, sw - (k ? gap / 2 : 0) - (k < 3 ? gap / 2 : 0), h, radius);
    ctx.fill();
    // 帯の中に「1位 22.2%」。狭ければ数字だけ
    const full = `${RANK_LABELS[k]} ${fmt(r, 1, "%")}`;
    const short = fmt(r, 1, "%");
    font(ctx, labelSize, 700);
    const s = ctx.measureText(full).width < sw - 24 ? full : ctx.measureText(short).width < sw - 12 ? short : "";
    if (s) text(ctx, s, cx + sw / 2, y + h / 2, { size: labelSize, weight: 700, color: theme.rankLabel[k], align: "center", baseline: "middle" });
    cx += sw;
  });
}

function rankLegend(ctx: Ctx, theme: Theme, xRight: number, y: number, size = 28) {
  let x = xRight;
  for (let k = 3; k >= 0; k--) {
    font(ctx, size, 500);
    const w = ctx.measureText(RANK_LABELS[k]).width;
    x -= w;
    text(ctx, RANK_LABELS[k], x, y, { size, weight: 500, color: theme.subText, baseline: "middle" });
    x -= size * 0.9 + 10;
    ctx.fillStyle = theme.rank[k];
    roundRect(ctx, x, y - size * 0.45, size * 0.9, size * 0.9, 4);
    ctx.fill();
    x -= 34;
  }
}

const ranks: Design = {
  id: "ranks",
  name: "順位の割合",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, before, after, texts } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    header(ctx, input, "順位の割合");
    rankLegend(ctx, theme, VIDEO_W - M, 140);

    const x = M + 300;
    const w = VIDEO_W - x - M;
    const h = 170;
    const rows = [
      { p: before, label: texts.beforeLabel, y: 330 },
      { p: after, label: texts.afterLabel, y: 600 },
    ];
    // 帯と帯の境目を点線でつなぎ、どこが伸びて縮んだか見せる
    const edges = (p: PeriodStats) => {
      const total = p.rankRates.reduce<number>((a, r) => a + (r ?? 0), 0) || 100;
      let acc = 0;
      return p.rankRates.slice(0, 3).map((r) => (acc += r ?? 0) / total);
    };
    const eb = edges(before);
    const ea = edges(after);
    eb.forEach((e, i) => line(ctx, x + e * w, rows[0].y + h + 6, x + ea[i] * w, rows[1].y - 6, theme.mutedText, 2, [8, 8]));

    for (const r of rows) {
      text(ctx, r.label, M, r.y + h / 2 - 8, { size: 44, weight: 900, color: theme.text, baseline: "middle", maxWidth: 280 });
      text(ctx, sub(r.p), M, r.y + h / 2 + 40, { size: 26, color: theme.subText, baseline: "middle", maxWidth: 280 });
      rankBar(ctx, theme, r.p.rankRates, x, r.y, w, h, 40);
    }

    // 1位と4位の増減
    const d1 = diff(before.rankRates[0], after.rankRates[0]);
    const d4 = diff(before.rankRates[3], after.rankRates[3]);
    const s1 = rateSignificance(before.rankRates[0], before.games, after.rankRates[0], after.games);
    const s4 = rateSignificance(before.rankRates[3], before.games, after.rankRates[3], after.games);
    text(ctx, `1位 ${fmtDiff(d1, 1, "pt")}`, x, 870, { size: 48, weight: 900, color: diffColor(theme, d1, 1) });
    text(ctx, `4位 ${fmtDiff(d4, 1, "pt")}`, x + 420, 870, { size: 48, weight: 900, color: diffColor(theme, d4, -1) });
    const notes = [s1 && `1位率の差が偶然で出る確率: ${formatProbability(s1.p)}`, s4 && `4位率: ${formatProbability(s4.p)}`].filter(Boolean);
    footer(ctx, input, notes.join("　"));
  },
};

type DumbbellKey = NumericKey | "rank1" | "rank4";
const DUMBBELL_ROWS: { key: DumbbellKey; label: string }[] = [
  { key: "rank1", label: "1位率" },
  { key: "rank4", label: "4位率" },
  { key: "winRate", label: "和了率" },
  { key: "dealInRate", label: "放銃率" },
  { key: "callRate", label: "副露率" },
  { key: "riichiRate", label: "立直率" },
  { key: "damaRate", label: "ダマ率" },
  { key: "bustRate", label: "飛び率" },
];

function pick(p: PeriodStats, key: DumbbellKey): number | null {
  if (key === "rank1") return p.rankRates[0];
  if (key === "rank4") return p.rankRates[3];
  return p[key];
}

const dumbbell: Design = {
  id: "dumbbell",
  name: "何が変わった？",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, before, after, texts } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    header(ctx, input, "何が変わった？");

    // 凡例
    const ly = 140;
    let lx = VIDEO_W - M;
    font(ctx, 28, 500);
    lx -= ctx.measureText(texts.afterLabel).width;
    text(ctx, texts.afterLabel, lx, ly, { size: 28, weight: 500, color: theme.subText, baseline: "middle" });
    circle(ctx, lx - 24, ly, 13, theme.accent);
    font(ctx, 28, 500);
    lx -= 64 + ctx.measureText(texts.beforeLabel).width;
    text(ctx, texts.beforeLabel, lx, ly, { size: 28, weight: 500, color: theme.subText, baseline: "middle" });
    circle(ctx, lx - 24, ly, 11, surface(theme), theme.before, 4);

    const rows = DUMBBELL_ROWS.filter((r) => pick(before, r.key) !== null && pick(after, r.key) !== null);
    const max = Math.max(10, ...rows.flatMap((r) => [pick(before, r.key)!, pick(after, r.key)!]));
    const axisMax = Math.min(100, Math.ceil((max * 1.1) / 10) * 10);
    const tick = axisMax > 60 ? 20 : 10;
    const x0 = M + 230;
    const x1 = VIDEO_W - M - 260;
    const top = 290;
    const rowH = Math.min(92, (VIDEO_H - top - 130) / Math.max(1, rows.length));
    const sx = (v: number) => x0 + (v / axisMax) * (x1 - x0);

    // 目盛り
    for (let v = 0; v <= axisMax; v += tick) {
      line(ctx, sx(v), top - 30, sx(v), top + rowH * rows.length - 20, theme.grid, 2);
      text(ctx, `${v}%`, sx(v), top + rowH * rows.length + 16, { size: 24, color: theme.mutedText, align: "center" });
    }
    text(ctx, "差", VIDEO_W - M, top - 40, { size: 24, color: theme.mutedText, align: "right" });

    rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2 - 20;
      const a = pick(before, r.key)!;
      const b = pick(after, r.key)!;
      const d = b - a;
      const color = diffColor(theme, d, BETTER_DIRECTION[r.key]);
      text(ctx, r.label, M, y, { size: 34, weight: 700, color: theme.text, baseline: "middle" });
      line(ctx, sx(a), y, sx(b), y, color, 8);
      circle(ctx, sx(a), y, 13, surface(theme), theme.before, 4);
      circle(ctx, sx(b), y, 15, theme.accent);
      // 値は、点どうしが重ならない外側に置く
      const left = Math.min(a, b);
      const leftIsBefore = a <= b;
      text(ctx, fmt(left, 1), sx(left) - 26, y, { size: 26, weight: leftIsBefore ? 500 : 700, color: leftIsBefore ? theme.before : theme.text, align: "right", baseline: "middle" });
      const right = Math.max(a, b);
      text(ctx, fmt(right, 1), sx(right) + 26, y, { size: 26, weight: leftIsBefore ? 700 : 500, color: leftIsBefore ? theme.text : theme.before, baseline: "middle" });
      text(ctx, fmtDiff(d, 2, "pt"), VIDEO_W - M, y, { size: 34, weight: 900, color, align: "right", baseline: "middle" });
    });
    footer(ctx, input, "緑＝良くなった　赤＝悪くなった　灰＝良し悪しのない項目");
  },
};

const trend: Design = {
  id: "trend",
  name: "平均順位の推移",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, after, texts } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    text(ctx, "平均順位の推移", M, 150, { size: 64, weight: 900, color: theme.text });
    text(ctx, "上に行くほど良い成績", M, 210, { size: 30, color: theme.subText });

    const pts = input.periods.filter((p) => p.avgRank !== null);
    if (pts.length < 2) {
      text(ctx, "期間ごとのスクリーンショットを2枚以上読み込むと、推移を表示できます", VIDEO_W / 2, VIDEO_H / 2, {
        size: 36,
        color: theme.subText,
        align: "center",
      });
      return;
    }
    const values = pts.map((p) => p.avgRank!);
    const lo = Math.floor((Math.min(...values, 2.5) - 0.05) * 20) / 20;
    const hi = Math.ceil((Math.max(...values, 2.5) + 0.05) * 20) / 20;
    const x0 = M + 120;
    const x1 = VIDEO_W - M - 60;
    const y0 = 300;
    const y1 = VIDEO_H - 230;
    // 平均順位は小さいほど良いので、小さい値を上に描く
    const sy = (v: number) => y0 + ((v - lo) / (hi - lo)) * (y1 - y0);
    // 両端の点が目盛りの文字とぶつからないよう、内側に寄せる
    const inset = 110;
    const sx = (i: number) => x0 + inset + (i / (pts.length - 1)) * (x1 - x0 - inset * 2);

    const step = hi - lo > 0.6 ? 0.2 : hi - lo > 0.3 ? 0.1 : 0.05;
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
      line(ctx, x0 - 20, sy(v), x1 + 20, sy(v), theme.grid, 2);
      text(ctx, v.toFixed(2), x0 - 36, sy(v), { size: 24, color: theme.mutedText, align: "right", baseline: "middle" });
    }
    // 4人の平均（2.5）
    line(ctx, x0 - 20, sy(2.5), x1 + 20, sy(2.5), theme.mutedText, 2, [10, 10]);
    text(ctx, "平均 2.5", x1 + 20, sy(2.5) - 14, { size: 22, color: theme.mutedText, align: "right" });

    // 区切り（学んだ時点）: 「後」の期間の直前
    const idx = pts.findIndex((p) => p.id === after.id);
    if (idx > 0) {
      const mx = (sx(idx - 1) + sx(idx)) / 2;
      line(ctx, mx, y0 - 30, mx, y1 + 20, theme.accent, 4, [16, 12]);
      text(ctx, texts.markerLabel, mx + 16, y0 - 10, { size: 32, weight: 900, color: theme.accent });
    }

    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(sx(i), sy(p.avgRank!)) : ctx.moveTo(sx(i), sy(p.avgRank!))));
    ctx.stroke();
    pts.forEach((p, i) => {
      const isAfter = idx >= 0 && i >= idx;
      circle(ctx, sx(i), sy(p.avgRank!), 14, isAfter ? theme.accent : theme.before, surface(theme), 4);
      text(ctx, p.avgRank!.toFixed(3), sx(i), sy(p.avgRank!) - 32, { size: 30, weight: 900, color: theme.text, align: "center" });
      const label = p.label || (p.startDate ? `${p.startDate.slice(0, 7)}〜` : `期間${i + 1}`);
      text(ctx, label, sx(i), y1 + 70, { size: 26, weight: 700, color: theme.subText, align: "center", maxWidth: Math.max(120, (x1 - x0) / pts.length - 12) });
      if (p.games !== null) text(ctx, `${p.games}戦`, sx(i), y1 + 106, { size: 22, color: theme.mutedText, align: "center" });
    });
  },
};

const TABLE_ROWS: { label: string; get: (p: PeriodStats) => number | string | null; digits: number; unit: string; better?: 1 | -1 | 0 }[] = [
  ...FIELD_META.map((f) => ({ label: f.label, get: (p: PeriodStats) => p[f.key], digits: f.digits, unit: f.unit, better: BETTER_DIRECTION[f.key] })),
  ...RANK_LABELS.map((l, k) => ({ label: `${l}率`, get: (p: PeriodStats) => p.rankRates[k], digits: 2, unit: "%", better: k === 0 ? 1 : k === 3 ? -1 : 0 }) as const),
  { label: "記録段位", get: (p) => p.recordRank || null, digits: 0, unit: "" },
  { label: "安定段位", get: (p) => p.stableRank || null, digits: 0, unit: "" },
];

const table: Design = {
  id: "table",
  name: "成績表",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, before, after, texts } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    header(ctx, input, "成績の比較");
    const perCol = Math.ceil(TABLE_ROWS.length / 2);
    const colW = (VIDEO_W - M * 2 - 80) / 2;
    const top = 290;
    const rowH = Math.min(58, (VIDEO_H - top - 90) / (perCol + 1));
    for (let c = 0; c < 2; c++) {
      const x = M + c * (colW + 80);
      const cols = [x + colW * 0.42, x + colW * 0.66, x + colW];
      text(ctx, texts.beforeLabel, cols[0], top, { size: 24, weight: 700, color: theme.mutedText, align: "right", maxWidth: colW * 0.22 });
      text(ctx, texts.afterLabel, cols[1], top, { size: 24, weight: 700, color: theme.mutedText, align: "right", maxWidth: colW * 0.22 });
      text(ctx, "差", cols[2], top, { size: 24, weight: 700, color: theme.mutedText, align: "right" });
      TABLE_ROWS.slice(c * perCol, (c + 1) * perCol).forEach((r, i) => {
        const y = top + (i + 1) * rowH;
        if (i % 2 === 0) {
          ctx.fillStyle = theme.grid;
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x - 16, y - rowH * 0.68, colW + 32, rowH);
          ctx.globalAlpha = 1;
        }
        const a = r.get(before);
        const b = r.get(after);
        const show = (v: number | string | null) => (typeof v === "number" ? fmt(v, r.digits, r.unit) : v ?? "—");
        text(ctx, r.label, x, y, { size: 28, weight: 700, color: theme.text });
        text(ctx, show(a), cols[0], y, { size: 28, color: theme.before, align: "right" });
        text(ctx, show(b), cols[1], y, { size: 28, weight: 700, color: theme.text, align: "right" });
        if (typeof a === "number" && typeof b === "number") {
          const d = b - a;
          text(ctx, fmtDiff(d, r.digits, r.unit === "%" ? "pt" : ""), cols[2], y, { size: 28, weight: 700, color: diffColor(theme, d, r.better), align: "right" });
        }
      });
    }
  },
};

// ───────────────────────── サムネイル ─────────────────────────

const RANK_NAMES: Record<string, string> = { 初: "初心", 士: "雀士", 傑: "雀傑", 豪: "雀豪", 聖: "雀聖", 魂: "魂天" };
function rankName(rank: string): string {
  return RANK_NAMES[rank.charAt(0)] ?? (rank || "?");
}

function thumbBase(ctx: Ctx, theme: Theme) {
  fillBackground(ctx, theme, THUMB_W, THUMB_H);
  // 斜めの帯で動きを出す
  ctx.save();
  ctx.globalAlpha = theme.id === "light" ? 0.12 : 0.18;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(THUMB_W * 0.55, 0);
  ctx.lineTo(THUMB_W, 0);
  ctx.lineTo(THUMB_W, THUMB_H);
  ctx.lineTo(THUMB_W * 0.3, THUMB_H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function thumbStyle(theme: Theme) {
  return theme.id === "light" ? { fg: "#111111", stroke: "#ffffff" } : { fg: "#ffffff", stroke: "#000000" };
}

function thumbHeadlines(ctx: Ctx, input: RenderInput) {
  const { theme, texts } = input;
  const st = thumbStyle(theme);
  outlinedText(ctx, texts.thumbHeadline, THUMB_W / 2, 110, { size: 92, color: st.fg, stroke: st.stroke, strokeWidth: 18, maxWidth: THUMB_W - 80 });
  if (texts.thumbSub) outlinedText(ctx, texts.thumbSub, THUMB_W / 2, THUMB_H - 70, { size: 54, color: theme.accent, stroke: st.stroke, strokeWidth: 14, maxWidth: THUMB_W - 80 });
}

const thumbNumbers: Design = {
  id: "thumb-numbers",
  name: "サムネ: 平均順位",
  kind: "thumbnail",
  width: THUMB_W,
  height: THUMB_H,
  draw(ctx, input) {
    const { theme, before, after } = input;
    const st = thumbStyle(theme);
    thumbBase(ctx, theme);
    thumbHeadlines(ctx, input);
    outlinedText(ctx, "平均順位", THUMB_W / 2, 240, { size: 56, color: st.fg, stroke: st.stroke, strokeWidth: 12 });
    const a = fmt(before.avgRank, 2);
    const b = fmt(after.avgRank, 2);
    const size = fitFont(ctx, `${a}→${b}`, THUMB_W - 140, 210, 900);
    font(ctx, size * 0.75, 900);
    const wa = ctx.measureText(a).width;
    font(ctx, size, 900);
    const wb = ctx.measureText(b).width;
    const arrowLen = size * 0.55;
    const total = wa + arrowLen + size * 0.3 + wb;
    let x = (THUMB_W - total) / 2;
    const y = 420;
    outlinedText(ctx, a, x + wa / 2, y, { size: size * 0.75, color: theme.id === "light" ? "#666666" : "#c4c2b8", stroke: st.stroke, strokeWidth: 16 });
    x += wa + size * 0.15;
    arrow(ctx, x, y, arrowLen, size * 0.12, theme.accent);
    x += arrowLen + size * 0.15;
    outlinedText(ctx, b, x + wb / 2, y, { size, color: theme.accent, stroke: st.stroke, strokeWidth: 22 });
  },
};

const thumbRank: Design = {
  id: "thumb-rank",
  name: "サムネ: 段位",
  kind: "thumbnail",
  width: THUMB_W,
  height: THUMB_H,
  draw(ctx, input) {
    const { theme, before, after } = input;
    const st = thumbStyle(theme);
    thumbBase(ctx, theme);
    thumbHeadlines(ctx, input);
    const a = rankName(before.recordRank || before.stableRank);
    const b = rankName(after.recordRank || after.stableRank);
    const y = 380;
    outlinedText(ctx, a, THUMB_W * 0.25, y, { size: 210, color: theme.id === "light" ? "#666666" : "#c4c2b8", stroke: st.stroke, strokeWidth: 22 });
    arrow(ctx, THUMB_W * 0.44, y, THUMB_W * 0.12, 34, theme.accent);
    outlinedText(ctx, b, THUMB_W * 0.75, y, { size: 250, color: theme.accent, stroke: st.stroke, strokeWidth: 26 });
    const extra = `平均順位 ${fmt(before.avgRank, 2)} → ${fmt(after.avgRank, 2)}`;
    outlinedText(ctx, extra, THUMB_W / 2, 545, { size: 50, color: st.fg, stroke: st.stroke, strokeWidth: 12 });
  },
};

const thumbBars: Design = {
  id: "thumb-bars",
  name: "サムネ: 順位の割合",
  kind: "thumbnail",
  width: THUMB_W,
  height: THUMB_H,
  draw(ctx, input) {
    const { theme, before, after, texts } = input;
    const st = thumbStyle(theme);
    thumbBase(ctx, theme);
    thumbHeadlines(ctx, input);
    const x = 250;
    const w = THUMB_W - x - 60;
    const rows = [
      { p: before, label: texts.beforeLabel, y: 215 },
      { p: after, label: texts.afterLabel, y: 395 },
    ];
    for (const r of rows) {
      outlinedText(ctx, r.label, 140, r.y + 65, { size: 52, color: st.fg, stroke: st.stroke, strokeWidth: 12, maxWidth: 220 });
      rankBar(ctx, theme, r.p.rankRates, x, r.y, w, 130, 36);
    }
  },
};

export const DESIGNS: Design[] = [hero, ranks, dumbbell, trend, table, thumbNumbers, thumbRank, thumbBars];
