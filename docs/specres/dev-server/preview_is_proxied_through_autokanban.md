---
id: "01KPZT8Z802KXZRGTYZKDZVH06"
name: "preview_is_proxied_through_autokanban"
status: "stable"
last_verified: "2026-04-26"
---

## 関連ファイル

- `server/src/repositories/preview-proxy/repository.ts` (`PreviewProxyRepository` interface)
- `server/src/repositories/preview-proxy/bun/index.ts` (`Bun.serve` 実装 — HTTP + WebSocket pass-through)
- `server/src/models/preview-url/index.ts` (`detectDevServerUrl` — 子の stdout から URL 抽出)
- `server/src/models/dev-server-process/index.ts` (`DevServerProcess.proxyPort`)
- `server/schema/tables/dev_server_processes.sql` (`proxy_port` カラム)
- `server/src/infra/net/find-free-port.ts` (`findFreePort` — `proxyPort` 予約)
- `server/src/usecases/dev-server/start-dev-server.ts` (`pre` で `proxyPort` 予約 → `post` で proxy 起動)
- `server/src/context.ts` (dev-server 用 `LogCollector` に URL 検出 hook を注入)
- `server/src/presentation/callback/routers/on-process-complete.ts` (dev server 終了で `previewProxy.stop`)
- `client/src/hooks/useDevServerPreview.ts` (iframe 用 URL は proxy port からだけ組み立て)

## 機能概要

`auto-kanban.json` の `server` スクリプトを走らせる各 `DevServerProcess` は、
AutoKanban 側が **1 個の固定ポート (`proxy_port`) を専有**して pass-through proxy を立てる。

- 閲覧者のブラウザは常に `<autokanban-host>:<proxyPort>` だけに接続する
- 子の dev server が stdout に出す URL を AutoKanban が拾い、proxy の forward 先に設定する
- HTTP は `fetch` で透過転送、WebSocket は `Bun.serve` の `upgrade()` と `new WebSocket(...)` で
  双方向ブリッジ (Vite HMR, Next.js dev overlay 等が透過で動く)

結果として `auto-kanban.json` の `server` に求められる唯一の規約は:

> **「AutoKanban サーバープロセスから reach できる URL を stdout に出すこと」**

リモートホストで dev server を立ち上げようが、ランダム loopback ポートを使おうが、
ブラウザ側のネットワーク到達性は AutoKanban だけで完結する。

## 設計意図

### なぜ単純な URL 共有でなく proxy なのか

当初はサーバ側で URL を検出してクライアントに渡し、iframe が直接開く設計だった。
これは次の点で壊れやすい:

1. **リモートの dev server**: `auto-kanban.json` の `server` が remote で立ち上がるケースでは、
   AutoKanban からは見える URL でもブラウザからは見えない
2. **クライアント側 URL 書き換えの多義性**: `localhost:3000` をブラウザ側が
   `window.location.hostname:3000` に書き換えてもポートが公開されていなければ届かない
3. **CORS / same-origin の違い**: proxy にすれば iframe は AutoKanban と同じ origin を維持できる

proxy であれば **「AutoKanban 自身から見える」という唯一の条件**にまとめられ、
ユーザーが書く `auto-kanban.json` の設計ルールが単純になる。

### なぜ WebSocket も透過するか

Vite / Next.js / Remix などのモダンな dev server は HMR / overlay を WebSocket で配るので、
HTTP だけ forward しても「ページは出るが変更が反映されない / クラッシュオーバーレイが出ない」
という体験になる。`Bun.serve` の `upgrade()` + クライアント側 `WebSocket` の組み合わせで
アップストリームを 1:1 で張り、受信フレームをそのまま中継する。

- **pending buffer**: 閲覧者側 WS の `message` イベントがアップストリーム `open` より早く来た場合、
  取り落とさないように `data.pending` に積んで `open` で flush する (速い HMR クライアント対策)
- **hop-by-hop ヘッダのストリップ**: RFC 7230 §6.1 に従い `connection` / `upgrade` /
  `transfer-encoding` 等を転送前後で除去。`host` も差し替える (viewer の `host` は AutoKanban、
  target は dev server)

### proxy port の所有と発見

- `proxyPort` は AutoKanban 側が `findFreePort()` で**予約**し、`DevServerProcess.create` 時点で
  entity の一部として持つ。DB 行が commit される前 (`pre` 步) に決まるので、
  その後ログが始まった瞬間に "どのポートへ proxy するか" がブレない
- `findFreePort` の close→bind 間で別プロセスにポートを奪われると `Bun.serve` が
  EADDRINUSE で失敗するので、`previewProxy.start(processId, preferredPort)` は
  EADDRINUSE を観測すると `listenOnFreePort` で新しい free port を atomic に取得して
  そこで bind し直す。**実際に bound したポートを返す**ので、それが pre 予約と異なる場合は
  `start-dev-server` の `finish` ステップで DB 行の `proxyPort` を更新する
  (rare case; race が起きなければ no-op)
