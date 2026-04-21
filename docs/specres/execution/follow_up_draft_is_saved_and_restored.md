---
id: "01KPNSJ3QRGJ28TH90269FY74A"
name: "follow_up_draft_is_saved_and_restored"
status: "draft"
---

## 関連ファイル

- `server/src/usecases/execution/save-draft.ts` (`saveDraft`, `getDraft`)
- `server/src/presentation/trpc/routers/execution.ts` (`saveDraft`, `getDraft` procedures)
- `server/src/models/draft/`
- `server/src/repositories/draft/`
- `client/src/components/chat/FollowUpInput.tsx`

## 機能概要

FollowUpInput に打ちかけのテキストが残ったまま画面遷移した場合に備えて、
入力内容を session 単位の in-memory draft ストアに保存する。
ページを再訪したら `getDraft` で取り出して復元する。DB には永続化しない
（アプリ再起動で消える）。

## シナリオ

### Save draft

1. ユーザーが FollowUpInput に入力（onChange で数百ミリ秒デバウンス）
2. `trpc.execution.saveDraft({ sessionId, text })`
3. `read` で session 存在確認
4. `post` で `draft.save(sessionId, text)` — メモリ上の Map に書き込み
5. `{ success: true }` を返す

### Restore draft

1. 画面マウント時に `trpc.execution.getDraft({ sessionId })` を呼ぶ
2. `post` で `draft.get(sessionId)` を読み、`{ text, savedAt }` を返す
3. FollowUpInput の初期値として復元

## 失敗 / 例外

- `NOT_FOUND` — session が存在しない
- アプリ再起動で draft は消えるが、ユーザー体験上は問題なし
