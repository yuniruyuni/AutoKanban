# API設計（tRPC）

## 概要

- **フレームワーク**: tRPC v11
- **統合**: Hono + @hono/trpc-server
- **形式**: 型安全なRPC（Query/Mutation/Subscription）
- **バリデーション**: Zod
- **アーキテクチャ**: レイヤードアーキテクチャ（Presentation → Usecase → Repository）

## tRPCの利点

```
┌─────────────────────────────────────────────────────────────┐
│  型定義不要 - バックエンドの型がフロントエンドに自動伝播      │
│                                                             │
│  Backend                           Frontend                 │
│                                                             │
│  presentation/routers/task.ts      pages/Tasks.tsx          │
│  ┌─────────────────┐               ┌─────────────────┐     │
│  │ export const    │               │                 │     │
│  │ taskRouter = {  │──── 型推論 ───▶│ trpc.task.list │     │
│  │   list: proc    │               │   .useQuery()   │     │
│  │     .query()    │               │                 │     │
│  │                 │               │ // Task[] 型    │     │
│  │   create: proc  │──── 型推論 ───▶│ trpc.task      │     │
│  │     .mutation() │               │   .create      │     │
│  │ }               │               │   .useMutation()│     │
│  └─────────────────┘               └─────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## ルーター構成

```
server/src/presentation/
├── trpc.ts           # tRPC初期化
├── context.ts        # コンテキスト定義
└── routers/
    ├── index.ts          # App Router（全ルーター統合）
    ├── project.ts        # プロジェクト関連
    ├── task.ts           # タスク関連
    ├── workspace.ts      # ワークスペース関連
    ├── session.ts        # セッション関連
    ├── executionProcess.ts  # 実行プロセス関連
    ├── repo.ts           # リポジトリ関連
    └── config.ts         # 設定関連
```

## App Router

```typescript
// server/src/presentation/routers/index.ts
import { router } from '../trpc';
import { projectRouter } from './project';
import { taskRouter } from './task';
import { workspaceRouter } from './workspace';
import { sessionRouter } from './session';
import { executionProcessRouter } from './executionProcess';
import { repoRouter } from './repo';
import { configRouter } from './config';

export const appRouter = router({
  project: projectRouter,
  task: taskRouter,
  workspace: workspaceRouter,
  session: sessionRouter,
  executionProcess: executionProcessRouter,
  repo: repoRouter,
  config: configRouter,
});

// フロントエンドで使用する型
export type AppRouter = typeof appRouter;
```

## tRPC初期化

```typescript
// server/src/presentation/trpc.ts
import { initTRPC } from '@trpc/server';
import { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
```

## コンテキスト

```typescript
// server/src/presentation/context.ts
import type { Database } from 'bun:sqlite';
import { db } from '../repositories/db';

export interface Context {
  db: Database;
}

export function createContext(): Context {
  return { db };
}
```

---

## ルーター詳細

ルーターはPresentation Layerとして、入力のバリデーションとUsecase呼び出しのみを担当。
ビジネスロジックはUsecase層、データアクセスはRepository層で実装。

### Project Router

```typescript
// server/src/presentation/routers/project.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ListProjectsUsecase } from '../../usecases/project/listProjects';
import { GetProjectUsecase } from '../../usecases/project/getProject';
import { CreateProjectUsecase } from '../../usecases/project/createProject';
import { UpdateProjectUsecase } from '../../usecases/project/updateProject';
import { DeleteProjectUsecase } from '../../usecases/project/deleteProject';

export const projectRouter = router({
  // 一覧取得
  list: publicProcedure.query(async ({ ctx }) => {
    const usecase = new ListProjectsUsecase(ctx.db);
    return usecase.execute();
  }),

  // 単一取得
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new GetProjectUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // 作成
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      devScript: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new CreateProjectUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // 更新
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100).optional(),
      devScript: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new UpdateProjectUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // 削除
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new DeleteProjectUsecase(ctx.db);
      return usecase.execute(input.id);
    }),
});
```

### Task Router

```typescript
// server/src/presentation/routers/task.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ListTasksUsecase } from '../../usecases/task/listTasks';
import { GetTaskUsecase } from '../../usecases/task/getTask';
import { CreateTaskUsecase } from '../../usecases/task/createTask';
import { UpdateTaskUsecase } from '../../usecases/task/updateTask';
import { DeleteTaskUsecase } from '../../usecases/task/deleteTask';
import { Task } from '../../models/task';
import { observable } from '@trpc/server/observable';
import { taskEvents } from '../../repositories/event-repository';

const taskStatus = ['todo', 'inprogress', 'inreview', 'done', 'cancelled'] as const;

