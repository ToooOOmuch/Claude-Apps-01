import { useCallback, useEffect, useMemo, useState } from "react";
import { DesignPreview, downloadCanvas, fileName } from "./components/DesignPreview";
import { PeriodEditor } from "./components/PeriodEditor";
import { fileToImage, getOcr } from "./lib/browserOcr";
import { avgRankSignificance, formatProbability, sortByStart } from "./lib/compare";
import { extractFromScreenshot } from "./lib/extract";
import { DEFAULT_TEXTS, load, save } from "./lib/storage";
import { emptyPeriod, type PeriodStats } from "./lib/types";
import { DESIGNS, type RenderInput, type Texts } from "./render/slides";
import { FONT_FAMILY, THEMES, type ThemeId } from "./render/theme";

const newId = () => Math.random().toString(36).slice(2, 10);

function defaultLabel(p: PeriodStats, index: number): string {
  if (p.startDate && p.endDate) return `${p.startDate.slice(0, 7).replace("-", "/")}〜${p.endDate.slice(0, 7).replace("-", "/")}`;
  return `期間${index + 1}`;
}

interface Job {
  id: string;
  name: string;
  status: "reading" | "error";
  message?: string;
}

export default function App() {
  const saved = useMemo(load, []);
  const [periods, setPeriods] = useState<PeriodStats[]>(saved?.periods ?? []);
  const [beforeId, setBeforeId] = useState<string | null>(saved?.beforeId ?? null);
  const [afterId, setAfterId] = useState<string | null>(saved?.afterId ?? null);
  const [texts, setTexts] = useState<Texts>(saved?.texts ?? DEFAULT_TEXTS);
  const [themeId, setThemeId] = useState<ThemeId>(saved?.themeId ?? "dark");
  const [tab, setTab] = useState<"video" | "thumbnail">("video");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [extras, setExtras] = useState<Record<string, { url: string; notes: string[]; rawText: string }>>({});
  const [fontVersion, setFontVersion] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => save({ periods, beforeId, afterId, texts, themeId }), [periods, beforeId, afterId, texts, themeId]);

  // 図で使う文字（Noto Sans JP）が読み込まれたら描き直す
  useEffect(() => {
    const weights = [400, 500, 700, 900];
    Promise.all(weights.map((w) => document.fonts.load(`${w} 40px ${FONT_FAMILY}`, "雀魂0123")))
      .catch(() => undefined)
      .finally(() => setFontVersion((v) => v + 1));
  }, []);

  const sorted = useMemo(() => sortByStart(periods), [periods]);
  // 比べる2つを選んでいなければ、いちばん古い期間と新しい期間を比べる
  const before = periods.find((p) => p.id === beforeId) ?? sorted[0];
  const after = periods.find((p) => p.id === afterId) ?? sorted[sorted.length - 1];

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    for (const file of images) {
      const id = newId();
      setJobs((j) => [...j, { id, name: file.name || "貼り付けた画像", status: "reading" }]);
      try {
        const [img, ocr] = await Promise.all([fileToImage(file), getOcr()]);
        const result = await extractFromScreenshot(img, ocr, id);
        setPeriods((ps) => {
          const stats = { ...result.stats, label: defaultLabel(result.stats, ps.length) };
          return [...ps, stats];
        });
        setExtras((e) => ({ ...e, [id]: { url: URL.createObjectURL(file), notes: result.notes, rawText: result.rawText } }));
        setJobs((j) => j.filter((x) => x.id !== id));
      } catch (err) {
        console.error(err);
        setJobs((j) => j.map((x) => (x.id === id ? { ...x, status: "error", message: String(err) } : x)));
      }
    }
  }, []);

  // Ctrl+V でスクリーンショットを貼り付けられるようにする
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const updatePeriod = (p: PeriodStats) => setPeriods((ps) => ps.map((x) => (x.id === p.id ? p : x)));
  const removePeriod = (id: string) => {
    setPeriods((ps) => ps.filter((x) => x.id !== id));
    if (beforeId === id) setBeforeId(null);
    if (afterId === id) setAfterId(null);
  };

  const input: RenderInput | null = useMemo(
    () => (before && after ? { before, after, periods: sorted, texts, theme: THEMES[themeId] } : null),
    [before, after, sorted, texts, themeId],
  );
  const significance = before && after && before !== after ? avgRankSignificance(before, after) : null;
  const designs = DESIGNS.filter((d) => d.kind === tab);

  const saveAll = async () => {
    for (const canvas of document.querySelectorAll<HTMLCanvasElement>("canvas[data-design]")) {
      const design = DESIGNS.find((d) => d.id === canvas.dataset.design);
      if (design && input) {
        await downloadCanvas(canvas, fileName(design, input));
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  };

  const setText = (key: keyof Texts) => (e: React.ChangeEvent<HTMLInputElement>) => setTexts({ ...texts, [key]: e.target.value });

  return (
    <div className="app">
      <header className="app-header">
        <h1>雀魂 成績スタジオ</h1>
        <p>牌譜屋のスクリーンショットから、動画用の図とサムネイルを作ります</p>
      </header>

      <main className="layout">
        <section className="side">
          <h2>1. スクリーンショットを読み込む</h2>
          <label
            className={`drop ${dragging ? "over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles([...e.dataTransfer.files]);
            }}
          >
            <input type="file" accept="image/*" multiple hidden onChange={(e) => addFiles([...(e.target.files ?? [])])} />
            <strong>ここに画像をドロップ</strong>
            <span>またはクリックして選択 / Ctrl+V で貼り付け</span>
            <small>牌譜屋のプレイヤーページで「基本」タブを開き、成績と順位分布が写るように撮ってください。期間ごとに1枚ずつ読み込むと、推移のグラフも作れます。</small>
          </label>
          {jobs.map((j) => (
            <p key={j.id} className={j.status === "error" ? "note" : "status"}>
              {j.status === "reading" ? `読み取り中… ${j.name}（初回は準備に数秒かかります）` : `読み取りに失敗しました: ${j.name} ${j.message ?? ""}`}
            </p>
          ))}
          <button className="ghost" onClick={() => setPeriods((ps) => [...ps, emptyPeriod(newId(), `期間${ps.length + 1}`)])}>
            ＋ 手入力で期間を追加
          </button>

          <h2>2. 読み取った数字を確認</h2>
          {!periods.length && <p className="muted">まだ期間がありません。</p>}
          {periods.map((p) => (
            <PeriodEditor
              key={p.id}
              period={p}
              notes={extras[p.id]?.notes}
              imageUrl={extras[p.id]?.url}
              rawText={extras[p.id]?.rawText}
              onChange={updatePeriod}
              onRemove={() => removePeriod(p.id)}
            />
          ))}

          <h2>3. 比べる期間と文字</h2>
          <div className="grid">
            <label>
              前（比べる元）
              <select value={before?.id ?? ""} onChange={(e) => setBeforeId(e.target.value)}>
                {sorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              後
              <select value={after?.id ?? ""} onChange={(e) => setAfterId(e.target.value)}>
                {sorted.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label || p.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              「前」の呼び方
              <input value={texts.beforeLabel} onChange={setText("beforeLabel")} />
            </label>
            <label>
              「後」の呼び方
              <input value={texts.afterLabel} onChange={setText("afterLabel")} />
            </label>
            <label className="wide">
              見出し（動画用）
              <input value={texts.title} onChange={setText("title")} />
            </label>
            <label className="wide">
              推移グラフの区切りの文字
              <input value={texts.markerLabel} onChange={setText("markerLabel")} />
            </label>
            <label className="wide">
              サムネの大見出し
              <input value={texts.thumbHeadline} onChange={setText("thumbHeadline")} />
            </label>
            <label className="wide">
              サムネの小見出し
              <input value={texts.thumbSub} onChange={setText("thumbSub")} />
            </label>
          </div>
          {significance && (
            <p className="muted">
              平均順位の差が偶然で出る確率: <strong>{formatProbability(significance.p)}</strong>
              {significance.p < 0.05 ? "（偶然とは考えにくい差です）" : "（偶然でも起こりうる差です。戦数を増やすと確かめられます）"}
            </p>
          )}
        </section>

        <section className="main">
          <div className="toolbar">
            <div className="tabs">
              <button className={tab === "video" ? "active" : ""} onClick={() => setTab("video")}>
                動画用（1920×1080）
              </button>
              <button className={tab === "thumbnail" ? "active" : ""} onClick={() => setTab("thumbnail")}>
                サムネイル（1280×720）
              </button>
            </div>
            <div className="tabs">
              {Object.values(THEMES).map((t) => (
                <button key={t.id} className={themeId === t.id ? "active" : ""} onClick={() => setThemeId(t.id)}>
                  {t.name}
                </button>
              ))}
            </div>
            <button onClick={saveAll} disabled={!input}>
              表示中の図をまとめて保存
            </button>
          </div>
          {!input ? (
            <div className="empty">
              <p>左でスクリーンショットを読み込むと、ここに図が出ます。</p>
              <p className="muted">「前」と「後」の2期間を比べるので、学ぶ前と後の2枚を読み込んでください。</p>
            </div>
          ) : (
            <div className="previews">
              {designs.map((d) => (
                <DesignPreview key={d.id} design={d} input={input} fontVersion={fontVersion} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
