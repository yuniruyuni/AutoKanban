# ADR-0005: レイヤードアーキテクチャ採用

## ステータス

採用 (Accepted)

## 日付

2026-02-28

## コンテキスト

Auto Kanbanのバックエンドアーキテクチャを設計する必要がある。TypeScript統一（ADR-0002）のもと、適切なアーキテクチャパターンを選定する。

### 要件

- 責務の明確な分離
- テスト容易性
- 依存関係の一方向性
- 保守性・拡張性
- 個人開発に適したシンプルさ

### 検討した選択肢

#### 選択肢1: クリーンアーキテクチャ

**利点:**
- 依存関係逆転の原則
- ドメイン層の独立性
- 高いテスト容易性

**欠点:**
- 層が多く複雑（Entity, UseCase, Interface Adapters, Frameworks）
- 小規模アプリには過剰
- インターフェース定義のボイラープレート

#### 選択肢2: ヘキサゴナルアーキテクチャ

**利点:**
- Ports and Adaptersによる柔軟性
- 外部依存の差し替えが容易

**欠点:**
- 概念が抽象的で理解コストが高い
- 小規模では過剰な抽象化

#### 選択肢3: シンプルなレイヤードアーキテクチャ（4層）

**利点:**
- 理解しやすい
- 適度な責務分離
- 実装がシンプル

**欠点:**
- 層間の依存が上から下への一方向
- 下位層の変更が上位層に影響する可能性

## 決定

**4層のレイヤードアーキテクチャを採用する。**

```
┌─────────────────────────────────────┐
│        Presentation Layer           │ ← 外部からのリクエスト受信（受動的）
├─────────────────────────────────────┤
│          Usecase Layer              │ ← ビジネスロジック
├─────────────────────────────────────┤
│         Repository Layer            │ ← 外部システム呼び出し（能動的）
├─────────────────────────────────────┤
│           Model Layer               │ ← ドメインモデル（全層で共有）
└─────────────────────────────────────┘
```

## 根拠

1. **シンプルさ**: 4層構造は直感的で理解しやすい。個人開発でも認知負荷が低い。

2. **明確な責務分離**:

| レイヤー | 責務 | 外部との関係 |
|---------|------|-------------|
| Presentation | リクエスト受信、バリデーション、型変換 | 受動的（HTTPリクエスト受信） |
| Usecase | ビジネスロジック実行 | - |
| Repository | DB、Git、コマンド実行等の外部呼び出し | 能動的（外部システム呼び出し） |
| Model | ドメインモデル定義 | - |

3. **Model層を中心としたデータフロー**: 全レイヤー間のデータはModel型で受け渡し。独自DTOの定義を禁止することで、型の増殖を防ぐ。

```
外部 ──(外部型)──▶ Presentation ──(Model)──▶ Usecase
                                               │
                                               ▼
                                          Repository
                                          │        │
                                  (Model) │        │ (DB行/APIレスポンス)
                                          ▼        ▼
                                     Usecase   DB/外部サービス
                                          │
                                  (Model) │
                                          ▼
外部 ◀──(Model)─── Presentation ◀──(Model)─── Usecase
```

4. **テスト容易性**: Repository層をインターフェースで抽象化することで、Usecase層のテストでモックが容易。

5. **1 Model = 1 Repository**: 各Modelに対応するRepositoryが1つ。JOINなど複雑なクエリもRepository内で完結。

## 結果

### ポジティブ

- 責務が明確で保守しやすい
- 新機能追加時のファイル配置が明確
- Usecase層がビジネスロジックの中心
- Repository層のモックによるテストが容易
- Model型による共通言語の強制

### ネガティブ

- 層間の依存が固定（下位層の大きな変更は上位層に影響）
- 小さな機能でも4層すべてに触れる必要がある場合がある

### ディレクトリ構造

```
server/src/
├── presentation/      # Presentation Layer
│   ├── trpc.ts
│   ├── context.ts
│   └── routers/
│       ├── task.ts
│       └── project.ts
│
├── usecases/          # Usecase Layer
│   ├── task/
│   │   ├── create-task.ts
│   │   └── list-tasks.ts
│   └── project/
│
├── repositories/      # Repository Layer
│   ├── sql.ts
│   ├── pagination.ts
│   ├── task-repository.ts
│   └── git-repository.ts
│
└── models/            # Model Layer
    ├── common.ts
    ├── task.ts
    └── project.ts
```

### 依存関係ルール

```
Presentation ──▶ Usecase ──▶ Repository
     │              │            │
     └──────────────┼────────────┘
                    │
                    ▼
                  Model
```

- 上位層は下位層に依存
- Model層は他の層に依存しない
- 同一層内での依存は許可（ただし循環禁止）

## 参考資料

- [レイヤードアーキテクチャ](https://www.oreilly.com/library/view/software-architecture-patterns/9781491971437/ch01.html)
- [ADR-0002: TypeScript統一](./0002-typescript-unification.md)
