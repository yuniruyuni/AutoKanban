# フロントエンド構造

## 概要

- **フレームワーク**: React 19
- **言語**: TypeScript
- **ビルドツール**: Vite
- **スタイリング**: Tailwind CSS
- **状態管理**: Valtio（ローカル状態）+ tRPC React Query（サーバー状態）

## ディレクトリ構造

```
client/
├── src/
│   ├── main.tsx           # エントリポイント
│   ├── App.tsx            # ルートコンポーネント
│   ├── lib/
│   │   └── trpc.ts        # tRPCクライアント
│   ├── pages/             # ページコンポーネント
│   │   ├── Projects.tsx
│   │   ├── Tasks.tsx
│   │   └── Workspace.tsx
│   ├── components/        # UIコンポーネント
│   │   ├── common/
│   │   ├── tasks/
│   │   └── workspace/
│   └── store/            # Valtioストア
│       ├── uiStore.ts
│       └── filterStore.ts
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

---

## 状態管理

### 役割分担

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

### Valtioストア

#### UIストア

```typescript
// client/src/store/uiStore.ts
import { proxy, useSnapshot } from 'valtio';

interface UIState {
  sidebarOpen: boolean;
  selectedTaskId: string | null;
  activeModal: 'createTask' | 'createProject' | 'settings' | null;
  theme: 'light' | 'dark' | 'system';
}

export const uiState = proxy<UIState>({
  sidebarOpen: true,
  selectedTaskId: null,
  activeModal: null,
  theme: 'system',
});

// アクション（普通の関数）
export const uiActions = {
  toggleSidebar: () => {
    uiState.sidebarOpen = !uiState.sidebarOpen;
  },

  selectTask: (taskId: string | null) => {
    uiState.selectedTaskId = taskId;
  },

  openModal: (modal: UIState['activeModal']) => {
    uiState.activeModal = modal;
  },

  closeModal: () => {
    uiState.activeModal = null;
  },

  setTheme: (theme: UIState['theme']) => {
    uiState.theme = theme;
  },
};

// フック
export function useUI() {
  return useSnapshot(uiState);
}
```

#### フィルターストア

```typescript
// client/src/store/filterStore.ts
import { proxy, useSnapshot } from 'valtio';
import { derive } from 'valtio/utils';
import type { TaskStatus } from '../types';

interface FilterState {
  statusFilter: TaskStatus | 'all';
  searchQuery: string;
  sortBy: 'createdAt' | 'updatedAt' | 'title';
  sortOrder: 'asc' | 'desc';
}

export const filterState = proxy<FilterState>({
  statusFilter: 'all',
  searchQuery: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
});

export const filterActions = {
  setStatusFilter: (status: FilterState['statusFilter']) => {
    filterState.statusFilter = status;
  },

  setSearchQuery: (query: string) => {
    filterState.searchQuery = query;
  },

  setSortBy: (sortBy: FilterState['sortBy']) => {
    filterState.sortBy = sortBy;
  },

  toggleSortOrder: () => {
    filterState.sortOrder = filterState.sortOrder === 'asc' ? 'desc' : 'asc';
  },

  reset: () => {
    filterState.statusFilter = 'all';
    filterState.searchQuery = '';
    filterState.sortBy = 'createdAt';
    filterState.sortOrder = 'desc';
  },
};

export function useFilters() {
  return useSnapshot(filterState);
}
```

### tRPC + React Query

#### クライアント設定

```typescript
// client/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/routers';

export const trpc = createTRPCReact<AppRouter>();
```

#### Provider設定

```typescript
// client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, wsLink, splitLink } from '@trpc/client';
import { trpc } from './lib/trpc';
import App from './App';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1分
      refetchOnWindowFocus: false,
    },
  },
});

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '';
  }
  return 'http://localhost:3000';
};

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: wsLink({
        url: `${getBaseUrl().replace('http', 'ws')}/trpc`,
      }),
      false: httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
      }),
    }),
  ],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
