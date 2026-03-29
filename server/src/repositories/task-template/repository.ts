import type { Cursor, Page } from "../../models/common";
import type { TaskTemplate } from "../../models/task-template";

export interface ITaskTemplateRepository {
	get(spec: TaskTemplate.Spec): Promise<TaskTemplate | null>;
	list(
		spec: TaskTemplate.Spec,
		cursor: Cursor<TaskTemplate.SortKey>,
	): Promise<Page<TaskTemplate>>;
	listAll(): Promise<TaskTemplate[]>;
	upsert(template: TaskTemplate): Promise<void>;
	delete(spec: TaskTemplate.Spec): Promise<number>;
}
