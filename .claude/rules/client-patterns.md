---
paths:
  - client/**
---

# Client Patterns

## コーディング規約

- import: `@/` エイリアス = `client/src/`

## 状態管理

- サーバーデータ: tRPC + React Query
- UIローカル状態: Valtio (`proxy()` + `xxxActions`)

## specre 参照

- Valtio 採用の設計意図と使い方: `docs/specres/architecture/valtio_is_the_client_local_state.md`
- tRPC 全体像: `docs/specres/architecture/trpc_is_the_client_server_protocol.md`
- UI コンポーネント構成: `docs/specres/ui-kanban/` + `docs/specres/ui-settings/` カード群
