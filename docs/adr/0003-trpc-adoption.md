# ADR-0003: tRPC採用（REST/GraphQL不採用）

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

Auto KanbanはTypeScriptでフロントエンド・バックエンドを統一することを決定した（ADR-0002参照）。次に、クライアント・サーバー間の通信方式を選定する必要がある。

### 要件

- フロント・バック間で型安全な通信
- リアルタイム更新（ログストリーミング、タスク更新通知）
- 開発時の型補完・リファクタリング支援
- 低いボイラープレート

### 検討した選択肢

#### 選択肢1: REST API

**利点:**
- 広く普及した標準
- HTTPキャッシュとの親和性
- ツールが豊富（Postman, curl等）

**欠点:**
- 型定義の重複（OpenAPI + コード生成が必要）
- オーバーフェッチ/アンダーフェッチ
- WebSocketは別途実装が必要
- エンドポイント設計の負担

#### 選択肢2: GraphQL

**利点:**
- 柔軟なクエリ（必要なフィールドのみ取得）
- スキーマ駆動開発
- Subscriptionによるリアルタイム通信
- エコシステムが成熟

**欠点:**
- 学習コストが高い
- スキーマ定義の重複（GraphQLスキーマ + TypeScript型）
- N+1問題への対処（DataLoader）
- 小規模アプリには過剰

#### 選択肢3: tRPC

**利点:**
- TypeScript型がそのままAPIの型になる
- コード生成不要
- Query/Mutation/Subscriptionの統一的なAPI
- React Query統合によるキャッシュ管理
- IDE補完が完全に効く

**欠点:**
- TypeScript専用（他言語クライアントに非対応）
- 外部公開APIには不向き
- RESTほどの知名度がない

## 決定

**tRPCを採用する。**

## 根拠

1. **ゼロコスト型共有**: バックエンドのルーター定義がそのままフロントエンドの型になる。スキーマ定義の重複が完全に排除される。

```typescript
// バックエンド
export const taskRouter = router({
  list: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => { /* ... */ }),
});

// フロントエンド - 型が自動伝播
const { data } = trpc.task.list.useQuery({ projectId: '...' });
// data の型は自動的に Task[] と推論される
```

2. **リファクタリング安全性**: API名やパラメータを変更すると、フロントエンドで即座にコンパイルエラー。

3. **Subscription統合**: WebSocketによるリアルタイム通信が同一APIで提供される。

```typescript
// バックエンド
onLog: publicProcedure
  .input(z.object({ id: z.string() }))
  .subscription(({ input }) => {
    return observable<string>((emit) => { /* ... */ });
  }),

// フロントエンド
trpc.executionProcess.onLog.useSubscription(
  { id: processId },
  { onData: (chunk) => setLogs(prev => prev + chunk) }
);
```

4. **React Query統合**: キャッシュ、楽観的更新、自動再取得などがビルトイン。

5. **個人利用に最適**: 外部公開APIではなく、自分のフロントエンドからのみ呼び出すため、tRPCのTypeScript専用という制約は問題にならない。

6. **Hono統合**: `@hono/trpc-server`により、Honoとシームレスに統合可能。

## 結果

### ポジティブ

- API型定義の重複が完全に排除
- フルスタックでの型安全性
- IDE補完によるDX向上
- リファクタリング時の安心感
- Query/Mutation/Subscriptionの統一的なAPI

### ネガティブ

- 将来的に他言語クライアント（モバイルアプリ等）が必要になった場合、REST APIの追加が必要
- チーム外への知識共有時にtRPCの説明が必要

### 構成

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React)                                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  @trpc/react-query                                   │   │
│  │  - useQuery() / useMutation() / useSubscription()    │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ HTTP (Query/Mutation)            │
│                          │ WebSocket (Subscription)         │
│                          ▼                                  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  Backend (Hono + tRPC)                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  @trpc/server + @hono/trpc-server                    │   │
│  │  - router() / publicProcedure                        │   │
│  │  - Zod validation                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 参考資料

- [tRPC公式ドキュメント](https://trpc.io/)
- [@hono/trpc-server](https://github.com/honojs/middleware/tree/main/packages/trpc-server)
- [tRPC vs REST vs GraphQL](https://trpc.io/docs/concepts)
