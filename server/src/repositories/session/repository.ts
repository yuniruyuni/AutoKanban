import type { Cursor, Page } from "../../models/common";
import type { Session } from "../../models/session";

export interface ISessionRepository {
	get(spec: Session.Spec): Session | null;
	list(spec: Session.Spec, cursor: Cursor<Session.SortKey>): Page<Session>;
	upsert(session: Session): void;
	delete(spec: Session.Spec): number;
}