export const taskRouter = router({
  // 一覧取得（プロジェクト指定）
  list: publicProcedure
    .input(z.object({
      projectId: z.string(),
      statuses: z.array(z.enum(taskStatus)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const usecase = new ListTasksUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // 単一取得
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new GetTaskUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // 作成
  create: publicProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new CreateTaskUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // 更新
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      status: z.enum(taskStatus).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new UpdateTaskUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // 削除
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new DeleteTaskUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // リアルタイム更新（Subscription）
  onUpdate: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .subscription(({ input }) => {
      return observable<Task>((emit) => {
        const onTaskUpdate = (task: Task) => {
          if (task.projectId === input.projectId) {
            emit.next(task);
          }
        };

        taskEvents.on('update', onTaskUpdate);

        return () => {
          taskEvents.off('update', onTaskUpdate);
        };
      });
    }),
});
```

### Workspace Router

```typescript
// server/src/presentation/routers/workspace.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ListWorkspacesUsecase } from '../../usecases/workspace/listWorkspaces';
import { GetWorkspaceUsecase } from '../../usecases/workspace/getWorkspace';
import { CreateWorkspaceUsecase } from '../../usecases/workspace/createWorkspace';
import { StopWorkspaceUsecase } from '../../usecases/workspace/stopWorkspace';
import { DeleteWorkspaceUsecase } from '../../usecases/workspace/deleteWorkspace';

export const workspaceRouter = router({
  // 一覧取得（タスク指定）
  list: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new ListWorkspacesUsecase(ctx.db);
      return usecase.execute(input.taskId);
    }),

  // 単一取得
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new GetWorkspaceUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // 作成（＆開始）
  create: publicProcedure
    .input(z.object({
      taskId: z.string(),
      executor: z.string(),
      repos: z.array(z.object({
        repoId: z.string(),
        targetBranch: z.string(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new CreateWorkspaceUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // 停止
  stop: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new StopWorkspaceUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // 削除
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new DeleteWorkspaceUsecase(ctx.db);
      return usecase.execute(input.id);
    }),
});
```

### Session Router

```typescript
// server/src/presentation/routers/session.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ListSessionsUsecase } from '../../usecases/session/listSessions';
import { CreateSessionUsecase } from '../../usecases/session/createSession';

export const sessionRouter = router({
  // 一覧取得
  list: publicProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new ListSessionsUsecase(ctx.db);
      return usecase.execute(input.workspaceId);
    }),

  // 作成
  create: publicProcedure
    .input(z.object({
      workspaceId: z.string(),
      executor: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new CreateSessionUsecase(ctx.db);
      return usecase.execute(input);
    }),
});
```

### Execution Process Router

```typescript
// server/src/presentation/routers/executionProcess.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ListExecutionProcessesUsecase } from '../../usecases/executionProcess/listExecutionProcesses';
import { GetExecutionProcessUsecase } from '../../usecases/executionProcess/getExecutionProcess';
import { GetLogsUsecase } from '../../usecases/executionProcess/getLogs';
import { SendMessageUsecase } from '../../usecases/executionProcess/sendMessage';
import { AbortProcessUsecase } from '../../usecases/executionProcess/abortProcess';
import { observable } from '@trpc/server/observable';
import { logStreams } from '../../repositories/event-repository';

export const executionProcessRouter = router({
  // 一覧取得
  list: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new ListExecutionProcessesUsecase(ctx.db);
      return usecase.execute(input.sessionId);
    }),

  // 単一取得
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new GetExecutionProcessUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // ログ取得
  logs: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new GetLogsUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // メッセージ送信（エージェントへの入力）
  sendMessage: publicProcedure
    .input(z.object({
      id: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new SendMessageUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // 中断
  abort: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new AbortProcessUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // ログストリーム（Subscription）
  onLog: publicProcedure
    .input(z.object({ id: z.string() }))
    .subscription(({ input }) => {
      return observable<string>((emit) => {
        const onLogChunk = (chunk: string) => {
          emit.next(chunk);
        };

        logStreams.on(input.id, onLogChunk);

        return () => {
          logStreams.off(input.id, onLogChunk);
        };
      });
    }),
});
```

### Repo Router

```typescript
// server/src/presentation/routers/repo.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ListReposUsecase } from '../../usecases/repo/listRepos';
import { ListReposByProjectUsecase } from '../../usecases/repo/listReposByProject';
import { GetRepoUsecase } from '../../usecases/repo/getRepo';
import { AddRepoToProjectUsecase } from '../../usecases/repo/addRepoToProject';
import { UpdateScriptsUsecase } from '../../usecases/repo/updateScripts';

export const repoRouter = router({
  // 一覧取得
  list: publicProcedure.query(async ({ ctx }) => {
    const usecase = new ListReposUsecase(ctx.db);
    return usecase.execute();
  }),

  // プロジェクトのリポジトリ一覧
  listByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new ListReposByProjectUsecase(ctx.db);
      return usecase.execute(input.projectId);
    }),

  // 単一取得
  byId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const usecase = new GetRepoUsecase(ctx.db);
      return usecase.execute(input.id);
    }),

  // プロジェクトにリポジトリ追加
  addToProject: publicProcedure
    .input(z.object({
      projectId: z.string(),
      repoPath: z.string(),
      displayName: z.string(),
      setupScript: z.string().optional(),
      cleanupScript: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new AddRepoToProjectUsecase(ctx.db);
      return usecase.execute(input);
    }),

  // スクリプト更新
  updateScripts: publicProcedure
    .input(z.object({
      projectId: z.string(),
      repoId: z.string(),
      setupScript: z.string().optional(),
      cleanupScript: z.string().optional(),
      devServerScript: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new UpdateScriptsUsecase(ctx.db);
      return usecase.execute(input);
    }),
});
```

### Config Router

```typescript
// server/src/presentation/routers/config.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { GetConfigUsecase } from '../../usecases/config/getConfig';
import { UpdateConfigUsecase } from '../../usecases/config/updateConfig';

export const configRouter = router({
  // 設定取得
  get: publicProcedure.query(async ({ ctx }) => {
    const usecase = new GetConfigUsecase(ctx.db);
    return usecase.execute();
  }),

  // 設定更新
  update: publicProcedure
    .input(z.object({
      mcp: z.record(z.any()).optional(),
      executors: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const usecase = new UpdateConfigUsecase(ctx.db);
      return usecase.execute(input);
    }),
});
```

---

## Honoとの統合

```typescript
// server/src/index.ts
import { Hono } from 'hono';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './presentation/routers';
import { createContext } from './presentation/context';

const app = new Hono();

// tRPCルート
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

// 静的ファイル（フロントエンド）
app.use('/*', serveStatic({ root: './public' }));

export default app;
```

## WebSocket（Subscription用）

```typescript
// server/src/presentation/websocket.ts
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import { appRouter } from './routers';
import { createContext } from './context';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/trpc' });

  applyWSSHandler({
    wss,
    router: appRouter,
    createContext,
  });

  return wss;
}
```

---

## フロントエンドでの使用

### tRPCクライアント設定

```typescript
// client/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../server/src/presentation/routers';

export const trpc = createTRPCReact<AppRouter>();
```

### Provider設定

```typescript
// client/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, wsLink, splitLink } from '@trpc/client';
import { trpc } from './lib/trpc';

const queryClient = new QueryClient();

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: wsLink({ url: 'ws://localhost:3000/trpc' }),
      false: httpBatchLink({ url: '/trpc' }),
    }),
  ],
});

