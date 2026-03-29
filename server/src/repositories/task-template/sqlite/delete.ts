import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { TaskTemplate } from "../../../models/task-template";
import { compToSQL } from "../../common";
import type { SQLFragment } from "../../sql";
import { taskTemplateSpecToSQL } from "./common";

export function del(db: Database, spec: TaskTemplate.Spec): number {
	const where = compToSQL(
		spec,
		taskTemplateSpecToSQL as (s: unknown) => SQLFragment,
	);
	const result = db
		.query<{ changes: number }, SQLQueryBindings[]>(
			`DELETE FROM project_task_templates WHERE ${where.query}`,
		)
		.run(...(where.params as SQLQueryBindings[]));

	return result.changes;
}
