# 雀魂 成績スタジオ

牌譜屋のスクリーンショットから、YouTube 用の図とサムネイルを作る Web アプリ（Vite + React + TypeScript）。

## 「起動」と言われたら

ユーザーが「起動」とだけ言ったら、アプリを起動してブラウザで開く。

1. `node_modules` がなければ `npm install` を実行する
2. `npm run dev -- --open` をバックグラウンドで実行する（終了を待たない）
3. 「http://localhost:5173/ で開きました」と伝える

すでに起動していてポート 5173 が使われているときは、新しく起動せず、その URL を伝える。

## 開発

- `npm test` / `npm run typecheck` / `npm run build`
- 詳しくは README.md
