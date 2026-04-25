---
id: "01KPNSJ3RRYH45YHGMS83W76H0"
name: "dev_server_lifecycle_is_managed"
status: "stable"
last_verified: "2026-04-26"
---

## 関連ファイル

- `server/src/usecases/dev-server/start-dev-server.ts`
- `server/src/usecases/dev-server/stop-dev-server.ts`
- `server/src/usecases/dev-server/get-dev-server.ts`
- `server/src/presentation/trpc/routers/dev-server.ts`
- `server/src/models/dev-server-process/index.ts` (`proxyPort` 付き)
- `server/src/repositories/dev-server/` (`DevServerRepository.start` は `AK_*` env を注入)
- `server/src/repositories/dev-server-process-logs/`
- `server/src/repositories/preview-proxy/` (proxy 本体 — `preview_is_proxied_through_autokanban` 参照)
- `server/src/models/preview-url/index.ts` (stdout ログ解析で target URL を検出)
- `server/src/infra/net/find-free-port.ts` (`proxyPort` 予約)
- `server/src/repositories/workspace-config/` (`auto-kanban.json` の `server` キー)

## 機能概要

`auto-kanban.json` の `server` スクリプト（例: `bun run start:dev`）をタスクの worktree 上で起動、
停止、状態取得する API 群。同一 session 内では 1 プロセスのみ running を許容し、
重複起動要求は既存の `executionProcessId` を返して no-op。

実装上は `DevServerRepository` という単一の async script runner が使われ、同じ runner が
`processType: "devserver" | "workspacescript"` で振る舞いを切り替える（workspace script 側は
`workspace_prepare_script_is_run` 参照）。runner は processType ごとに別の logs テーブル
(`dev_server_process_logs` / `workspace_script_process_logs`) に append し、完了時の callback
にも processType をそのまま乗せて `completeExecutionProcess` を正しい側へ分岐させる。
起動するプロセスには `AK_*` 環境変数（`AK_PROCESS_ID` など）が注入される
([ak_env_context_is_exported_to_spawned_scripts](../architecture/ak_env_context_is_exported_to_spawned_scripts.md))。

ブラウザから見える URL は **AutoKanban 側が所有する `proxyPort`** 1 点だけ。
`DevServerProcess.proxyPort` として DB に保存され、AutoKanban 内部で動く pass-through proxy
(HTTP + WebSocket) が、子 dev server が stdout に出した URL へリクエストを透過転送する
([preview_is_proxied_through_autokanban](./preview_is_proxied_through_autokanban.md))。
URL 検出は **サーバ側のログ解析** (`server/src/models/preview-url/detectDevServerUrl`) で行い、
client 側の URL 書き換えは iframe URL 構築のためには使わない
(`useDevServerPreview` は `proxyPort` から URL を組み立てるだけ)。

## 概念的背景: なぜタスク単位の Dev Server を作ったか

AI コーディングエージェントに「フロントエンドの色を変えて」と頼んだとき、ユーザーが
次に知りたいのは「**で、実際どう見えるの？**」である。ここで選択肢は:

1. ユーザーが自分のメインチェックアウトで `npm run dev` を起動してブラウザで見る
2. AI の worktree に `cd` して `npm run dev` を別途起動し、別 port で見る
3. AutoKanban が AI の worktree 上で dev server を起動してくれる

1 は「AI のブランチを main にマージしてから見る」という順序になり、試行錯誤のテンポが悪い。
2 は毎回ターミナルを開いて手で叩くのが面倒で、プロセスの後始末も忘れがち。

AutoKanban は 3 を選んだ: **タスクごとに worktree 上で dev server を立ち上げ、
停止・再起動・ログ閲覧を UI から行える**。これにより
「AI にお願い → ちょっと待つ → dev server で動作確認 → OK なら done、ダメなら follow-up」
のサイクルがカンバン内で閉じる。

port 衝突は解決しない: ユーザーの責任で別 port を割り当てるか、タスクを 1 個ずつ順番に
確認することを前提とする（通常、並行実行は 2-3 タスク程度なので現実的）。

`DevServerProcess` エンティティを `CodingAgentProcess` と別に切ったのは、
**同じ process だが役割が全く違う**ため。ライフサイクル（長命）、制御（Start/Stop のみ）、
ログ配信先（独立 SSE）すべて異なり、同じテーブルに混ぜると条件分岐が爆発する。

## 設計意図

dev server はタスクごとに worktree 上で独立起動できる（port conflict はユーザーが解決）。
これにより AI が書いたコードを手動で動作確認する流れが **カンバン内で完結**する。

**`auto-kanban.json` に `server` が無いプロジェクトは dev server 機能を使えない**
（`INVALID_STATE`）。これは設計上の割り切りで、「dev server を持たないプロジェクト
（ライブラリなど）で UI に dev server ボタンを押せるようにする必要はない」という判断。
代わりに task-template の `condition: "no_dev_server"` でそういうプロジェクト向けには
dev server 関連のテンプレートタスクを出さない、という連携もしている。

## シナリオ

### 起動（初回）

1. ユーザーが `trpc.devServer.start({ taskId })`
2. `pre` ステップで `findFreePort()` により `proxyPort` を予約
3. `read` で task / project / active workspace / latest session を取得、既存 running を確認
4. 既存 running があればそれを返す（alreadyRunning）
5. なければ `DevServerProcess.create({ ..., proxyPort })` し、`write` ステップで **先に DB commit**
   （`dev_server_process_logs` FK を先に満たす + client 側が `proxyPort` をすぐ読み取れる）
6. `post` で `previewProxy.start(processId, proxyPort)` — viewer 用 listen を先に開ける。
   close→bind race で EADDRINUSE が起きた場合、`listenOnFreePort` 経由で新規 port を取り直して
   atomic に rebind し、実 bound port を返す
7. `post` 続きで `devServer.start({ processType: "devserver", context: {...}, ... })` に
   `config.server` と `AK_*` 用 context を渡して非同期起動
8. `LogCollector` が子の stdout を流しながら `detectDevServerUrl` で URL を検出した瞬間、
   `previewProxy.setTarget(processId, url)` で proxy の転送先を確定
9. `finish` ステップで bound port が pre 予約と異なれば `DevServerProcess.proxyPort` を update
   （race が起きなければ no-op）
10. `{ executionProcessId }` を返却

### 停止

1. `trpc.devServer.stop({ executionProcessId })`
2. `devServer.stop(processId)` が SIGTERM → SIGKILL を送る
3. `on-process-complete` callback が status を更新し、`previewProxy.stop(processId)` を呼んで
   proxy の listen socket を閉じる

### state とログ取得

1. `trpc.devServer.get({ taskId })` で現在のプロセスと `proxyPort`、直近ログを返す
2. UI は「dev server running http://\<autokanban-host\>:\<proxyPort\>/ / 最終ログ 10 行」を表示
3. ブラウザ reload しても `proxyPort` は DB から再取得でき、iframe は同じ URL へ戻る

## 失敗 / 例外

- `NOT_FOUND` — task / project / workspace / session のいずれかがない
- `INVALID_STATE` — `auto-kanban.json` に `server` キーがない、または worktree パス未設定
