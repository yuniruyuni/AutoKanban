---
id: "01KPNTBSG330HN6YBQ2AHJZDW4"
name: "agent_command_is_configured_and_checked"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/agent-setting/get-agent-setting.ts`
- `server/src/usecases/agent-setting/update-agent-setting.ts`
- `server/src/presentation/trpc/routers/agent-setting.ts`
- `server/src/models/agent-setting/index.ts`
- `server/src/repositories/agent-setting/`
- `client/src/pages/settings/AgentPage.tsx`
- `client/src/pages/settings/AgentDetailPage.tsx`

## 機能概要

Executor 毎の実行コマンド（`claude` のパスなど）を設定する画面と API。
AgentSetting は `{ id (=agentId, "claude-code" / "gemini" 等), command }` を持ち、
`startExecution` / `queueMessage` の post ステップで `ctx.repos.agentSetting.get(AgentSetting.ById(executor))`
で引かれる。空なら PATH 上のデフォルトが使われる。

## シナリオ

### Configure command path

1. `/settings/agent/:agentId` で `trpc.agentSetting.get({ agentId })` → 現在値を表示
2. ユーザーが `command` を編集して保存 → `trpc.agentSetting.update({ agentId, command })`
3. 次回 agent 起動から適用される

### Check availability

1. 設定画面で「実行可能？」チェックボタンを押す
2. Router が `command --version` 相当を走らせて exit code と stdout を返す
3. UI は利用可 / 不可と version を表示

## 失敗 / 例外

- コマンドが存在しない / 実行権限がない場合は version チェックが失敗
