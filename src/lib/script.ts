import { per100, splitChanges } from "../render/insights";
import type { Texts } from "../render/slides";
import { avgRankSignificance, formatProbability } from "./compare";
import type { PeriodStats } from "./types";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

/**
 * 図の内容に沿ったナレーションの下書きを作る。
 * そのまま読める文章にしてあるので、自分の言葉に直して使う前提
 */
export function buildScript(before: PeriodStats, after: PeriodStats, texts: Texts): string {
  const B = texts.beforeLabel;
  const A = texts.afterLabel;
  const parts: string[] = [];

  parts.push(`今回は、${B}と${A}で成績がどう変わったのかを、データで見ていきます。`);
  if (before.games && after.games) {
    const room = after.room || before.room;
    parts.push(`${room ? `${room}の間の` : ""}${B}が${before.games.toLocaleString()}戦、${A}が${after.games.toLocaleString()}戦のデータです。`);
  }

  if (before.avgRank !== null && after.avgRank !== null) {
    const d = after.avgRank - before.avgRank;
    const how = Math.abs(d) < 0.02 ? "ほとんど変わっていません" : `${Math.abs(d).toFixed(3)}${d < 0 ? "良くなりました" : "悪くなりました"}`;
    parts.push(`まずは平均順位。${before.avgRank.toFixed(3)}から${after.avgRank.toFixed(3)}へ、${how}。`);
    const s = avgRankSignificance(before, after);
    if (s) {
      parts.push(
        s.p < 0.05
          ? `この差がたまたま出る確率は${formatProbability(s.p)}。運だけでは説明しにくい差です。`
          : `ただ、この差は偶然でも${formatProbability(s.p)}の確率で起こるので、まだ「たまたま」の可能性もあります。`,
      );
    }
  }

  const a = per100(before.rankRates);
  const b = per100(after.rankRates);
  if (a && b) {
    parts.push(
      `中身を見ると、トップ率は${pct(before.rankRates[0])}から${pct(after.rankRates[0])}、ラス率は${pct(before.rankRates[3])}から${pct(after.rankRates[3])}。` +
        `100戦に直すと、トップが${a[0]}回から${b[0]}回、ラスが${a[3]}回から${b[3]}回になった計算です。`,
    );
  }

  const { big, small } = splitChanges(before, after);
  const core = small.filter((c) => c.key === "winRate" || c.key === "dealInRate");
  if (core.length) {
    const list = core.map((c) => `${c.label}は${pct(c.before)}から${pct(c.after)}`).join("、");
    parts.push(`一方で、${list}と、ほとんど変わっていません。`);
    if (big.some((c) => c.key === "rank1" || c.key === "rank4")) {
      parts.push("つまり、上がりや放銃の回数よりも、「どの順位で終わるか」の取り方が変わったと言えそうです。");
    }
  } else if (big.length) {
    parts.push(`特に大きく変わったのは、${big.map((c) => `${c.label}（${pct(c.before)}→${pct(c.after)}）`).join("、")}です。`);
  }

  if (before.stableRank && after.stableRank) {
    parts.push(`安定段位で見ると、${before.stableRank}から${after.stableRank}になりました。`);
  }

  parts.push("では、何を学んで、何を変えたのか。ここから詳しく話していきます。");
  return parts.join("\n\n");
}
