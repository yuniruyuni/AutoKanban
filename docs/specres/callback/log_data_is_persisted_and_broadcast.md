---
id: "01KPNSJ3QZ71EP5YF9C7JYYGZA"
name: "log_data_is_persisted_and_broadcast"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/usecases/execution/on-log-data.ts` (`appendExecutionLog`)
- `server/src/presentation/callback/routers/on-log-data.ts`
- `server/src/repositories/log-store/`
- `server/src/models/log-store/index.ts`

## 機能概要

Executor から到着する stdout / stderr / stdin チャンクを
`coding_agent_process_logs` テーブルに追記する。
フォーマット: `[<ISO timestamp>] [<source>] <data>\n`。
conversation-parser はこの 3 トークン prefix を元に行を分解・解釈するため、
**フォーマットは契約**として固定されている。

## 概念的背景: 3 つの LogSource を 1 ストリームに混ぜる意味

Coding Agent の「会話」は、実は 3 つの独立した I/O ストリームの合成物:

- **stdout** — Claude Code が発する JSON イベント（assistant メッセージ、tool_use、tool_result など）
- **stderr** — エラー、警告、PTY 装飾文字列など
- **stdin** — ユーザーが入力した follow-up メッセージ（AutoKanban が Executor に転送したもの）

これらを別々のテーブルに保存すると「時系列での統合ビュー」を再構成するのにコストがかかる。
AutoKanban はあえて **単一のログ文字列**に時刻順で混ぜ込み、`[timestamp] [source] data\n` の
prefix で後から種別を判別できるようにしている。

この形式の利点:

- **単純**: ログは append-only の 1 本の文字列で、単純なインクリメンタル構造
- **自然な順序**: 到着順 = イベント順 = 時間順。並べ替え不要
- **再生可能**: このログ全体を conversation-parser に通せば UI 向けの構造化ビューが
  復元できる（AutoKanban 再起動後の履歴復元もここから）

**stdin を保存するのが特に重要**な理由: stdin を欠くと、会話ビューに「user メッセージが
突然消える」現象が起きる。Claude Code は stdout に「user message が届いた」ログを
吐くわけではない（stdin は user の発話そのものなので、stdin 行自体がその証拠）。

## 設計意図

ログは `log-store` の in-memory ストア（SSE 配信用）と `coding_agent_process_logs` テーブル
（永続化）の**二重書き**。stdin はユーザーの follow-up メッセージを表し、
conversation として再構築するためにも重要（stdin log を欠くと UI で user message が消える）。

**フォーマットが契約として固定**されている理由: conversation-parser と log-stream 配信の
両方が `[timestamp] [source] data\n` の厳密なパースに依存している。
このフォーマットを変更すると、過去ログのすべてが再パース不能になる。
したがって **破壊的変更は避け、追加フィールドが必要なら新フォーマットを別のログ系統として
並走させる**方針。

## 主要メンバー

- `LogSource = "stdout" | "stderr" | "stdin"`
- フォーマット: `[<timestamp>] [<source>] <data>\n`（trailing newline 必須）

## シナリオ

### Stdout chunk

1. Executor が PTY stdout チャンクを `/callback/on-log-data` で POST
2. `appendExecutionLog({ processId, source: "stdout", data })`
3. write で `coding_agent_process_logs.appendLogs(processId, formattedLine)`
4. 並行して Executor / log-store が in-memory ストアに push（別経路）→ SSE 購読側にブロードキャスト

### Stdin chunk

1. `queueMessage` の logToMemory からサーバー側で stdin log を記録
2. または Executor が user メッセージを再送した場合の記録

### Stderr chunk

1. stderr もログに入るが conversation-parser は通常無視する（UI の Raw Logs ビューでのみ表示）

## 失敗 / 例外

- DB 書き込みエラーでも stream は続行（次のチャンクで整合性は回復する）
