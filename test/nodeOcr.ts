// テスト用: Node で tesseract.js を動かす OcrEngine
import { PNG } from "pngjs";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { join } from "node:path";
import type { OcrEngine, OcrWord } from "../src/lib/extract";
import type { RgbaImage } from "../src/lib/image";

const langPath = join(process.cwd(), "public", "ocr", "lang");

function toPng(img: RgbaImage): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(png);
}

export async function createNodeOcr(): Promise<OcrEngine & { terminate(): Promise<void> }> {
  const opts = { langPath, gzip: true, cacheMethod: "none" };
  const jpn: Worker = await createWorker("jpn", 1, opts);
  const eng: Worker = await createWorker("eng", 1, opts);
  await eng.setParameters({ tessedit_char_whitelist: "0123456789.%", tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  const dates: Worker = await createWorker("eng", 1, opts);
  await dates.setParameters({ tessedit_char_whitelist: "0123456789-~", tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return {
    async recognize(img, mode) {
      const worker = mode === "digits" ? eng : mode === "dates" ? dates : jpn;
      const { data } = await worker.recognize(toPng(img), {}, { text: true, blocks: true });
      const words: OcrWord[] = [];
      for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const w of l.words) words.push({ text: w.text, bbox: w.bbox });
      return { text: data.text, words };
    },
    async terminate() {
      await Promise.all([jpn.terminate(), eng.terminate(), dates.terminate()]);
    },
  };
}
