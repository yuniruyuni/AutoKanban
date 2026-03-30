import type { Cursor, Page } from "../../models/common";
import type { Session } from "../../models/session";
import type { DbReadCtx, DbWriteCtx } from "../../types/db-capability";

export interface SessionRepository {
	get(ctx: DbReadCtx, spec: Session.Spec): Promise<Session | null>;
	list(
		ctx: DbReadCtx,
		spec: Session.Spec,
		cursor: Cursor<Session.SortKey>,
	): Promise<Page<Session>>;
	upsert(ctx: DbWriteCtx, session: Session): Promise<void>;
	delete(ctx: DbWriteCtx, spec: Session.Spec): Promise<number>;
}
