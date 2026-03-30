---
paths:
  - server/**/*.test.ts
  - client/**/*.test.ts
  - client/**/*.test.tsx
---

# テスト方針

- **Model/Repository**: 実DB（embedded-postgres、共有インスタンス）でテスト。テスト間はTRUNCATEでデータクリア
- **Usecase**: Repositoryモックでテスト
- **Presentation**: 薄いので優先度低
- テストファイルはソースと同一ディレクトリに配置（例: `xxx/postgres/index.test.ts`）
- Repository テストでは `DbReadCtx`/`DbWriteCtx` を `createDbReadCtx(db)`/`createDbWriteCtx(db)` で生成して使用
- E2Eテスト（実際のclaude-code CLIを起動するもの）は `describe.skip` にしておく（手動実行時のみ `.skip` を外す）

## docs参照

- 詳細: `docs/09-testing.md` を参照
