// OCR に必要なファイル（言語データ・ワーカー・WASM）を public/ocr にコピーする。
// 外部 CDN に頼らず、アプリ単体で文字認識できるようにするため。
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
mkdirSync(join(out, "lang"), { recursive: true });
mkdirSync(join(out, "core"), { recursive: true });

const nm = join(root, "node_modules");
const copies = [
  ["@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz", "lang/jpn.traineddata.gz"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
];
for (const [from, to] of copies) {
  const src = join(nm, from);
  if (!existsSync(src)) {
    console.warn(`[copy-ocr-assets] 見つかりません: ${from}`);
    continue;
  }
  cpSync(src, join(out, to));
}
const core = join(nm, "tesseract.js-core");
if (existsSync(core)) {
  cpSync(core, join(out, "core"), {
    recursive: true,
    // 文字認識は LSTM エンジンだけを使うので、その版だけコピーする
    filter: (p) => p === core || /-lstm\.(wasm|wasm\.js|js)$/.test(p),
  });
}
console.log("[copy-ocr-assets] OCR 用ファイルを public/ocr にコピーしました");