- 一度 `DevServerProcess` 行に入った `proxyPort` は `trpc.devServer.get` で
  クライアントに返り、ブラウザ reload でも iframe が正しい URL を再構築できる
- ターゲット URL の検出は **stdout ログの逐次解析** で行う: `context.ts` が
  dev-server 用 `LogCollector` に `onChunk` observer を注入し、初回 URL を見つけたら
  `previewProxy.setTarget()` を呼ぶ。2 回目以降はスキップ (最初の URL を採用)

### client 側の扱い

- `useDevServerPreview` は **もう client 側で URL 検出しない**。proxy port が判明した瞬間
  `status = "ready"`、iframe の `src` は `${protocol}//${hostname}:${proxyPort}/` 固定
- dev server 側がまだ URL を出していない間は、proxy 自身が 503 + meta-refresh な
  "starting…" placeholder を返す。iframe はその間 AutoKanban の origin に固定されている
- 閲覧者が Reload を押したいケースは、PreviewPanel の Reload ボタンが iframe の `key` を
  bump して再マウントするだけ (proxy 側は state を持ったまま)

## シナリオ

### 起動

1. `trpc.devServer.start` → Usecase の `pre` ステップで `findFreePort()` が `proxyPort` を予約
2. `read` / `process` で `DevServerProcess.create({ proxyPort, ... })`
3. `write` で DB commit (ログの FK 先がここで確実に存在する)
4. `post` で `previewProxy.start(processId, proxyPort)` — 即座に listen 開始 (placeholder を返せる状態)。
   close→bind race で EADDRINUSE が起きれば、内部で `listenOnFreePort` を使って新規 port を atomic に
   取り直し、bound port を返す
5. `post` 続きで `devServer.start({ processType: "devserver", ... })` — 子 dev server を spawn
6. 子の stdout 初チャンクが `LogCollector` を通るたびに `detectDevServerUrl` が動き、
   ヒットした時点で `previewProxy.setTarget(processId, url)`
7. 以降の viewer リクエストはその target へ transparent forward される
8. `finish` ステップで bound port が pre 予約と異なれば DB 行の `proxyPort` を update
   (race が起きなければ no-op)

### 閲覧

1. `useDevServerPreview` が `trpc.devServer.get` 経由で `proxyPort` を取得
2. iframe は `${hostname}:${proxyPort}/` を開く — URL 検出は client 側では行わない
3. WebSocket (HMR) もこのポートに繋がり、proxy が upstream に中継する

### 停止

1. 子 dev server が exit → `on-process-complete` callback が発火
2. `ctx.repos.previewProxy.stop(processId)` を呼んで listen socket を close
3. `DevServerProcess.status` を `completed` / `failed` / `killed` に更新

## 失敗 / 例外

- **ターゲットに到達できない**: `forward` で `fetch` が例外 → 502 を返す (サーバは落ちない)
- **WS アップストリームエラー**: `close(1011, "Upstream WS error")` で viewer 側を閉じる
- **send 先の WS が close 済み**: `ws.send()` / `upstream.send()` が同期 throw するケース
  (viewer reload 中・upstream 切断直後の race) は warn ログを出して drop。
  HMR は冪等のため再送で復旧する。捕捉せずに伝播させると Bun イベントループで
  unhandled となり AutoKanban server ごと落ちるため、3 箇所すべての send を try-catch する。
- **`setTarget` 前の HTTP リクエスト**: placeholder (503 + meta-refresh) を返す
- **`setTarget` 前の WS アップグレード**: `close(1013, "Preview target not ready")` で即切断
- **`proxyPort` 使用中のポート**: 通常 `findFreePort` で未使用ポートを取るが、close→bind 間の
  race で埋まることがある。`previewProxy.start` は EADDRINUSE を検知して
  `listenOnFreePort` で新規 port を取り直し、bind を atomic に retry する。
  retry 上限 (5 回) を超えた場合のみ "Failed to bind to a free port" で起動失敗する。
  pre 予約と実 bound port がずれた場合は `finish` ステップで DB 行を更新する

## 関連する動作

- [dev_server_lifecycle_is_managed](./dev_server_lifecycle_is_managed.md) — proxy を埋め込むライフサイクル本体
- [dev_server_process_is_a_worktree_scoped_server](./dev_server_process_is_a_worktree_scoped_server.md)
- [workspace_config_is_auto_kanban_json](../architecture/workspace_config_is_auto_kanban_json.md) — `server` スクリプト側の規約
- [local_only_security_model](../architecture/local_only_security_model.md) — proxy は `AUTO_KANBAN_HOST` の bind に従う
