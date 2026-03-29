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

	async get(spec: Session.Spec): Promise<Session | null> {
		return get(this.db, spec);
	}

	async list(
		spec: Session.Spec,
		cursor: Cursor<Session.SortKey>,
	): Promise<Page<Session>> {
		return list(this.db, spec, cursor);
	}

	async upsert(session: Session): Promise<void> {
		upsert(this.db, session);
	}

	async delete(spec: Session.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
