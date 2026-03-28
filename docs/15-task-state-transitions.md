# タスク状態遷移

## 概要

Auto Kanbanのタスクは5つの状態を持ち、カンバンボード上のドラッグ&ドロップ、画面内のボタン操作、およびシステムイベントによって状態が遷移する。

このアプリケーションはAIエージェントによるコーディング自動化だけでなく、ユーザーの手動タスク管理にも対応するため、すべての状態間の遷移が許可される。ただし、遷移の方向によって副作用や確認ダイアログの要否が異なる。

---

## 状態一覧

| ステータス | 説明 | UI表示 |
|-----------|------|--------|
| `todo` | 未着手。エージェントがまだ起動されていない | 空のチャットパネル、「Start Agent」ボタン表示 |
| `inprogress` | 作業中。エージェントが稼働中 | チャット有効、「Running」ステータス + Stopボタン表示 |
| `inreview` | レビュー待ち。エージェント完了後、ユーザーがChangesを確認する段階 | 「Completed」ステータス、Stopボタンなし、チャット入力可能（追加指示用） |
| `done` | 完了。マージ済み | 「Completed」ステータス、チャット入力不可（読み取り専用） |
| `cancelled` | キャンセル | 終了状態 |

---

## 状態遷移の種類

状態遷移は3つの経路で発生する。

### 1. システム自動遷移

エージェントプロセスの完了・失敗に伴い、システムが自動的に遷移させる。

| イベント | 遷移 | 説明 |
|---------|------|------|
| Agent正常終了 | inprogress → inreview | プロセスがexit code 0で終了。UIは「Running」→「Completed」に自動変化 |
| Agent異常終了 | inprogress → inreview | プロセスがexit code != 0で終了。エラー情報を表示し、ユーザーが追加指示で修正可能 |

> **設計判断**: Agent失敗時もinreviewに遷移する。プロセスはすでに停止しているためinprogressに留めるのは不正確であり、ユーザーがログを確認して次のアクション（追加指示・やり直し・キャンセル）を選択できるようにする。

### 2. UIアクション遷移

画面内のボタン操作によって発生する遷移。

| アクション | 画面 | 遷移 | 説明 |
|-----------|------|------|------|
| Start Agent | Todo画面の「Start Agent」ボタン | todo → inprogress | エージェント設定ダイアログを表示し、実行開始 |
| Stop | InProgress画面のChatHeaderの「Stop」ボタン | inprogress → inreview | エージェントを手動停止。ユーザーが中断してレビューに入る |
| Send Message | InReview画面のチャット入力で送信 | inreview → inprogress | 前回の続きからエージェントを再開 |
| Merge成功 | InReview画面TopBarの「Merge」ボタン | inreview → done | fast-forwardマージで変更をmainブランチに統合してタスク完了。ff不可時はボタン無効（tooltipで理由表示） |
| Rebase成功 | InReview画面TopBarの「Rebase」ボタン | inreview → inreview | リベース成功。fast-forward可能状態になり、Mergeボタンが有効化される |
| Resolve with Claude | Rebase Conflictダイアログの「Resolve with Claude」ボタン | inreview → inprogress | リベース時のコンフリクト解決のためにエージェントを再起動 |

### 3. カンバンD&D遷移

カンバンボード上のドラッグ&ドロップで任意の状態間を遷移できる。遷移時の副作用と確認ダイアログは遷移の方向によって決まる。

---

## カンバンD&D 全遷移マトリクス

### → todo（初期状態に戻す）

すべての遷移でチャット履歴をリセットし、初期状態に戻す。

| 遷移元 | 副作用 | 確認ダイアログ |
|--------|--------|---------------|
| inprogress → todo | Agent Stop + Chat Reset | 「進行中の作業をリセットしますか？Agentが停止し、チャット履歴が削除されます」 |
| inreview → todo | Chat Reset | 「チャット履歴をリセットして初期状態に戻しますか？」 |
| done → todo | Chat Reset | 「完了したタスクを初期状態に戻しますか？チャット履歴が削除されます」 |
| cancelled → todo | Chat Reset | 「キャンセルしたタスクを復活させますか？チャット履歴が削除されます」 |

### → inprogress（作業開始）

