import type { Cursor, Page } from "../../models/common";
import type { Tool } from "../../models/tool";

export interface IToolRepository {
	get(spec: Tool.Spec): Tool | null;
	list(spec: Tool.Spec, cursor: Cursor<Tool.SortKey>): Page<Tool>;
	listAll(): Tool[];
	upsert(tool: Tool): void;
	delete(spec: Tool.Spec): number;
	/** Execute a shell command. Uses `sh -c` to support PATH-based commands. */
	executeCommand(command: string, cwd?: string): void;
}
