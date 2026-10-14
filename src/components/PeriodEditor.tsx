import { FIELD_META, RANK_LABELS, type PeriodStats } from "../lib/types";

interface Props {
  period: PeriodStats;
  notes?: string[];
  imageUrl?: string;
  rawText?: string;
  onChange(p: PeriodStats): void;
  onRemove(): void;
}

const ROOMS = ["王座", "玉", "金", "王東", "玉東", "金東"];

function num(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** 1つの期間の成績を確認・修正するカード */
export function PeriodEditor({ period, notes, imageUrl, rawText, onChange, onRemove }: Props) {
  const set = <K extends keyof PeriodStats>(key: K, value: PeriodStats[K]) => onChange({ ...period, [key]: value });
  const rateSum = period.rankRates.reduce<number>((a, r) => a + (r ?? 0), 0);
  const rateOk = period.rankRates.every((r) => r !== null) && Math.abs(rateSum - 100) < 0.5;

  return (
    <div className="period">
      <div className="period-head">
        <input
          className="period-label"
          value={period.label}
          placeholder="名前（例: 学ぶ前）"
          onChange={(e) => set("label", e.target.value)}
        />
        <button className="ghost danger" onClick={onRemove}>
          削除
        </button>
      </div>
      {imageUrl && <img className="period-image" src={imageUrl} alt="読み込んだスクリーンショット" />}
      {notes?.map((n) => (
        <p key={n} className="note">
          {n}
        </p>
      ))}

      <div className="grid">
        <label>
          開始日
          <input type="date" value={period.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </label>
        <label>
          終了日
          <input type="date" value={period.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </label>
        <label>
          部屋
          <input list="rooms" value={period.room} onChange={(e) => set("room", e.target.value)} />
        </label>
        <datalist id="rooms">
          {ROOMS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <h4>順位の割合（%）</h4>
      <div className="grid four">
        {RANK_LABELS.map((l, k) => (
          <label key={l}>
            {l}
            <input
              type="number"
              step="0.01"
              value={period.rankRates[k] ?? ""}
              onChange={(e) => {
                const rates = [...period.rankRates] as PeriodStats["rankRates"];
                rates[k] = num(e.target.value);
                set("rankRates", rates);
              }}
            />
          </label>
        ))}
      </div>
      {!rateOk && <p className="note">合計が100%になっていません（いま {rateSum.toFixed(2)}%）</p>}

      <h4>成績</h4>
      <div className="grid">
        {FIELD_META.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.unit && "（%）"}
            <input
              type="number"
              step="any"
              value={period[f.key] ?? ""}
              onChange={(e) => set(f.key, num(e.target.value))}
            />
          </label>
        ))}
        <label>
          記録段位
          <input value={period.recordRank} placeholder="例: 豪3" onChange={(e) => set("recordRank", e.target.value)} />
        </label>
        <label>
          記録点数
          <input value={period.recordPoints} placeholder="例: 1148/3600" onChange={(e) => set("recordPoints", e.target.value)} />
        </label>
        <label>
          安定段位
          <input value={period.stableRank} placeholder="例: 聖5.90" onChange={(e) => set("stableRank", e.target.value)} />
        </label>
      </div>
      {rawText && (
        <details className="raw">
          <summary>画像から読み取った文字を見る</summary>
          <pre>{rawText}</pre>
        </details>
      )}
    </div>
  );
}
