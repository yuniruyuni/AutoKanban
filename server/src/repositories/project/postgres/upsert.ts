import type { PgDatabase } from "../../../db/pg-client";
import type { Project } from "../../../models/project";
import { dateToSQL } from "../../common";

export async function upsert(db: PgDatabase, project: Project): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO projects (id, name, description, repo_path, branch, setup_script, cleanup_script, dev_server_script, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           repo_path = excluded.repo_path,
           branch = excluded.branch,
           setup_script = excluded.setup_script,
           cleanup_script = excluded.cleanup_script,
           dev_server_script = excluded.dev_server_script,
           updated_at = excluded.updated_at`,
		params: [
			project.id,
			project.name,
			project.description,
			project.repoPath,
			project.branch,
			project.setupScript,
			project.cleanupScript,
			project.devServerScript,
			dateToSQL(project.createdAt),
			dateToSQL(project.updatedAt),
		],
	});
}