```

---

## ページ構成

### App.tsx（ルーティング）

```typescript
// client/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Projects } from './pages/Projects';
import { Tasks } from './pages/Tasks';
import { Workspace } from './pages/Workspace';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Projects />} />
          <Route path="/projects/:projectId" element={<Tasks />} />
          <Route path="/workspaces/:workspaceId" element={<Workspace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

### Projects ページ

```typescript
// client/src/pages/Projects.tsx
import { trpc } from '../lib/trpc';
import { uiActions } from '../store/uiStore';
import { ProjectCard } from '../components/projects/ProjectCard';
import { CreateProjectDialog } from '../components/dialogs/CreateProjectDialog';

export function Projects() {
  const { data: projects, isLoading } = trpc.project.list.useQuery();

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => uiActions.openModal('createProject')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      <CreateProjectDialog />
    </div>
  );
}
```

### Tasks ページ

```typescript
// client/src/pages/Tasks.tsx
import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useFilters, filterActions } from '../store/filterStore';
import { TaskList } from '../components/tasks/TaskList';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { CreateTaskDialog } from '../components/dialogs/CreateTaskDialog';

export function Tasks() {
  const { projectId } = useParams<{ projectId: string }>();
  const filters = useFilters();

  const { data: tasks, isLoading } = trpc.task.list.useQuery({
    projectId: projectId!,
    status: filters.statusFilter === 'all' ? undefined : filters.statusFilter,
  });

  // リアルタイム更新
  trpc.task.onUpdate.useSubscription(
    { projectId: projectId! },
    {
      onData: (task) => {
        // React Queryのキャッシュを更新
        utils.task.list.invalidate({ projectId: projectId! });
      },
    }
  );

  const utils = trpc.useUtils();

  // フィルター適用
  const filteredTasks = tasks?.filter((task) => {
    if (filters.searchQuery) {
      return task.title.toLowerCase().includes(filters.searchQuery.toLowerCase());
    }
    return true;
  });

  // ソート適用
  const sortedTasks = filteredTasks?.sort((a, b) => {
    const aValue = a[filters.sortBy];
    const bValue = b[filters.sortBy];
    const order = filters.sortOrder === 'asc' ? 1 : -1;
    return aValue < bValue ? -order : order;
  });

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <TaskFilters />
      <TaskList tasks={sortedTasks ?? []} />
      <CreateTaskDialog projectId={projectId!} />
    </div>
  );
}
```

### Workspace ページ

```typescript
// client/src/pages/Workspace.tsx
import { useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { LogViewer } from '../components/workspace/LogViewer';
import { SessionList } from '../components/workspace/SessionList';
import { WorkspaceHeader } from '../components/workspace/WorkspaceHeader';

export function Workspace() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const { data: workspace } = trpc.workspace.byId.useQuery({
    id: workspaceId!,
  });

  if (!workspace) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <WorkspaceHeader workspace={workspace} />

      <div className="flex-1 flex">
        <div className="w-64 border-r">
          <SessionList sessions={workspace.sessions} />
        </div>

        <div className="flex-1">
          <LogViewer workspaceId={workspaceId!} />
        </div>
      </div>
    </div>
  );
}
```

---

## コンポーネント

### TaskList

```typescript
// client/src/components/tasks/TaskList.tsx
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { uiActions } from '../../store/uiStore';
import type { Task } from '../../types';

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const updateTask = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
    },
  });

  const handleStatusChange = (taskId: string, status: Task['status']) => {
    updateTask.mutate({ id: taskId, status });
  };

  const handleStartWorkspace = (taskId: string) => {
    // ワークスペース作成ダイアログを開く
    uiActions.selectTask(taskId);
    uiActions.openModal('createWorkspace');
  };

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="p-4 bg-white rounded-lg shadow border hover:border-blue-500 cursor-pointer"
          onClick={() => uiActions.selectTask(task.id)}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{task.title}</h3>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
              onClick={(e) => e.stopPropagation()}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="todo">Todo</option>
              <option value="inprogress">In Progress</option>
              <option value="inreview">In Review</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {task.description && (
            <p className="text-sm text-gray-600 mt-2">{task.description}</p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleStartWorkspace(task.id);
              }}
              className="text-sm px-3 py-1 bg-green-600 text-white rounded"
            >
              Start Workspace
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### LogViewer

```typescript
// client/src/components/workspace/LogViewer.tsx
import { useEffect, useRef, useState } from 'react';
import { trpc } from '../../lib/trpc';

interface LogViewerProps {
  executionProcessId: string;
}

export function LogViewer({ executionProcessId }: LogViewerProps) {
  const [logs, setLogs] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 初期ログ取得
  const { data: initialLogs } = trpc.executionProcess.logs.useQuery({
    id: executionProcessId,
  });

  // リアルタイムログ
  trpc.executionProcess.onLog.useSubscription(
    { id: executionProcessId },
    {
      onData: (chunk) => {
        setLogs((prev) => prev + chunk);
      },
    }
  );

  // 初期ログをセット
  useEffect(() => {
    if (initialLogs) {
      setLogs(initialLogs);
    }
  }, [initialLogs]);

  // 自動スクロール
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto bg-gray-900 text-gray-100 p-4 font-mono text-sm"
    >
      <pre className="whitespace-pre-wrap">{logs}</pre>
    </div>
  );
}
```

### CreateTaskDialog

```typescript
// client/src/components/dialogs/CreateTaskDialog.tsx
import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { useUI, uiActions } from '../../store/uiStore';

interface CreateTaskDialogProps {
  projectId: string;
}

export function CreateTaskDialog({ projectId }: CreateTaskDialogProps) {
  const ui = useUI();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const utils = trpc.useUtils();
  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate({ projectId });
      uiActions.closeModal();
      setTitle('');
      setDescription('');
    },
  });

  if (ui.activeModal !== 'createTask') {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTask.mutate({ projectId, title, description });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Create Task</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => uiActions.closeModal()}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTask.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
            >
              {createTask.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## スタイリング

### Tailwind設定

```javascript
// client/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
        },
      },
    },
  },
  plugins: [],
};
```

### グローバルスタイル

```css
/* client/src/styles/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  }

  .btn-secondary {
    @apply px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors;
  }

  .input {
    @apply w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500;
  }

  .card {
    @apply bg-white rounded-lg shadow border;
  }
}
```

---

## Vite設定

```typescript
// client/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/trpc': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

---

## package.json

```json
{
  "name": "@auto-kanban/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.0.0",
    "valtio": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

---

## 開発コマンド

```bash
# 開発サーバー起動
bun run start:dev

# 本番ビルド
bun run build

# プレビュー
bun run start:prod

# 型チェック
bun run tsc --noEmit

# リント
bun run check:lint
```