Start Agentダイアログを表示し、「Agent実行開始」または「Agentなしで手動InProgress化」を選択する。

| 遷移元 | 副作用 | 確認ダイアログ |
|--------|--------|---------------|
| todo → inprogress | 選択に応じてAgent開始 or ステータスのみ変更 | Start Agentダイアログ（「Agent実行開始」/「Agentなしで手動開始」） |
| inreview → inprogress（Agent使用タスク） | Agent Resume（前回の続きから再開） | メッセージ入力ダイアログ（次アクションの指示を記入して送信） |
| inreview → inprogress（手動タスク） | ステータスのみ変更 | なし |
| done → inprogress | 選択に応じてAgent開始 or ステータスのみ変更 | Start Agentダイアログ（同上） |
| cancelled → inprogress | 選択に応じてAgent開始 or ステータスのみ変更 | Start Agentダイアログ（同上） |

### → inreview（レビュー状態にする）

| 遷移元 | 副作用 | 確認ダイアログ |
|--------|--------|---------------|
| todo → inreview | なし | なし |
| inprogress → inreview | Agent Stop | 「Agentを停止してレビュー状態にしますか？」 |
| done → inreview | なし | なし |
| cancelled → inreview | なし | なし |

### → done（完了にする）

| 遷移元 | 副作用 | 確認ダイアログ |
|--------|--------|---------------|
| todo → done | なし | なし |
| inprogress → done | Agent Stop | 「Agentを停止して完了にしますか？」 |
| inreview → done | なし | なし |
| cancelled → done | なし | なし |

### → cancelled（キャンセルする）

| 遷移元 | 副作用 | 確認ダイアログ |
|--------|--------|---------------|
| todo → cancelled | なし | なし |
| inprogress → cancelled | Agent Stop | 「Agentを停止してキャンセルしますか？」 |
| inreview → cancelled | なし | なし |
| done → cancelled | なし | なし |

---

## 副作用パターン

### Agent Stop

エージェントプロセスが稼働中の場合にSIGTERMで停止する。inprogressから別状態への遷移時に常に発生する。

### Chat Reset

チャット履歴（セッション、ExecutionProcess）を削除し、タスクを初期状態に戻す。todoへの遷移時に常に発生する。ユーザーに対して破壊的操作であるため、必ず確認ダイアログを表示する。

### Agent Resume

前回のセッションを引き継いでエージェントを再開する。inreview → inprogressの遷移時に、タスクがエージェントを使用している場合に発生する。

D&Dによるinreview → inprogress遷移時の挙動は、タスクの種類によって分岐する:
- **Agent使用タスク**（エージェントによるセッションが存在する場合）: メッセージ入力ダイアログを表示し、次アクションの指示を記入して送信するとエージェントが前回の続きから再開する
- **手動タスク**（エージェントを使わずにinreviewにドラッグされた場合）: 何も問わずにinprogressに戻す

---

## Rebase Conflictダイアログ

ワークツリーでベースブランチからのリベースを実行した際、コンフリクトが検出された場合に表示される。

- **ダイアログ**: 「Rebase Conflicts Detected」
- **コンフリクトファイル一覧**: 警告アイコン付きでファイルパスを表示
- **説明文**: 「Rebase encountered conflicts with the base branch. The following files need to be resolved.」
- **アクション**:
  - Cancel: ダイアログを閉じてリベースを中止（inreviewに留まる）
  - Resolve with Claude: エージェントを再起動してリベースコンフリクト解決を指示（inreview → inprogress）

> **設計判断**: Mergeはfast-forward onlyのためコンフリクトは発生しない。コンフリクトが発生するのはRebase時のみであり、Rebase Conflictダイアログのみが存在する。

---

## マージワークフロー（fast-forward only）

InReview画面のTopBarには「Merge」と「Rebase」の2つのボタンがある。マージはfast-forwardのみ許可するルールを採用する。

### 原則

- **Mergeボタンはfast-forward可能な場合のみ有効**。ベースブランチ（main）の最新コミットがタスクブランチの祖先である場合にのみ、fast-forwardマージが可能
- **fast-forward不可の場合、Mergeボタンは無効化**（opacity 0.4、クリック不可）され、tooltipで「Fast-forward not possible. Rebase first.」等の理由を表示する。Rebaseボタンがアクセントカラーで強調表示される
- これにより、mainブランチに対して常にクリーンな線形履歴を維持する

