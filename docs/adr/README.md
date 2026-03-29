# Architectural Decision Records (ADR)

このディレクトリには、Auto Kanbanプロジェクトのアーキテクチャに関する重要な決定を記録したADRが含まれています。

## ADRとは

Architectural Decision Record（ADR）は、アーキテクチャ上の重要な決定を文書化したものです。各ADRには以下が含まれます：

- **コンテキスト**: 決定が必要になった背景
- **検討した選択肢**: 比較検討した代替案
- **決定**: 採用した選択肢とその根拠
- **結果**: 決定によるポジティブ/ネガティブな影響

## ADR一覧

| ID | タイトル | ステータス | 日付 |
|----|----------|------------|------|
| [ADR-0001](./0001-database-selection.md) | データベースエンジンの選定 | 廃止 | 2026-02-28 |
| [ADR-0002](./0002-typescript-unification.md) | TypeScript統一（Rust不採用） | 採用 | 2026-02-28 |
| [ADR-0003](./0003-trpc-adoption.md) | tRPC採用（REST/GraphQL不採用） | 採用 | 2026-02-28 |
| [ADR-0004](./0004-raw-sql-adoption.md) | Raw SQL採用（ORM不採用） | 採用 | 2026-02-28 |
| [ADR-0005](./0005-layered-architecture.md) | レイヤードアーキテクチャ採用 | 採用 | 2026-02-28 |
| [ADR-0006](./0006-valtio-adoption.md) | Valtio採用（Zustand不採用） | 採用 | 2026-02-28 |
| [ADR-0007](./0007-step-based-usecase.md) | ステップベースUsecase設計 | 採用 | 2026-02-28 |
| [ADR-0008](./0008-specification-pattern.md) | Specification Pattern採用 | 採用 | 2026-02-28 |
| [ADR-0009](./0009-sqlite-auto-migrator.md) | sqlite-auto-migrator採用 | 廃止 | 2026-02-28 |
| [ADR-0011](./0011-postgresql-migration.md) | PostgreSQL移行 (embedded-postgres + pgschema) | 採用 | 2026-03-29 |

## ステータスの定義

| ステータス | 説明 |
|------------|------|
| 提案 (Proposed) | 検討中、レビュー待ち |
| 採用 (Accepted) | 承認され、実装される/された |
| 非推奨 (Deprecated) | 以前は採用されていたが、現在は推奨されない |
| 却下 (Rejected) | 検討の結果、採用されなかった |
| 置換 (Superseded) | 新しいADRによって置き換えられた |

## 新しいADRの作成

1. 次の連番でファイルを作成: `NNNN-短い説明.md`
2. テンプレートに従って記述
3. 上記の一覧表に追加

## テンプレート

```markdown
# ADR-NNNN: タイトル

## ステータス

提案 (Proposed)

## 日付

YYYY-MM-DD

## コンテキスト

[決定が必要になった背景を説明]

## 決定

[採用した選択肢を明記]

## 根拠

[なぜその決定をしたのかを説明]

## 結果

### ポジティブ

- [良い影響]

### ネガティブ

- [悪い影響や制約]

## 参考資料

- [関連リンク]
```
