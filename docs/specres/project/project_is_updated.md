---
id: "01KPNSHJVW2C6CC3W5CGH8BT3X"
name: "project_is_updated"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/project/update-project.ts`
- `server/src/usecases/project/update-project.test.ts` (Test)
- `server/src/presentation/trpc/routers/project.ts` (`update` procedure)

## 機能概要

既存プロジェクトの `name` または `description` を更新する。`repoPath` / `branch` は更新対象外
（リポジトリ紐付けは不変）。部分更新（undefined を渡したフィールドは維持）。

## 主要メンバー

- `projectId: string`
- `name?: string` — 1 文字以上
- `description?: string | null` — `null` で明示的にクリア可能

## シナリオ

### Successful update

1. `trpc.project.update({ projectId, name?, description? })` を呼ぶ
2. `read` で `Project.ById(projectId)` の存在を確認
3. `process` で既存 project に変更フィールドだけマージ、`updatedAt: new Date()`
4. `write` で upsert
5. 更新後の `Project` を返却

### Not found

1. 存在しない `projectId`
2. `fail("NOT_FOUND", "Project not found", { projectId })`

## 失敗 / 例外

- `NOT_FOUND` — 指定 `projectId` のプロジェクトが存在しない
