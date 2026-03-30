import type { Database } from "../../common";
import type { Project } from "../../../models/project";
import { dateToSQL } from "../../common";

export async function upsert(db: Database, project: Project): Promise<void> {
	await db.queryRun({
		query: `INSERT INTO projects (id, name, description, repo_path, branch, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           repo_path = excluded.repo_path,
           branch = excluded.branch,
           updated_at = excluded.updated_at`,
		params: [
			project.id,
			project.name,
			project.description,
			project.repoPath,
			project.branch,
			dateToSQL(project.createdAt),
			dateToSQL(project.updatedAt),
		],
	});
}
