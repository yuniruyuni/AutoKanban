---
id: "01KPNTBSGA7XMKDE21TYM00R7Y"
name: "settings_pages_provide_crud_for_configuration"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `client/src/pages/settings/ToolsPage.tsx`
- `client/src/pages/settings/TaskTemplatePage.tsx`
- `client/src/pages/settings/AgentPage.tsx`
- `client/src/pages/settings/AgentDetailPage.tsx`
- `client/src/pages/settings/MCPServerPage.tsx`
- `client/src/components/settings/*`

## 機能概要

`/settings/*` 配下の設定ページ群は以下のパターンを共有する:
- 左サイドにカテゴリ nav（Tools / Task Templates / Agents / MCP Server）
- 右ペインで一覧 + 編集フォームを表示
- 各ページは対応 tRPC router の `list` / `create` / `update` / `delete` を直接呼ぶ

## 設計意図

個人利用アプリなので、設定は直接 DB に書き込む（multi-user / role の概念なし）。
sortOrder のドラッグ並び替えは UI 共通コンポーネントで実装されている。

## シナリオ

### Tools ページ

1. `/settings/tools` で `trpc.tool.list` → カード並びで表示
2. 追加 / 編集 / 削除 / 並び替えをそのページ内で完結

### Task Templates / Variants / MCP Servers ページ

1. 同じパターン: list → form → mutate

## 失敗 / 例外

- 通常は fail しない（settings は個人用なので同時編集の心配もない）
