import type { Database } from "bun:sqlite";
import type { Cursor, Page } from "../../../models/common";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import type { IWorkspaceRepoRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listByWorkspace } from "./listByWorkspace";
import { upsert } from "./upsert";

export class WorkspaceRepoRepository implements IWorkspaceRepoRepository {
	constructor(private db: Database) {}

	get(spec: WorkspaceRepo.Spec): WorkspaceRepo | null {
		return get(this.db, spec);
	}

	list(
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Page<WorkspaceRepo> {
		return list(this.db, spec, cursor);
	}

	listByWorkspace(workspaceId: string): WorkspaceRepo[] {
		return listByWorkspace(this.db, workspaceId);
	}

	upsert(workspaceRepo: WorkspaceRepo): void {
		upsert(this.db, workspaceRepo);
	}

	delete(spec: WorkspaceRepo.Spec): number {
		return del(this.db, spec);
	}
}
