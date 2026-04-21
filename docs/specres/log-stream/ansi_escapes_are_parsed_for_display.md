---
id: "01KPNSJ3RP8WYFHMFQ4QW3MGQZ"
name: "ansi_escapes_are_parsed_for_display"
status: "stable"
last_verified: "2026-04-21"
---

## 関連ファイル

- `server/src/models/conversation/conversation-parser.ts`
- `client/src/lib/ansi.ts`
- `client/src/components/chat/LogViewer.tsx`

## 機能概要

Claude Code は PTY 経由の出力に ANSI エスケープシーケンス（色・カーソル移動・画面消去など）を含む。
サーバー側の conversation parser は JSON のみを解釈対象とするが、UI の Raw Logs ビューでは
ANSI をそのまま表示すると読めなくなるため、クライアント側で `ansi-to-html`
相当の変換をかけて `<span style="color:...">` に変換する。

## 設計意図

- **サーバー側では生ログを保存**（再解析できるように）
- **クライアント側で描画時にパース**（表示責務）
- 構造化ストリームは JSON パース済みなので ANSI の影響を受けない

## シナリオ

### Render raw logs with colors

1. LogViewer が SSE で raw ログを受信
2. `ansi.parse(chunk)` で span tree に変換
3. React で描画（赤い error、青い info、などが色付きで表示される）

### Skip ANSI in structured view

1. ConversationPanel は structured ログを使うため、ANSI のパースは不要
2. Claude のテキスト本文は ANSI を含まない JSON 文字列として来る

## 失敗 / 例外

- 不正な ANSI シーケンスは無視（テキストとしてそのまま表示）
