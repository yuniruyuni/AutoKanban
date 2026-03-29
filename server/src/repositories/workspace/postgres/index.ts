import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import type { Workspace } from "../../../models/workspace";
import type { IWorkspaceRepository } from "../repository";
import { del } from "./delete";
import { findByWorktreePath } from "./find-by-worktree-path";
import { get } from "./get";
import { getMaxAttempt } from "./get-max-attempt";
import { list } from "./list";
import { upsert } from "./upsert";

export class PgWorkspaceRepository implements IWorkspaceRepository {
	constructor(private db: PgDatabase) {}

	async get(spec: Workspace.Spec): Promise<Workspace | null> {
		return get(this.db, spec);
	}

	async list(
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Promise<Page<Workspace>> {
		return list(this.db, spec, cursor);
	}

	async findByWorktreePath(worktreePath: string): Promise<Workspace | null> {
		return findByWorktreePath(this.db, worktreePath);
	}

	async getMaxAttempt(taskId: string): Promise<number> {
		return getMaxAttempt(this.db, taskId);
	}

	async upsert(workspace: Workspace): Promise<void> {
		return upsert(this.db, workspace);
	}

	async delete(spec: Workspace.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
