---
id: "01KPQ6W85T6VTJEQWKM3BNVPMC"
name: "local_only_security_model"
status: "stable"
last_verified: "2026-04-25"
---

## 関連ファイル

- `server/src/presentation/index.ts` (`HOST` = `AUTO_KANBAN_HOST ?? "127.0.0.1"` で bind)
- `server/src/presentation/trpc/routers/*.ts` (Zod によるバリデーション。`project.ts` の `projectNameSchema` がパストラバーサル入口チェック)
- `server/src/repositories/worktree/fs/index.ts` (`getWorktreePath` でのパストラバーサル出口チェック)
- `~/.auto-kanban/` (データディレクトリ)

## 機能概要

AutoKanban は **localhost にバインドされたローカル専用アプリ**として動作する。
通信相手はユーザー自身のブラウザと、同じマシン上で立ち上がる Coding Agent プロセスだけ。
したがって:

- **認証は実装しない**（OS ユーザー = AutoKanban ユーザー）
- **CORS・セッション・CSRF 対策は最小限**（localhost 同一オリジン）
- **外部ネットワーク公開は設計上禁止**

残る脅威は (a) SQL インジェクション、(b) コマンドインジェクション、(c) パストラバーサル、
(d) 依存関係の脆弱性 の 4 つ。これらは個別の実装規約で対策する。

## 設計意図

### なぜ認証を入れないか

- **ユーザー = 端末所有者**が 1:1 で成立するローカルアプリ。OS ログインが既に認証として機能
  している
- 認証を足すとログイン / セッション / トークン / 権限モデルを背負うことになり、
  個人利用の価値提案（摩擦ゼロで使い始める）と対立する
- 将来マルチユーザー化する場合は別エンティティとして後付けする（現時点では YAGNI）

### 脅威モデル

| 脅威 | 影響 | 対策 |
|---|---|---|
| 認証バイパス | — | 認証なし設計（問題にならない） |
| ネットワーク傍受 | — | localhost のみ通信（外部経路なし） |
| CSRF | — | localhost 同一オリジン、外部オリジンが呼べない |
| SQL インジェクション | 高 | Raw SQL + パラメータバインディング |
| コマンドインジェクション | 高 | `spawn([...])` 配列形式、shell 経由禁止 |
| パストラバーサル | 中 | 入口: Zod で `projectName` から `/` `\` `..` 等を拒否 / 出口: worktree 作成時にベースパス内か検証 |
| 依存関係の脆弱性 | 中 | `bun audit` 定期実行、最小依存主義。runtime-exposed な脆弱性は即修正、dev-tool 系は localhost-only threat model で許容 |

### 実装規約（single source of truth）

- **SQL**: すべて `sql\`...\`` タグ付きテンプレートで記述。パラメータは自動プレースホルダ化
  ([`raw_sql_is_used_instead_of_orm`](./raw_sql_is_used_instead_of_orm.md))
- **コマンド実行**: `Bun.spawn(['git', 'commit', '-m', message])` のように**配列形式で引数を渡す**。
  `exec(\`git commit -m "${message}"\`)` のようなシェル経由は禁止。
  ユーザー定義 Tool は `Tool.argv: string[]` を canonical とし、`{path}` を arg
  要素内のリテラル substring として置換（spawn 経由・shell なし）。レガシー string
  `Tool.command` を `sh -c` 経由で実行する場合でも、`{path}` は POSIX shell-escape
  してから挿入する（`server/src/usecases/tool/execute-tool.ts` の `resolveToolInvocation`）。
  → **「local-only でも入力は escape する」** を原則とする。理由:
  - パス・プロジェクト名・ブランチ名は OS / ユーザー / git から来る文字列で、
    空白 / `$` / `;` / バッククォート / 引用符を含み得る
  - 攻撃面でなくとも、**引用が崩れて意味不明な失敗 → デバッグ難**という DX 問題が
    現実に起きるので、injection の有無に関わらず escape は必須コスト
