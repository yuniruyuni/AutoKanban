---
id: "01KPNSHJVSHA5H1SKKQ154SW5Z"
name: "project_is_fetched_by_id"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/project/get-project.ts`
- `server/src/presentation/trpc/routers/project.ts` (`get` procedure)
- `server/src/models/project/index.ts` (`ProjectWithStats`)
- `client/src/pages/KanbanPage.tsx`

## 機能概要

`projectId` 指定で単一プロジェクトを統計情報付きで取得する。
カンバンボード画面（`/projects/:projectId`）の初期ロードで使用される。

## シナリオ

### Successful fetch

1. クライアントが `trpc.project.get({ projectId })` を呼ぶ
2. `read` で `ctx.repos.project.getWithStats(projectId)` を実行
3. 見つかれば `ProjectWithStats` をそのまま返却

### Not found

1. 存在しない `projectId` を指定
2. `fail("NOT_FOUND", "Project not found", { projectId })` を返す
3. Presentation 層で `TRPCError` に変換される

## 失敗 / 例外

- `NOT_FOUND` — 指定 `projectId` のプロジェクトが存在しない
