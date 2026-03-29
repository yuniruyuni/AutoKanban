import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { Session } from "../../../models/session";
import type { ISessionRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { upsert } from "./upsert";

export class SessionRepository implements ISessionRepository {
	constructor(private db: Database) {}

	get(spec: Session.Spec): Session | null {
		return get(this.db, spec);
	}

	list(spec: Session.Spec, cursor: Cursor<Session.SortKey>): Page<Session> {
		return list(this.db, spec, cursor);
	}

	upsert(session: Session): void {
		upsert(this.db, session);
	}

	delete(spec: Session.Spec): number {
		return del(this.db, spec);
	}
}
