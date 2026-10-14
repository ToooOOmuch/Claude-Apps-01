import { avgRankSignificance, BETTER_DIRECTION, formatProbability, rateSignificance } from "../lib/compare";
import { FIELD_META, RANK_LABELS, type PeriodStats } from "../lib/types";
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
import {
  avgRankHeadline,
  changes,
  contrastHeadline,
  per100,
  per100Headline,
  rankHeadline,
  SMALL_CHANGE,
  splitChanges,
  type Change,
  type MetricKey,
} from "./insights";
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
  /**
   * アニメーション中の進み具合（0〜1）。録画のときだけ使う。
   * 録画中の after は途中の値になるので、見出しには最終的な値（target）を使う
   */
  progress?: number;
  target?: PeriodStats;
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

/** 見出しに使う「後」の値（アニメーション中でも最終的な値） */
const finalAfter = (input: RenderInput) => input.target ?? input.after;

/** 良くなったら緑、悪くなったら赤、どちらでもなければ灰 */
const verdictColor = (theme: Theme, c: Change) => (c.verdict === 1 ? theme.good : c.verdict === -1 ? theme.bad : theme.subText);

function sub(p: PeriodStats): string {
  const parts = [p.room && `${p.room}の間`, p.games !== null && `${p.games.toLocaleString()}戦`].filter(Boolean);
  return parts.join(" ・ ");
}

/**
 * スライドの上部。小さな見出し（何の図か）と、大きな見出し（この図の結論）を出す。
 * 結論を先に見せると、動画で一瞬映っただけでも伝わる
 */
function header(ctx: Ctx, input: RenderInput, kicker: string, headline: string, reserveRight = 0) {
  const { theme } = input;
  text(ctx, kicker, M, 128, { size: 32, weight: 700, color: theme.accent, maxWidth: VIDEO_W - M * 2 - reserveRight });
  text(ctx, headline, M, 206, { size: 62, weight: 900, color: theme.text, maxWidth: VIDEO_W - M * 2 - reserveRight });
}

/** スライドの下部。左に比べている期間、右に補足 */
function footer(ctx: Ctx, input: RenderInput, note = "") {
  const { theme, before, after, texts } = input;
  const left = `${texts.beforeLabel}: ${sub(before) || "—"}　→　${texts.afterLabel}: ${sub(after) || "—"}`;
  text(ctx, left, M, VIDEO_H - 92, { size: 24, color: theme.mutedText, maxWidth: note ? 900 : VIDEO_W - M * 2 });
  if (note) text(ctx, note, VIDEO_W - M, VIDEO_H - 92, { size: 24, color: theme.mutedText, align: "right", maxWidth: VIDEO_W - M * 2 - 940 });
}

/** 「改善」「悪化」「変化小」の札。色だけに頼らず文字でも示す */
function verdictBadge(ctx: Ctx, theme: Theme, x: number, y: number, c: Pick<Change, "verdict" | "diff">, size = 26, align: "left" | "right" = "left") {
  if (c.verdict === 0) return 0;
  const label = c.verdict === 1 ? "改善" : "悪化";
  const color = c.verdict === 1 ? theme.good : theme.bad;
  font(ctx, size, 700);
  const w = ctx.measureText(label).width + size;
  const h = size * 1.5;
  const bx = align === "right" ? x - w : x;
  ctx.fillStyle = color;
  roundRect(ctx, bx, y - h / 2, w, h, h / 2);
  ctx.fill();
  text(ctx, label, bx + w / 2, y + 1, { size, weight: 700, color: theme.id === "light" ? "#ffffff" : "#0b0f14", align: "center", baseline: "middle" });
  return w;
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
    header(ctx, input, "結果まとめ", input.texts.title);

    // 主役: 平均順位
    text(ctx, "平均順位", VIDEO_W / 2, 340, { size: 40, weight: 700, color: theme.subText, align: "center" });
    beforeAfter(ctx, VIDEO_W / 2, 540, fmt(before.avgRank, 3), fmt(after.avgRank, 3), { size: 200, theme, align: "center" });
    const [avg] = changes(before, after, ["avgRank"]);
    if (avg) {
      const label = `${fmtDiff(avg.diff, 3)}`;
      font(ctx, 44, 700);
      const lw = ctx.measureText(label).width;
      font(ctx, 30, 700);
      const bw = ctx.measureText("改善").width + 30;
      const x = VIDEO_W / 2 - (lw + 20 + bw) / 2;
      text(ctx, label, x, 640, { size: 44, weight: 700, color: diffColor(theme, avg.diff, -1), baseline: "middle" });
      verdictBadge(ctx, theme, x + lw + 20, 638, avg, 30);
    }

    // 下の3つのカード
    const [top, last] = changes(before, after, ["rank1", "rank4"]);
    const tiles: { label: string; a: string; b: string; change?: Change }[] = [
      { label: "トップ率", a: fmt(before.rankRates[0], 1, "%"), b: fmt(after.rankRates[0], 1, "%"), change: top },
      { label: "ラス率", a: fmt(before.rankRates[3], 1, "%"), b: fmt(after.rankRates[3], 1, "%"), change: last },
      { label: "安定段位", a: before.stableRank || "—", b: after.stableRank || "—" },
    ];
    const tileW = (VIDEO_W - M * 2 - 60) / 3;
    tiles.forEach((t, i) => {
      const x = M + i * (tileW + 30);
      const y = 720;
      ctx.fillStyle = theme.grid;
      roundRect(ctx, x, y, tileW, 220, 24);
      ctx.fill();
      text(ctx, t.label, x + 36, y + 58, { size: 34, weight: 700, color: theme.text });
      if (t.change) {
        const bw = verdictBadge(ctx, theme, x + tileW - 36, y + 46, t.change, 24, "right");
        text(ctx, fmtDiff(t.change.diff, 1, "pt"), x + tileW - 48 - bw, y + 58, { size: 30, weight: 700, color: verdictColor(theme, t.change), align: "right" });
      }
      beforeAfter(ctx, x + tileW / 2, y + 168, t.a, t.b, { size: 72, theme, align: "center" });
    });
    footer(ctx, input, significanceNote(input));
  },
};

