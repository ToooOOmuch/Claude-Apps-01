import { createWorker, PSM, type Worker } from "tesseract.js";
import type { OcrEngine, OcrMode, OcrWord } from "./extract";
import type { RgbaImage } from "./image";

/** public/ocr に置いたファイルの URL（どのフォルダに置いても動くよう、ページの場所から作る） */
const asset = (path: string) => new URL(`ocr/${path}`, document.baseURI).href;

let enginePromise: Promise<OcrEngine> | null = null;

function toCanvas(img: RgbaImage): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const data = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return canvas;
}

async function create(): Promise<OcrEngine> {
  const opts = {
    workerPath: asset("worker.min.js"),
    corePath: asset("core"),
    langPath: asset("lang"),
    gzip: true,
    workerBlobURL: false,
  };
  const workers: Record<OcrMode, Worker> = {
    japanese: await createWorker("jpn", 1, opts),
    digits: await createWorker("eng", 1, opts),
    dates: await createWorker("eng", 1, opts),
  };
  await workers.digits.setParameters({ tessedit_char_whitelist: "0123456789.%", tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  await workers.dates.setParameters({ tessedit_char_whitelist: "0123456789-~", tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return {
    async recognize(img, mode) {
      const { data } = await workers[mode].recognize(toCanvas(img), {}, { text: true, blocks: true });
      const words: OcrWord[] = [];
      for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, bbox: w.bbox });
      return { text: data.text, words };
    },
  };
}

/** 文字認識の準備（初回だけ数秒かかる）。2回目以降は同じものを使い回す */
export function getOcr(): Promise<OcrEngine> {
  if (!enginePromise) {
    enginePromise = create().catch((e) => {
      enginePromise = null;
      throw e;
    });
  }
  return enginePromise;
}

export async function fileToImage(file: Blob): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