### フロー

```
1. InReview画面表示時
   └── ベースブランチとの差分を検査
   └── fast-forward可能かどうかを判定

2a. fast-forward可能な場合
    └── Mergeボタン: 有効（通常表示）
    └── Rebaseボタン: 通常表示（Secondary）
    └── ユーザーがMergeを押す → fast-forwardマージ実行 → done

2b. fast-forward不可の場合
    └── Mergeボタン: 無効（opacity 0.4、tooltip: "Fast-forward not possible. Rebase first."）
    └── Rebaseボタン: 強調表示（アクセントカラー）
    └── ユーザーがRebaseを押す:
        ├── コンフリクトなし → Rebase成功 → ff可能になる → 2aへ
        └── コンフリクトあり → Rebase Conflictダイアログ表示
            ├── Cancel → inreviewに留まる
            └── Resolve with Claude → inprogress（エージェント再起動）
```

### UI状態

| 状態 | Mergeボタン | Rebaseボタン |
|------|------------|-------------|
| fast-forward可能 | 有効（Secondary） | 通常（Secondary） |
| fast-forward不可 | 無効（opacity 0.4） | 強調（アクセントカラー、Primary） |

> **設計判断**: fast-forward onlyルールにより、mainブランチの履歴が常に線形に保たれる。ベースブランチが先に進んだ場合、マージではなくリベースを要求することで、コンフリクトの早期検出と解決を促す。

---

## 確認ダイアログの原則

- **破壊的操作（Agent Stop, Chat Reset）** を伴う遷移では確認ダイアログを表示する
- **副作用のない純粋なステータス変更** ではダイアログを表示しない
- **UIアクション（ボタン操作）** による遷移は、ボタンを押す行為自体が意図表明であるため、追加の確認は最小限にする

---

## 状態遷移図

```
                                ┌─────────────┐
              Start Agent /     │             │  D&D (Agent Resume)
         D&D (Start Dialog) ──▶│ inprogress  │◀────────────────────┐
                                │             │                     │
                                └──────┬──────┘                     │
                                       │                            │
                           Agent Complete /                         │
                           Agent Fail /                Send Message │
                           Stop Button /         Resolve w/ Claude (Rebase)
                           D&D (Agent Stop)
                                       │                            │
                                       ▼                            │
  ┌──────┐                      ┌─────────────┐  Merge (ff)  ┌────┴──────┐
  │ todo │                      │  inreview   │─────────────▶│   done    │
  └──┬───┘                      └──────┬──────┘              └───────────┘
     │                                 │  ▲
     │   ◀── D&D (Chat Reset) ────────┘  │ Rebase (no conflict)
     │          (from any state)          │
     │                          ┌─────────────┐
     └── D&D ──────────────────▶│  cancelled  │◀── D&D (from any state)
                                └─────────────┘

  ※ D&D = カンバンボードのドラッグ&ドロップ
  ※ すべての状態間のD&D遷移が可能（上図は主要フローのみ表示）
  ※ Merge = fast-forward only。ff不可時はRebase必須
```

---

## コード上の遷移定義

```typescript
// server/src/models/task.ts
const transitions: Record<Status, Status[]> = {
  todo:       ['inprogress', 'inreview', 'done', 'cancelled'],
  inprogress: ['todo', 'inreview', 'done', 'cancelled'],
  inreview:   ['todo', 'inprogress', 'done', 'cancelled'],
  done:       ['todo', 'inprogress', 'inreview', 'cancelled'],
  cancelled:  ['todo', 'inprogress', 'inreview', 'done'],
};
```

すべての状態間の遷移が許可される。遷移の妥当性チェックよりも、遷移時の副作用の適切な実行と確認ダイアログの表示がアプリケーション層の責務となる。

---

## 関連ドキュメント

- [07-core-features.md](./07-core-features.md) — ワークスペース管理、エージェント実行、プロセス管理
- [03-database.md](./03-database.md) — tasksテーブルのスキーマ定義
- [14-chat-interface.md](./14-chat-interface.md) — チャットインターフェース
- デザインファイル: `docs/auto-kanban.pen` — 各状態の画面デザイン