/** 「変わったもの」と「ほとんど変わらなかったもの」を左右に並べる */
const contrast: Design = {
  id: "contrast",
  name: "変わった・変わらなかった",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, before, after } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    header(ctx, input, "変わったもの・変わらなかったもの", contrastHeadline(before, finalAfter(input)));
    // どの列に入れるかは最終的な値で決め、表示する値はアニメーション中の値にする
    const { big, small } = splitChanges(before, finalAfter(input));
    const now = new Map(changes(before, after).map((c) => [c.key, c]));
    const current = (list: Change[]) => list.map((c) => now.get(c.key) ?? c);
    const colW = (VIDEO_W - M * 2 - 40) / 2;
    const top = 280;
    const h = VIDEO_H - top - 150;

    const column = (x: number, title: string, note: string, items: Change[], emphasize: boolean) => {
      ctx.fillStyle = theme.grid;
      ctx.globalAlpha = emphasize ? 1 : 0.55;
      roundRect(ctx, x, top, colW, h, 28);
      ctx.fill();
      ctx.globalAlpha = 1;
      text(ctx, title, x + 44, top + 76, { size: 44, weight: 900, color: emphasize ? theme.accent : theme.subText });
      text(ctx, note, x + colW - 44, top + 76, { size: 24, color: theme.mutedText, align: "right" });
      if (!items.length) {
        text(ctx, "該当なし", x + 44, top + 170, { size: 34, color: theme.mutedText });
        return;
      }
      const rowH = Math.min(emphasize ? 150 : 120, (h - 130) / items.length);
      items.forEach((c, i) => {
        const y = top + 130 + i * rowH + rowH / 2;
        text(ctx, c.label, x + 44, y - (emphasize ? 18 : 0), { size: emphasize ? 44 : 36, weight: 700, color: emphasize ? theme.text : theme.subText, baseline: "middle" });
        if (emphasize) {
          text(ctx, `${fmt(c.before, 1, "%")} → ${fmt(c.after, 1, "%")}`, x + 44, y + 34, { size: 30, color: theme.subText, baseline: "middle" });
          const bw = verdictBadge(ctx, theme, x + colW - 44, y - 18, c, 26, "right");
          text(ctx, fmtDiff(c.diff, 1, "pt"), x + colW - 44 - bw - (bw ? 16 : 0), y - 16, { size: 56, weight: 900, color: verdictColor(theme, c), align: "right", baseline: "middle" });
        } else {
          text(ctx, `${fmt(c.before, 1, "%")} → ${fmt(c.after, 1, "%")}`, x + colW * 0.42, y, { size: 32, color: theme.subText, baseline: "middle" });
          text(ctx, fmtDiff(c.diff, 1, "pt"), x + colW - 44, y, { size: 32, weight: 700, color: theme.mutedText, align: "right", baseline: "middle" });
        }
      });
    };
    column(M, "ほとんど同じ", `差 ${SMALL_CHANGE}pt 未満`, current(small.slice(0, 5)), false);
    column(M + colW + 40, "大きく変わった", "差 3pt 以上", current(big.slice(0, 4)), true);
    footer(ctx, input);
  },
};

