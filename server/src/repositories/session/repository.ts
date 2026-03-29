import type { Cursor, Page } from "../../models/common";
import type { Session } from "../../models/session";

export interface ISessionRepository {
	get(spec: Session.Spec): Promise<Session | null>;
	list(
		spec: Session.Spec,
		cursor: Cursor<Session.SortKey>,
	): Promise<Page<Session>>;
	upsert(session: Session): Promise<void>;
	delete(spec: Session.Spec): Promise<number>;
}
