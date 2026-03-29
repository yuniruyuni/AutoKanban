import type { Database } from "bun:sqlite";
import type { Project } from "../../../models/project";
import { type ProjectRow, rowToProject } from "./common";

export function listAll(db: Database): Project[] {
	const rows = db
		.query<ProjectRow, []>("SELECT * FROM projects ORDER BY created_at DESC")
		.all();

	return rows.map(rowToProject);
}