/** 100戦を100マスで表し、順位ごとに色を塗る */
function waffle(ctx: Ctx, theme: Theme, counts: number[], x: number, y: number, cell: number, gap: number) {
  let n = 0;
  counts.forEach((c, k) => {
    for (let i = 0; i < c && n < 100; i++, n++) {
      const cx = x + (n % 10) * (cell + gap);
      const cy = y + Math.floor(n / 10) * (cell + gap);
      ctx.fillStyle = theme.rank[k];
      roundRect(ctx, cx, cy, cell, cell, 6);
      ctx.fill();
    }
  });
}

const PLACE_NAMES = ["トップ", "2着", "3着", "ラス"];

const waffleSlide: Design = {
  id: "waffle",
  name: "100戦あたり",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, before, after, texts } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    header(ctx, input, "100戦あたりの回数", per100Headline(before, finalAfter(input)));
    const a = per100(before.rankRates);
    const b = per100(after.rankRates);
    if (!a || !b) {
      text(ctx, "順位の割合を入力すると表示できます", VIDEO_W / 2, VIDEO_H / 2, { size: 36, color: theme.subText, align: "center" });
      return;
    }
    const cell = 40;
    const gap = 6;
    const size = cell * 10 + gap * 9;
    const top = 300;
    const xs = [M + 60, VIDEO_W - M - 60 - size];
    [
      { counts: a, label: texts.beforeLabel, x: xs[0] },
      { counts: b, label: texts.afterLabel, x: xs[1] },
    ].forEach((g) => {
      text(ctx, g.label, g.x + size / 2, top - 24, { size: 40, weight: 900, color: theme.text, align: "center" });
      waffle(ctx, theme, g.counts, g.x, top, cell, gap);
      // マスの下に回数
      const itemW = size / 4;
      g.counts.forEach((c, k) => {
        const ix = g.x + k * itemW + itemW / 2;
        text(ctx, PLACE_NAMES[k], ix, top + size + 52, { size: 26, weight: 700, color: theme.subText, align: "center" });
        text(ctx, `${c}回`, ix, top + size + 100, { size: 40, weight: 900, color: theme.text, align: "center" });
        ctx.fillStyle = theme.rank[k];
        roundRect(ctx, ix - 30, top + size + 116, 60, 8, 4);
        ctx.fill();
      });
    });
    // 真ん中に矢印と、トップ・ラスの増減
    const midX = (xs[0] + size + xs[1]) / 2;
    arrow(ctx, midX - 90, top + size / 2, 180, 22, theme.mutedText);
    const [top1, last] = changes(before, after, ["rank1", "rank4"]);
    [
      { c: top1, name: "トップ", dy: -120, d: b[0] - a[0] },
      { c: last, name: "ラス", dy: 120, d: b[3] - a[3] },
    ].forEach(({ c, name, dy, d }) => {
      if (!c) return;
      const color = verdictColor(theme, c);
      text(ctx, `${name} ${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}回`, midX, top + size / 2 + dy, { size: 48, weight: 900, color, align: "center", baseline: "middle" });
    });
    footer(ctx, input, "1マス＝1戦");
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
    header(ctx, input, "順位の割合", rankHeadline(before, finalAfter(input)), 560);
    rankLegend(ctx, theme, VIDEO_W - M, 128);

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

    // トップとラスの増減
    const [c1, c4] = changes(before, after, ["rank1", "rank4"]);
    let cx = x;
    for (const [name, c] of [["トップ", c1], ["ラス", c4]] as const) {
      if (!c) continue;
      const label = `${name} ${fmtDiff(c.diff, 1, "pt")}`;
      text(ctx, label, cx, 870, { size: 48, weight: 900, color: verdictColor(theme, c), baseline: "middle" });
      font(ctx, 48, 900);
      cx += ctx.measureText(label).width + 20;
      cx += verdictBadge(ctx, theme, cx, 868, c, 28) + 70;
    }
    const s1 = rateSignificance(before.rankRates[0], before.games, after.rankRates[0], after.games);
    const s4 = rateSignificance(before.rankRates[3], before.games, after.rankRates[3], after.games);
    const notes = [s1 && `偶然で出る確率 トップ: ${formatProbability(s1.p)}`, s4 && `ラス: ${formatProbability(s4.p)}`].filter(Boolean);
    footer(ctx, input, notes.join("　"));
  },
};

const DUMBBELL_ROWS: MetricKey[] = ["rank1", "rank4", "winRate", "dealInRate", "callRate", "riichiRate", "damaRate", "bustRate"];

