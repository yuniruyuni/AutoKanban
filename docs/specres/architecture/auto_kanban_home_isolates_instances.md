---
id: "01KPZT8YMP9F6B9CJFFG809NM0"
name: "auto_kanban_home_isolates_instances"
status: "stable"
last_verified: "2026-04-23"
---

## 関連ファイル

- `server/src/infra/paths.ts` (`getAutoKanbanHome()` 定義)
- `server/src/infra/db/postgres.ts` (`dataDir = join(getAutoKanbanHome(), "postgres")`)
- `server/src/infra/db/pgschema.ts` (`pgschema` バイナリ配置先)
- `server/src/infra/port-file/index.ts` (ポートファイル配置先)
- `server/src/repositories/worktree/fs/index.ts` (`worktrees` プール配置先)
- `scripts/start-preview.sh` (子 AutoKanban を立ち上げる際に `AUTO_KANBAN_HOME` を設定する例)
- `auto-kanban.json` (`cleanup` で `/tmp/auto-kanban-preview-${AK_WORKSPACE_ID}-*` を掃除)

## 機能概要

AutoKanban の「すべてのローカル状態を置く場所」＝ **state root directory** を
`AUTO_KANBAN_HOME` 環境変数 1 本で差し替えられる。デフォルトは `~/.auto-kanban`。

state root の下に置かれるもの:

- `postgres/` — embedded-postgres のデータディレクトリ
- `bin/` — `pgschema` など AutoKanban が取得するバイナリ
- `ports/` — `server.port` を公開するポートファイル
- `worktrees/` — AutoKanban が作る git worktree プール

`getAutoKanbanHome()` が **プロセス起動時ではなく呼び出し時に** `process.env.AUTO_KANBAN_HOME`
を読むため、同じ Node プロセスの中で起動時にだけ参照される値としても、
環境変数側の override が先行していれば確実にそちらが効く。

## 設計意図

### 何を解決するか — 「AutoKanban on AutoKanban」の破壊

AutoKanban 自体を AutoKanban 上の task として動かすと (dogfood)、
**子の AutoKanban が親と同じ `~/.auto-kanban` を使いに行ってしまう**:

1. 子の起動時 `recoverOrphanedProcesses` が、共有 PostgreSQL 上の
   **親の** `dev_server_processes` 行をすべて "killed" に書き換える
2. 子の PostgreSQL 起動が親の PG ロックと衝突する / PG 側が "database system is shutting down" を吐く
3. `worktrees/` プールが同じパスを奪い合う

実害は (1) が支配的で、「ある worktree で子 AutoKanban を起動した途端、親側の Preview / Prepare が全部停止扱いになる」
という症状を起こす。

### なぜ env 変数 1 本で解決したか

- **AutoKanban 自身に "子モード" を足さない**: プロセスの起動コンテキスト
  (親 / 子 / CI / 単独) を本体が知る必要がない。env を見て state root を解決するだけ
- **プロジェクト側が決める**: 分離したいかどうかはプロジェクトの `auto-kanban.json` が
  自分で判断する (`scripts/start-preview.sh` が `AK_PROCESS_ID` の有無で分岐)。
  AutoKanban 一般ユースケースで使いたい人が「isolated mode で AutoKanban をもう 1 本立てる」
  のも同じ仕組みで済む
- **複数の lookup 箇所を 1 か所に集約**: 元々 `~/.auto-kanban` は 4 箇所 (pg / bin / ports / worktrees)
  にハードコードされていた。`getAutoKanbanHome()` 経由にしたことで、分離の入口が 1 箇所になる

### スコープの線引き

- `AUTO_KANBAN_HOME` は state root だけ決める。`AUTO_KANBAN_HOST` / `PORT` 等の
  ネットワーク変数は別系統（[local_only_security_model](./local_only_security_model.md)）
- **DB マイグレーションの共有は行わない**。子 AutoKanban は親と完全に独立した
  PG インスタンスを起動する — schema を別々に管理する覚悟の分離
- **cleanup はプロジェクト側の責務**。AutoKanban 本体は「state root を作る」だけで、
  「task を消した時に isolated state を消す」のは `auto-kanban.json` の `cleanup` に任せる
  (本プロジェクトの例: `rm -rf /tmp/auto-kanban-preview-${AK_WORKSPACE_ID}-*`)

### 採用した配置例 (このリポジトリの dogfood)

```sh
# scripts/start-preview.sh 抜粋
if [ -n "$AK_PROCESS_ID" ]; then
  export AUTO_KANBAN_HOME="/tmp/auto-kanban-preview-${AK_WORKSPACE_ID}-${AK_PROCESS_ID}"
fi
```

- `/tmp` 配下に置くことで OS 側の自動掃除機構にも乗る
- ディレクトリ名に `AK_WORKSPACE_ID` を含めることで、task (workspace) 単位で glob できる
- `AK_PROCESS_ID` まで含めることで、同じ task の再起動も衝突しない

## 失敗 / 例外

- `AUTO_KANBAN_HOME` に書き込み権限がない → pg / pgschema / worktree 作成時に失敗 (通常の I/O エラー)
- パスに含まれる特殊文字は OS まかせ (AutoKanban 本体側ではバリデーションしない)
- **同じ `AUTO_KANBAN_HOME` で複数の AutoKanban を同時起動すると PG ロックで衝突する**:
  これは意図した fail-fast。分離したければそれぞれ別値を設定する

## 関連する動作

- [ak_env_context_is_exported_to_spawned_scripts](./ak_env_context_is_exported_to_spawned_scripts.md) — `AK_PROCESS_ID` 等が env として渡ってくる仕組み
- [local_only_security_model](./local_only_security_model.md) — `AUTO_KANBAN_HOST` 側の env 取り扱い
- [postgresql_is_embedded_for_storage](./postgresql_is_embedded_for_storage.md) — state root に入る最大の子
