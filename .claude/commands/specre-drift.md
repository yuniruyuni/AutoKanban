---
description: Diagnose specre health across the repo — drift, orphans, missing markers, and stale `last_verified` dates.
---

# /specre-drift

specre の全体健全性をスイープする。個別カードではなくリポジトリ全体の drift 検出が目的。

## Procedure

1. **health-check を走らせる**

   ```bash
   bun run check:specre
   ```

   drift / orphan / missing ID / broken link を列挙する。

2. **coverage / status 集計**

   ```bash
   bun run specre:status
   specre coverage
   ```

   `status: draft` のカードの棚卸し、`status: stable` に上げるべきかの判断材料を得る。

3. **マーカー未着の usecase を探す**

   ```bash
   rg -L '@specre' server/src/usecases/
   rg -L '@specre' server/src/models/
   ```

   `-L` = マーカーを含まないファイル。usecase / model で未着のものは仕様カードが抜けている疑い。

4. **stale `last_verified`**

   90 日以上 verify されていないカードをリストアップ。対応するソースに git log で変更が入っていれば優先的にレビュー対象。

5. **orphan**

   `check:specre` が orphan を出したら:
   - 実装が消えたのにカードが残っている → カード削除か archived 化
   - カードに書かれたファイルパスが typo / リネームされた → カード修正

## Output

以下の形式でレポートする（ユーザー確認なしに修正はしない）:

```
### specre health report (YYYY-MM-DD)

#### drift (N 件)
- <card>: <実装との乖離>

#### orphan (N 件)
- <card>: 実装 <file> が見つからない

#### マーカー未着 (N 件)
- <file>: 仕様カード候補 <候補ドメイン>

#### 棚卸し推奨 draft (N 件)
- <card>: <stable に上げられるか / drop するか>

#### stale last_verified (N 件)
- <card>: last_verified=<date>, 関連ソースに <n> commits since

#### 次アクション提案
- 1: …
- 2: …
```

## 参考

- specre CLI 全体: `CLAUDE.md` §specre の典型ワークフロー
- exemplars と構造: `docs/specres/README.md`
