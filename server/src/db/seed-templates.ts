import type { Database } from "bun:sqlite";
import { generateId } from "../models/common";

/**
 * Seeds default task templates if none exist yet.
 * Called during DB initialization.
 */
export async function seedTaskTemplates(db: Database): Promise<void> {
	const row = db
		.query<{ c: number }, []>(
			"SELECT COUNT(*) as c FROM project_task_templates",
		)
		.get();
	if (row && row.c > 0) return;

	const now = new Date().toISOString();
	const templates = [
		{
			title: "devServerScriptを調査・設定する",
			description:
				"プロジェクトの開発サーバー起動コマンドを調査し、プロジェクト設定のdevServerScriptに登録してください。",
			condition: "no_dev_server",
			sortOrder: 0,
		},
	];

	const stmt = db.query(
		`INSERT INTO project_task_templates (id, title, description, condition, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	);

	for (const tmpl of templates) {
		stmt.run(
			generateId(),
			tmpl.title,
			tmpl.description,
			tmpl.condition,
			tmpl.sortOrder,
			now,
			now,
		);
	}
}