- **パス検証（2 段構え）**:
  1. **入口（Zod）**: `projectNameSchema` が project 作成/更新時に path separator (`/` `\`)、
     null byte、先頭ドット、前後空白、100 文字超を拒否。bad name が DB に入らないよう防ぐ
     （`server/src/presentation/trpc/routers/project.ts`）
  2. **出口（Repository）**: `WorktreeRepository.getWorktreePath` が
     `path.resolve(joined).startsWith(base + sep)` で最終チェック。DB を直接いじられた
     場合や将来の入力経路追加に対する共通バックストップ（worktree 関連 5 メソッド
     create / remove / exists / ensure / getInfo で共用）
- **入力バリデーション**: tRPC の `z.object({...}).input(...)` で全入力を検証。
  Presentation 層の責務（[`trpc_is_the_client_server_protocol`](./trpc_is_the_client_server_protocol.md)）
- **エラーメッセージ**: 外向きには汎用メッセージ、詳細は `Fail.details` に入れてログ・UI で
  選択的に表示

### ネットワーク設定

- HTTP サーバーは **`127.0.0.1` に bind**（`server/src/presentation/index.ts` の `HOST` 定数）
- 外部公開が必要な特殊ケース（WSL の Windows 側から繋ぐ等）は `AUTO_KANBAN_HOST=0.0.0.0`
  env で上書きできるが、**ユーザーが意図して trust を拡張した**という扱い
- tRPC Subscription (WebSocket) も同じ host
- データディレクトリ `~/.auto-kanban/` は所有者のみアクセス可

## 検討された代替案

- **ローカルでも認証を実装する**: ブラウザ拡張などから意図しない同 origin 呼び出しがあり得る
  懸念はあるが、個人利用で実害のある経路が現状存在しない。コストに見合わないと判断
- **外部 host への bind を許可する**（LAN 共有）: マルチユーザー前提 + 認証必須になるため
  「ローカル専用」設計原則と矛盾する。必要なら将来別モードで実装

## 主要メンバー

- `process.env.AUTO_KANBAN_HOST ?? "127.0.0.1"` — 外部公開を既定で防ぐ
- `Bun.spawn([...])` — シェル非経由のコマンド実行
- `projectNameSchema` (`server/src/presentation/trpc/routers/project.ts`) — パストラバーサル 1st layer
- `WorktreeRepository.getWorktreePath` — `path.resolve().startsWith(base + sep)` でパストラバーサル出口防御
- `z.object({...})` — Zod 入力スキーマ
- `bun audit` — 依存脆弱性チェック

## 依存関係の運用

- `bun audit` で定期チェック。**runtime / ユーザーデータ経路にある脆弱性** は即修正:
  - `hono` (HTTP / SSE routing): SSE writeSSE の CR/LF injection 等 → `^4.12.14` で解消済
  - `@modelcontextprotocol/sdk` (MCP stdio): ReDoS 等 → `^1.29.0` で解消済
- 次のカテゴリは **localhost-only threat model で許容** する前提（都度 trace をつけて audit を追う）:
  - `undici` (client 側 `jsdom` 経由 devDep) — test-only、runtime 露出なし
  - `vite` / `esbuild` / `picomatch` (client / server の build・lint・watch) — `start:dev` 稼働中のみ window、
    ローカル trust 境界内。ブラウザ経由の rebinding 攻撃を受けるには利用者が悪意あるサイトを
    開いている必要があり、その前提下では他の被害が先に出る
  - `path-to-regexp` (MCP SDK の transitive) — MCP は stdio-only で Internet 経路なし

→ 新たに脆弱性が出たら、まず「runtime / ユーザーデータに届くか」を判定し、届くなら即修正、
届かなければ上のリストに理由付きで追加する。

## 関連する動作

- [raw_sql_is_used_instead_of_orm](./raw_sql_is_used_instead_of_orm.md) — SQL インジェクション対策の骨格
- [trpc_is_the_client_server_protocol](./trpc_is_the_client_server_protocol.md) — 入力バリデーション層
- [mcp_injection_is_the_agent_context_bridge](../mcp-config/mcp_injection_is_the_agent_context_bridge.md) — MCP の境界
