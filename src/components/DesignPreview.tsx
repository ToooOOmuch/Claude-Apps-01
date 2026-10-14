import { useEffect, useRef, useState } from "react";
import { pickVideoType, recordDesign } from "../render/animate";
import type { Design, RenderInput } from "../render/slides";

interface Props {
  design: Design;
  input: RenderInput;
  /** 文字の読み込みが終わるたびに描き直すためのカウンタ */
  fontVersion: number;
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename);
      resolve();
    }, "image/png");
  });
}

export function fileName(design: Design, input: RenderInput, ext = "png") {
  return `${design.kind === "thumbnail" ? "thumbnail" : "video"}_${design.id}_${input.theme.id}.${ext}`;
}

const canRecord = pickVideoType() !== null;

/** 実寸（1920×1080 など）で描いて、画面には縮小して見せる */
export function DesignPreview({ design, input, fontVersion }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [recording, setRecording] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || recording !== null) return;
    const ctx = canvas.getContext("2d")!;
    ctx.reset();
    design.draw(ctx, input);
  }, [design, input, fontVersion, recording]);

  const record = async () => {
    if (!ref.current) return;
    setError("");
    setRecording(0);
    try {
      const { blob, ext } = await recordDesign(ref.current, design, input, { onProgress: setRecording });
      downloadBlob(blob, fileName(design, input, ext));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecording(null);
    }
  };

  return (
    <figure className="preview">
      <canvas ref={ref} width={design.width} height={design.height} data-design={design.id} />
      <figcaption>
        <span>
          {design.name} <small>{design.width}×{design.height}</small>
        </span>
        <span className="actions">
          {design.kind === "video" && canRecord && (
            <button className="ghost" onClick={record} disabled={recording !== null} title="「前」から「後」へ数字が動く4秒の動画">
              {recording !== null ? `録画中… ${Math.round(recording * 100)}%` : "動画で保存"}
            </button>
          )}
          <button onClick={() => ref.current && downloadCanvas(ref.current, fileName(design, input))} disabled={recording !== null}>
            PNG保存
          </button>
        </span>
      </figcaption>
      {recording !== null && <p className="status">録画中は、このタブを表示したままにしてください（別のタブに切り替えると、録画が止まります）。</p>}
      {error && <p className="note">{error}</p>}
    </figure>
  );
}
