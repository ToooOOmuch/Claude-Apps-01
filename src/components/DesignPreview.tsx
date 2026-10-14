import { useEffect, useRef } from "react";
import type { Design, RenderInput } from "../render/slides";

interface Props {
  design: Design;
  input: RenderInput;
  /** 文字の読み込みが終わるたびに描き直すためのカウンタ */
  fontVersion: number;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      resolve();
    }, "image/png");
  });
}

export function fileName(design: Design, input: RenderInput) {
  return `${design.kind === "thumbnail" ? "thumbnail" : "video"}_${design.id}_${input.theme.id}.png`;
}

/** 実寸（1920×1080 など）で描いて、画面には縮小して見せる */
export function DesignPreview({ design, input, fontVersion }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.reset();
    design.draw(ctx, input);
  }, [design, input, fontVersion]);

  return (
    <figure className="preview">
      <canvas ref={ref} width={design.width} height={design.height} data-design={design.id} />
      <figcaption>
        <span>
          {design.name} <small>{design.width}×{design.height}</small>
        </span>
        <button onClick={() => ref.current && downloadCanvas(ref.current, fileName(design, input))}>PNG保存</button>
      </figcaption>
    </figure>
  );
}
