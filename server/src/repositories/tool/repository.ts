import type { Cursor, Page } from "../../models/common";
import type { Tool } from "../../models/tool";

export interface IToolRepository {
	get(spec: Tool.Spec): Promise<Tool | null>;
	list(spec: Tool.Spec, cursor: Cursor<Tool.SortKey>): Promise<Page<Tool>>;
	listAll(): Promise<Tool[]>;
	upsert(tool: Tool): Promise<void>;
	delete(spec: Tool.Spec): Promise<number>;
	/** Execute a shell command. Uses `sh -c` to support PATH-based commands. */
	executeCommand(command: string, cwd?: string): Promise<void>;
}
