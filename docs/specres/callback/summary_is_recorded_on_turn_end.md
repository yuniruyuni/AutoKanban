---
id: "01KPNSJ3R0HQW7R1ZZQDS33ZNA"
name: "summary_is_recorded_on_turn_end"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/on-summary.ts` (`updateSummary`)
- `server/src/presentation/callback/routers/on-summary.ts`
- `server/src/models/coding-agent-turn/index.ts` (`updateSummary`)

## 機能概要

Claude Code がターン終了時に自動生成する short summary を受け取り、対応する
`CodingAgentTurn` レコードに保存する。チャット履歴の折りたたみ表示や、
タスク一覧のサマリー欄で使われる（人間が過去の attempt を素早く把握するため）。

## シナリオ

### summary 到着

1. Executor が `/callback/on-summary` に `{ processId, summary }` を POST
2. `updateSummary({ processId, summary })`
3. write で `codingAgentTurn.updateSummary(processId, summary)`

## 失敗 / 例外

- 対応する turn が存在しない場合は Repository がサイレントに no-op
