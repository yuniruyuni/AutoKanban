import { generateId } from "../../models/common";
import type { PgDatabase } from "../../repositories/common";

/**
 * Seeds default task templates if none exist yet.
 * Called during DB initialization.
 */
export async function seedTaskTemplates(db: PgDatabase): Promise<void> {
	const row = await db.queryGet<{ c: string }>({
		query: "SELECT COUNT(*) as c FROM project_task_templates",
		params: [],
	});
	if (row && Number(row.c) > 0) return;

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

	for (const tmpl of templates) {
		await db.queryRun({
			query: `INSERT INTO project_task_templates (id, title, description, condition, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			params: [
				generateId(),
				tmpl.title,
				tmpl.description,
				tmpl.condition,
				tmpl.sortOrder,
				now,
				now,
			],
		});
	}
}
