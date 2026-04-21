---
description: Author a new specre behavior card for a usecase or feature being added, and wire up the `// @specre <ULID>` markers in the implementation.
---

# /specre-new-usecase

新しい Usecase / 機能を追加する PR で、specre カードと実装マーカーを同じコミット内で揃えるための手順。

## Arguments

- `$ARGUMENTS` — 追加しようとしている usecase / 機能の短い説明（自由記述）。未指定なら対話で聞き返す。

## Preflight

1. **該当ドメインを特定** — `docs/specres/` 配下のどのドメイン（`task/`, `workspace/`, `execution/`, `callback/`, `ui-kanban/`, …）に属するか。該当なしなら新設していい理由を明示すること。
2. **重複チェック** — `specre search` と `rg -l <keyword> docs/specres/` で既存カードが無いか確認。既存があれば拡張で済ませる判断もあり。
3. **ファイル命名** — `<subject>_<verb>_<qualifier>.md` の snake_case。振る舞いカードは動詞始まりではなく「主語 is / does …」のスネーク形。

## Card authoring

`specre new docs/specres/<domain> --name <subject_verb>` で雛形を生成し、以下を最低限埋める。

- `## 関連ファイル` — 対応する実装ファイル（model / repo / usecase / presentation / client を漏らさない）
- `## 機能概要` — 1-2 段落で「何をする振る舞いか」を端的に
- `## 設計意図` — **なぜ** この形にしたか。代替案を却下した理由を含める
- `## シナリオ` — 主要ケース（成功 / 失敗）を番号付き手順で。見出しは日本語
- `## 失敗 / 例外` — fail コード（`NOT_FOUND`, `WORKTREE_ERROR` など）と発生条件
- 必要に応じて `## 概念的背景` — ドメインモデル上の位置付けが新規なら書く
- 相互参照 `## 関連する動作` — マトリクスカード・概念カードへのリンク

概念側の強化（新しい ubiquitous language を導入する場合）は `xxx_is_yyy.md` 形式の概念カードを別に作る。

## Source markers

実装の **export 関数 / tRPC procedure の直上** に `// @specre <ULID>` を付ける。

- ULID はカード frontmatter の `id` をそのままコピー
- 関数 1 つに複数カードが紐づく場合はコンマ区切り（`// @specre 01ABC, 01DEF`）
- マーカーを付けた後 `bun run specre:index` を走らせて drift を 0 にしてから commit

## Verification checklist

実装と specre を同じコミットに含める前に:

- [ ] `bun run specre:index` 実行済み（index.json / _INDEX.md が最新）
- [ ] `bun run check:specre` が green
- [ ] `bun run check` 全体が green
- [ ] カード内のファイルパスが実在する（typo がない）
- [ ] 関連カードに相互リンクが張られている

## 参考

- specre 全体の方針: `CLAUDE.md` §仕様の Single Source of Truth
- カードの構造と詳細規約: `docs/specres/README.md`
- 優良な例示カード (exemplar): `docs/specres/README.md` の exemplars セクション
