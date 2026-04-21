---
id: "01KPNTBSGCW3S2Y5XMN9CK1MDG"
name: "directory_is_browsed_for_repo_path_selection"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/project/browse-directory.ts`
- `server/src/usecases/project/browse-directory.test.ts` (Test)
- `server/src/presentation/trpc/routers/project.ts` (`browseDirectory`)
- `client/src/components/project/FileBrowser.tsx`
- `client/src/pages/NewProjectPage.tsx`

## 機能概要

新規プロジェクト作成画面でリポジトリパスを選ぶためのディレクトリブラウザ。
サーバー側で `fs.readdir` してエントリ一覧を返し、クライアントは親ディレクトリへ辿ったり
サブディレクトリに降りたりできる。任意で `includeFiles: true` でファイルも含める。

## 設計意図

OS ネイティブのファイル選択ダイアログを使わないのは、リモートデスクトップ等でも動くようにするため
（AutoKanban はローカル専用だが、UX を統一）。ディレクトリトラバーサル攻撃への配慮は
「個人利用前提」としてシンプルに実装。

## シナリオ

### home からブラウズ

1. `/projects/new` を開いたら `trpc.project.browseDirectory({ path: homedir() })`
2. サーバーが `{ entries: [{ name, isDirectory }], parent? }` を返す
3. ユーザーがクリックして深掘り
4. リポジトリ候補を確定したら `repoPath` として CreateProject に渡す

## 失敗 / 例外

- 読めないディレクトリ（permission denied）はエラーとして UI に表示
- 存在しないパスは空配列で返す（fail せず）
