---
id: "01KPNSHJVQX8V0AQX7PYA0HPWG"
name: "projects_are_listed"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/project/list-projects.ts`
- `server/src/presentation/trpc/routers/project.ts` (`list` procedure)
- `server/src/models/project/index.ts` (`ProjectWithStats`)
- `client/src/pages/ProjectsPage.tsx`
- `client/src/components/project/ProjectList.tsx`

## 機能概要

AutoKanban に登録されているすべてのプロジェクトを統計情報付きで返す。
統計は各プロジェクト配下のタスク数（status 別集計）など、カードのサマリー表示に必要な値。

## 設計意図

プロジェクト一覧は起動直後のランディング画面（`ProjectsPage`）で毎回呼ばれるため、
`listAllWithStats()` という単一の Repository メソッドに集約されており、N+1 クエリは避ける。
pagination は現状なし（個人利用の前提で、プロジェクト数は数十件程度を想定）。

## シナリオ

### Successful list

1. クライアントが `trpc.project.list()` を呼ぶ
2. `read` ステップで `ctx.repos.project.listAllWithStats()` が `ProjectWithStats[]` を返す
3. そのまま `{ projects }` としてクライアントへ返却

## 失敗 / 例外

- DB 接続エラー時はトランザクションが失敗し、`handleResult` が `TRPCError` に変換する
