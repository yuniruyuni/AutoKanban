---
paths:
  - server/**/*.test.ts
  - client/**/*.test.ts
  - client/**/*.test.tsx
---

# テスト方針

- **Model/Repository**: 実DB(`:memory:`)でテスト
- **Usecase**: Repositoryモックでテスト
- **Presentation**: 薄いので優先度低
- テストファイルはソースと同一ディレクトリに配置（`task.ts` → `task.test.ts`）

## docs参照

- 詳細: `docs/09-testing.md` を参照