const dumbbell: Design = {
  id: "dumbbell",
  name: "項目ごとの変化",
  kind: "video",
  width: VIDEO_W,
  height: VIDEO_H,
  draw(ctx, input) {
    const { theme, before, after, texts } = input;
    fillBackground(ctx, theme, VIDEO_W, VIDEO_H);
    panel(ctx, theme, 60, 60, VIDEO_W - 120, VIDEO_H - 120);
    const rows = changes(before, after, DUMBBELL_ROWS);
    const biggest = changes(before, finalAfter(input), DUMBBELL_ROWS).sort((p, q) => Math.abs(q.diff) - Math.abs(p.diff))[0];
    header(
      ctx,
      input,
      "項目ごとの変化",
      biggest ? `いちばん変わったのは${biggest.label}（${fmtDiff(biggest.diff, 1, "pt")}）` : "項目ごとの変化",
      460,
    );

    // 凡例
    const ly = 128;
    let lx = VIDEO_W - M;
    font(ctx, 28, 500);
    lx -= ctx.measureText(texts.afterLabel).width;
    text(ctx, texts.afterLabel, lx, ly, { size: 28, weight: 500, color: theme.subText, baseline: "middle" });
    circle(ctx, lx - 24, ly, 13, theme.accent);
    font(ctx, 28, 500);
    lx -= 64 + ctx.measureText(texts.beforeLabel).width;
    text(ctx, texts.beforeLabel, lx, ly, { size: 28, weight: 500, color: theme.subText, baseline: "middle" });
    circle(ctx, lx - 24, ly, 11, surface(theme), theme.before, 4);

    const max = Math.max(10, ...rows.flatMap((r) => [r.before, r.after]));
    const axisMax = Math.min(100, Math.ceil((max * 1.1) / 10) * 10);
    const tick = axisMax > 60 ? 20 : 10;
    const x0 = M + 230;
    const x1 = VIDEO_W - M - 330;
    const top = 290;
    const rowH = Math.min(92, (VIDEO_H - top - 150) / Math.max(1, rows.length));
    const sx = (v: number) => x0 + (v / axisMax) * (x1 - x0);

    // 目盛り
    for (let v = 0; v <= axisMax; v += tick) {
      line(ctx, sx(v), top - 30, sx(v), top + rowH * rows.length - 20, theme.grid, 2);
      text(ctx, `${v}%`, sx(v), top + rowH * rows.length + 16, { size: 24, color: theme.mutedText, align: "center" });
    }

    rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2 - 20;
      // 差が小さい項目は薄くして、大きく変わった項目に目が行くようにする
      ctx.globalAlpha = Math.abs(r.diff) < SMALL_CHANGE ? 0.4 : 1;
      const color = verdictColor(theme, r);
      text(ctx, r.label, M, y, { size: 34, weight: 700, color: theme.text, baseline: "middle" });
      line(ctx, sx(r.before), y, sx(r.after), y, color, 8);
      circle(ctx, sx(r.before), y, 13, surface(theme), theme.before, 4);
      circle(ctx, sx(r.after), y, 15, theme.accent);
      // 値は、点どうしが重ならない外側に置く
      const leftIsBefore = r.before <= r.after;
      const left = Math.min(r.before, r.after);
      const right = Math.max(r.before, r.after);
      text(ctx, fmt(left, 1), sx(left) - 26, y, { size: 26, weight: leftIsBefore ? 500 : 700, color: leftIsBefore ? theme.before : theme.text, align: "right", baseline: "middle" });
      text(ctx, fmt(right, 1), sx(right) + 26, y, { size: 26, weight: leftIsBefore ? 700 : 500, color: leftIsBefore ? theme.text : theme.before, baseline: "middle" });
      const bw = verdictBadge(ctx, theme, VIDEO_W - M, y, r, 22, "right");
      text(ctx, fmtDiff(r.diff, 1, "pt"), VIDEO_W - M - bw - (bw ? 14 : 0), y, { size: 32, weight: 900, color, align: "right", baseline: "middle" });
      ctx.globalAlpha = 1;
    });
    footer(ctx, input, `薄い項目は差が ${SMALL_CHANGE}pt 未満`);
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
    header(ctx, input, "平均順位の推移（上に行くほど良い）", avgRankHeadline(input.before, finalAfter(input)));

    const all = input.periods.filter((p) => p.avgRank !== null);
    // 録画中は、点を左から順に出していく
    const shown = input.progress === undefined ? all.length : Math.max(1, Math.ceil(input.progress * all.length));
    const pts = all;
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
    pts.slice(0, shown).forEach((p, i) => (i ? ctx.lineTo(sx(i), sy(p.avgRank!)) : ctx.moveTo(sx(i), sy(p.avgRank!))));
    ctx.stroke();
    pts.slice(0, shown).forEach((p, i) => {
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
  ...RANK_LABELS.map((_, k) => ({ label: ["トップ率", "2着率", "3着率", "ラス率"][k], get: (p: PeriodStats) => p.rankRates[k], digits: 2, unit: "%", better: k === 0 ? 1 : k === 3 ? -1 : 0 }) as const),
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
    header(ctx, input, "成績の比較", "全項目の比較");
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

export const DESIGNS: Design[] = [hero, contrast, waffleSlide, ranks, dumbbell, trend, table, thumbNumbers, thumbRank, thumbBars];
