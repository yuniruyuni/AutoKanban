import type { Cursor, Page } from "../../models/common";
import type { TaskTemplate } from "../../models/task-template";

export interface ITaskTemplateRepository {
	get(spec: TaskTemplate.Spec): TaskTemplate | null;
	list(
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Page<TaskTemplate>;
	listAll(): TaskTemplate[];
	upsert(template: TaskTemplate): void;
	delete(spec: TaskTemplate.Spec): number;
}
