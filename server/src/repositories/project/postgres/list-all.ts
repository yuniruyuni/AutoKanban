import type { Database } from "../../common";
import type { Project } from "../../../models/project";
import { type ProjectRow, rowToProject } from "./common";

export async function listAll(db: Database): Promise<Project[]> {
	const rows = await db.queryAll<ProjectRow>({
		query: "SELECT * FROM projects ORDER BY created_at DESC",
		params: [],
	});

	return rows.map(rowToProject);
}
