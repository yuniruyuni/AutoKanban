import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { Workspace } from "../../../models/workspace";
import type { IWorkspaceRepository } from "../repository";
import { del } from "./delete";
import { findByWorktreePath } from "./find-by-worktree-path";
import { get } from "./get";
import { getMaxAttempt } from "./get-max-attempt";
import { list } from "./list";
import { upsert } from "./upsert";

export class WorkspaceRepository implements IWorkspaceRepository {
	constructor(private db: Database) {}

	get(spec: Workspace.Spec): Workspace | null {
		return get(this.db, spec);
	}

	list(
		spec: Workspace.Spec,
		cursor: Cursor<Workspace.SortKey>,
	): Page<Workspace> {
		return list(this.db, spec, cursor);
	}

	findByWorktreePath(worktreePath: string): Workspace | null {
		return findByWorktreePath(this.db, worktreePath);
	}

	getMaxAttempt(taskId: string): number {
		return getMaxAttempt(this.db, taskId);
	}

	upsert(workspace: Workspace): void {
		upsert(this.db, workspace);
	}

	delete(spec: Workspace.Spec): number {
		return del(this.db, spec);
	}
}
