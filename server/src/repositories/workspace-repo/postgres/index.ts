import type { PgDatabase } from "../../../db/pg-client";
import type { Cursor, Page } from "../../../models/common";
import type { WorkspaceRepo } from "../../../models/workspace-repo";
import type { IWorkspaceRepoRepository } from "../repository";
import { del } from "./delete";
import { get } from "./get";
import { list } from "./list";
import { listByWorkspace } from "./listByWorkspace";
import { upsert } from "./upsert";

export class PgWorkspaceRepoRepository implements IWorkspaceRepoRepository {
	constructor(private db: PgDatabase) {}

	async get(spec: WorkspaceRepo.Spec): Promise<WorkspaceRepo | null> {
		return get(this.db, spec);
	}

	async list(
		spec: WorkspaceRepo.Spec,
		cursor: Cursor<WorkspaceRepo.SortKey>,
	): Promise<Page<WorkspaceRepo>> {
		return list(this.db, spec, cursor);
	}

	async listByWorkspace(workspaceId: string): Promise<WorkspaceRepo[]> {
		return listByWorkspace(this.db, workspaceId);
	}

	async upsert(workspaceRepo: WorkspaceRepo): Promise<void> {
		await upsert(this.db, workspaceRepo);
	}

	async delete(spec: WorkspaceRepo.Spec): Promise<number> {
		return del(this.db, spec);
	}
}
