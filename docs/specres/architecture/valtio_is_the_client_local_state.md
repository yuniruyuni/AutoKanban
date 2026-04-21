---
id: "01KPPZWHXV5WC3V732NY8CG046"
name: "valtio_is_the_client_local_state"
status: "draft"
---

## 関連ファイル

- `client/src/store/ui.ts` / `client/src/store/execution.ts` (Valtio proxy)
- `client/src/lib/trpc.ts` (tRPC React Query 側)
- `.claude/rules/client-patterns.md`

## 機能概要

クライアントの状態管理は **2 系統**に明確に分かれる:

| 状態の種類 | 管理ライブラリ |
|---|---|
| サーバーデータ (キャッシュ / 同期 / リアルタイム更新) | tRPC + React Query |
| UI ローカル状態 (選択・フィルター・モーダル・ドラッグ中フラグ・入力下書き) | **Valtio** |

Valtio は `proxy()` で包んだオブジェクトを直接代入でミュータブルに編集でき、
`useSnapshot()` を介するコンポーネントは変更を自動購読する。
Redux / Zustand のような「setState と reducer」のボイラープレートが出ない。

```ts
// store/ui.ts
export const uiState = proxy<UIState>({ sidebarOpen: true, selectedTaskId: null });
export const uiActions = {
  toggleSidebar: () => { uiState.sidebarOpen = !uiState.sidebarOpen; },
  selectTask: (id: string | null) => { uiState.selectedTaskId = id; },
};

// component
const ui = useSnapshot(uiState);
```

## 設計意図

- **ボイラープレート最小**: Zustand の `set((state) => ({ ... }))` や Jotai の atom の連鎖を
  避け、**「普通のオブジェクトに代入するだけ」**で済む感触を優先
- **tRPC/React Query との役割分担**: サーバー状態（fetch + cache + 再取得）は React Query の
  得意領域。Valtio はあくまで UI 側のちらついた状態のためで、重なり合わない
- **リアルタイム更新との相性**: SSE で受けたイベントを `uiState.tasks[i] = next` のように
  直接代入で反映できる。イミュータブル変換のオーバーヘッドが不要
- **Proxy ベースの自動追跡**: どのフィールドが参照されたかを Proxy が自動追跡するので、
  セレクタを書かなくても変更検知が効く

## 検討された代替案

- **Zustand**: 軽量で実績豊富だが、`set` / selector のボイラープレートが残る。大規模共同開発
  でない以上、Valtio の「ただ代入」のほうが早い
- **Jotai**: atom の合成で細粒度な購読が可能だが、atom 間の依存関係が増えたときに全体像が
  見えにくくなる。AutoKanban は UI ステートの粒度が太いので atom の細かさは活きない
- **Redux Toolkit**: 個人開発には重い。学習コストと reducer の boilerplate が主な理由

## 主要メンバー

- `proxy<T>(initial)`: 状態オブジェクトを Proxy で包む
- `useSnapshot(proxy)`: コンポーネント側の購読 API（読み取り専用スナップショットを返す）
- アクションは **`xxxActions` という名前付きオブジェクト**にまとめるのが本プロジェクトの慣習
  （`.claude/rules/client-patterns.md`）

## 関連する動作

- [typescript_is_the_single_language_across_stack](./typescript_is_the_single_language_across_stack.md) — 型共有の枠組み
- [trpc_is_the_client_server_protocol](./trpc_is_the_client_server_protocol.md) — サーバー状態側の相方
- UI 系カード: [`kanban_board_renders_tasks_by_status`](../ui-kanban/kanban_board_renders_tasks_by_status.md), [`task_detail_panel_shows_conversation_and_diff`](../ui-kanban/task_detail_panel_shows_conversation_and_diff.md)
