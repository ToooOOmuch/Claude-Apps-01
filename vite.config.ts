import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // 相対パスで出力しておくと、dist フォルダをどこに置いても開ける
  base: "./",
  test: {
    environment: "node",
    testTimeout: 120_000,
  },
});
