import type { Cursor, Page } from "../../../models/common";
import type { Session } from "../../../models/session";
import type { DbReadCtx, DbWriteCtx } from "../../../types/db-capability";
import type { SessionRepository as ISessionRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class SessionRepository implements ISessionRepository {
	async get(ctx: DbReadCtx, spec: Session.Spec): Promise<Session | null> {
		return get(ctx.db, spec);
	}

	async list(
		ctx: DbReadCtx,
		spec: Session.Spec,
		cursor: Cursor<Session.SortKey>,
	): Promise<Page<Session>> {
		return list(ctx.db, spec, cursor);
	}

	async upsert(ctx: DbWriteCtx, session: Session): Promise<void> {
		return upsert(ctx.db, session);
	}

	async delete(ctx: DbWriteCtx, spec: Session.Spec): Promise<number> {
		return del(ctx.db, spec);
	}
}
