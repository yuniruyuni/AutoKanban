import type { Database } from "bun:sqlite";
import type { ProjectWithStats } from "../../../models/project";
import { type ProjectWithStatsRow, rowToProjectWithStats } from "./common";

export function listAllWithStats(db: Database): ProjectWithStats[] {
	const rows = db
		.query<ProjectWithStatsRow, []>(`
        SELECT
          p.*,
          COALESCE(SUM(CASE WHEN t.status = 'todo' THEN 1 ELSE 0 END), 0) as todo_count,
          COALESCE(SUM(CASE WHEN t.status = 'inprogress' THEN 1 ELSE 0 END), 0) as inprogress_count,
          COALESCE(SUM(CASE WHEN t.status = 'inreview' THEN 1 ELSE 0 END), 0) as inreview_count,
          COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) as done_count,
          COALESCE(SUM(CASE WHEN t.status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `)
		.all();

	return rows.map(rowToProjectWithStats);
}
