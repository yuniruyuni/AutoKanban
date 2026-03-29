import type { Database } from "bun:sqlite";
import type { ProjectWithStats } from "../../../models/project";
import {
	type ProjectWithStatsRow,
	rowToProjectWithStats,
} from "./common";

export function getWithStats(
	db: Database,
	projectId: string,
): ProjectWithStats | null {
	const row = db
		.query<ProjectWithStatsRow, [string]>(`
        SELECT
          p.*,
          COALESCE(SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END), 0) as todo_count,
          COALESCE(SUM(CASE WHEN t.status = 'inprogress' THEN 1 ELSE 0 END), 0) as inprogress_count,
          COALESCE(SUM(CASE WHEN t.status = 'inreview' THEN 1 ELSE 0 END), 0) as inreview_count,
          COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) as done_count,
          COALESCE(SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.id = ?
        GROUP BY p.id
      `)
		.get(projectId);

	return row ? rowToProjectWithStats(row) : null;
}
