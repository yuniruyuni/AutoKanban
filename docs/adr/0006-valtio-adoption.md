# ADR-0006: Valtio採用（Zustand不採用）

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

Auto Kanbanのフロントエンドでは、サーバー状態はtRPC + React Queryで管理する（ADR-0003参照）。これに加えて、UIのローカル状態（サイドバー開閉、選択状態、フィルター等）を管理するライブラリを選定する必要がある。

### 要件

- シンプルなAPI
- TypeScriptとの親和性
- React 18/19対応
- 低いボイラープレート
- 直感的な状態更新

### 検討した選択肢

#### 選択肢1: Zustand

広く使われている軽量状態管理ライブラリ。

**利点:**
- 軽量でシンプル
- React外でも使用可能
- ミドルウェアサポート（persist, devtools）
- 成熟したエコシステム

**欠点:**
- イミュータブルな更新が必要
- セレクターの記述が必要
- ストア定義のボイラープレート

```typescript
// Zustand
const useTaskStore = create<TaskState>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  tasks: [],
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
}));
```

#### 選択肢2: Jotai

**利点:**
- アトミックな状態管理
- 細粒度のリアクティビティ
- Suspense対応

**欠点:**
- アトム間の依存関係が複雑になりやすい
- 概念の学習コスト

#### 選択肢3: Valtio

**利点:**
- ミュータブルな操作でイミュータブルな動作
- Proxyベースで自動追跡
- 極小のボイラープレート
- 直感的なAPI

**欠点:**
- Proxyの動作理解が必要
- デバッグツールがZustandほど成熟していない

```typescript
// Valtio
const uiState = proxy({
  selectedId: null as string | null,
  tasks: [] as Task[],
});

// 直接代入でOK
uiState.selectedId = 'task-123';
uiState.tasks.push(newTask);
```

## 決定

**Valtioを採用する。**

## 根拠

1. **最小のボイラープレート**: 直接代入で状態更新が可能。セレクターやアクション定義が不要。

```typescript
// Zustand
set((state) => ({ tasks: [...state.tasks, task] }));

// Valtio
state.tasks.push(task);
```

2. **直感的な操作**: JavaScriptの通常のオブジェクト操作と同じ感覚で使用可能。

3. **tRPC/React Queryとの役割分担が明確**:

| 状態の種類 | 管理ライブラリ |
|-----------|---------------|
| サーバーデータ | tRPC + React Query |
| UIローカル状態 | Valtio |

4. **WebSocket更新との相性**: リアルタイム更新で受信したデータを直接代入で反映可能。

```typescript
trpc.task.onUpdate.useSubscription(
  { projectId },
  {
    onData: (task) => {
      // 直接更新
      const index = uiState.tasks.findIndex(t => t.id === task.id);
      if (index >= 0) {
        uiState.tasks[index] = task;
      }
    },
  }
);
```

5. **学習コストの低さ**: Proxyの概念を理解すれば、それ以外は通常のJavaScript。

## 結果

### ポジティブ

- ボイラープレートの大幅削減
- 直感的な状態更新
- リアルタイム更新との相性良好
- TypeScriptとの自然な統合

### ネガティブ

- Zustandほどのエコシステム成熟度はない
- Proxyの動作に関する理解が必要

### 使用パターン

#### UIストア

```typescript
// store/uiStore.ts
import { proxy, useSnapshot } from 'valtio';

interface UIState {
  sidebarOpen: boolean;
  selectedTaskId: string | null;
  activeModal: 'createTask' | 'settings' | null;
}

export const uiState = proxy<UIState>({
  sidebarOpen: true,
  selectedTaskId: null,
  activeModal: null,
});

// アクション（普通の関数）
export const uiActions = {
  toggleSidebar: () => {
    uiState.sidebarOpen = !uiState.sidebarOpen;
  },
  selectTask: (id: string | null) => {
    uiState.selectedTaskId = id;
  },
  openModal: (modal: UIState['activeModal']) => {
    uiState.activeModal = modal;
  },
  closeModal: () => {
    uiState.activeModal = null;
  },
};

// フック
export function useUI() {
  return useSnapshot(uiState);
}
```

#### コンポーネントでの使用

```typescript
function TaskList() {
  const ui = useUI();

  return (
    <div>
      {ui.selectedTaskId && <TaskDetail id={ui.selectedTaskId} />}
      <button onClick={() => uiActions.openModal('createTask')}>
        New Task
      </button>
    </div>
  );
}
```

### 状態管理の全体像

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend State                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │  tRPC + React Query │    │       Valtio        │        │
│  │                     │    │                     │        │
│  │  - サーバーデータ     │    │  - UIローカル状態    │        │
│  │  - キャッシュ        │    │  - フィルター       │        │
│  │  - 同期状態         │    │  - 選択状態         │        │
│  │  - リアルタイム更新   │    │  - 一時的な入力     │        │
│  │                     │    │  - モーダル状態     │        │
│  └─────────────────────┘    └─────────────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 参考資料

- [Valtio公式ドキュメント](https://github.com/pmndrs/valtio)
- [Valtio vs Zustand](https://github.com/pmndrs/valtio/wiki/How-valtio-differs-from-zustand)
