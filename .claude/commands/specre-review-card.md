---
description: Review an existing specre card against the current implementation — catch drift, weak "why", missing scenarios, and outdated file references.
---

# /specre-review-card

既存の specre カードを実装と突き合わせてレビューする。drift / 希薄な設計意図 / シナリオ不足 / リンク切れを洗い出す。

## Arguments

- `$ARGUMENTS` — カードの相対パス（例: `docs/specres/task/task_is_created_in_todo.md`）または ULID 1 つ。

## Procedure

1. **カードを読む** — frontmatter (`id`, `status`, `last_verified`) と全セクションを読む
2. **関連ファイルを全部開く** — `## 関連ファイル` に挙がっているパスを Read。ファイル不在 / 関数名不一致は drift
3. **実装から逆引き** — `specre trace <card-path>` と `rg '@specre <ULID>'` で、マーカーが張られている実際の実装を確認。マーカー不在なら「どこに付けるべきか」を提案
4. **セクションごとの質疑**:
   - `機能概要`: コードの現実と合っているか？`upsert` と言いながら `INSERT` のみなど
   - `設計意図`: **why** が書かれているか？「〜する」だけで理由が無いなら弱い
   - `シナリオ`: コードの分岐を全部カバーしているか？fail コードと 1:1 対応するか
   - `失敗 / 例外`: fail() の呼び出し箇所と fail コードが一致するか
5. **相互リンクチェック** — 関連する動作 / 概念カードへのリンクが双方向か
6. **last_verified** — 内容に変更が無くても、レビューで OK なら今日の日付に更新する提案

## Output

レビュー結果を以下のフォーマットで返す:

```
### <card name> レビュー結果

#### 合っている点
- …

#### drift / 要修正
- <section>: <具体的な乖離> (実装: <file>:<line>)

#### 追記推奨
- <section>: <何を足すべきか、なぜ>

#### マーカー状況
- 既存: <file>:<line> (関数名)
- 未着: <file> の <function> に付けるべき

#### 提案コミットメッセージ
docs(specre): <short>
```

ユーザー確認なしに編集はしないこと。レビュー結果を読んでもらってから修正 PR を切る。

## 参考

- カード全体の規約: `docs/specres/README.md`
- drift / orphan チェック: `bun run check:specre`