function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* ... */}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

### コンポーネントでの使用

```typescript
// Query例
function TaskList({ projectId }: { projectId: string }) {
  const { data: tasks, isLoading } = trpc.task.list.useQuery({ projectId });

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {tasks?.map(task => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  );
}

// Mutation例
function CreateTaskForm({ projectId }: { projectId: string }) {
  const utils = trpc.useUtils();
  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate({ projectId });
    },
  });

  const handleSubmit = (title: string) => {
    createTask.mutate({ projectId, title });
  };

  return (/* ... */);
}

// Subscription例
function TaskUpdates({ projectId }: { projectId: string }) {
  trpc.task.onUpdate.useSubscription(
    { projectId },
    {
      onData: (task) => {
        console.log('Task updated:', task);
      },
    }
  );

  return null;
}
```

---

## 型の流れ

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. Model Layer (models/*.ts)                                │
│     └─▶ Task, Project, etc. のドメインモデル型               │
│     └─▶ defineSpecs + SpecsOf で Spec 型を自動導出           │
│                                                              │
│  2. Repository Layer (repositories/*.ts)                     │
│     └─▶ DB行 ↔ Model の変換を内部で処理                      │
│     └─▶ Spec → SQL変換（compToSQL）                          │
│                                                              │
│  3. Usecase Layer (usecases/*.ts)                            │
│     └─▶ Model型で入出力、ビジネスロジック実行                 │
│                                                              │
│  4. tRPC Router (presentation/routers/*.ts)                  │
│     └─▶ input/output の型が自動推論                          │
│     └─▶ Zod でバリデーション                                 │
│                                                              │
│  5. AppRouter 型エクスポート                                  │
│     └─▶ export type AppRouter = typeof appRouter             │
│                                                              │
│  6. Frontend tRPC Client (lib/trpc.ts)                       │
│     └─▶ AppRouter を import して型付きクライアント生成        │
│                                                              │
│  7. React Component                                          │
│     └─▶ trpc.task.list.useQuery() で完全な型推論            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```
