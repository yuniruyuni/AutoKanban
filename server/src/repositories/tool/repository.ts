import type { Cursor, Page } from "../../models/common";
import type { Tool } from "../../models/tool";
import type { DbReadCtx, DbWriteCtx, ServiceCtx } from "../common";

export interface ToolRepository {
	get(ctx: DbReadCtx, spec: Tool.Spec): Promise<Tool | null>;
	list(
		ctx: DbReadCtx,
		spec: Tool.Spec,
		cursor: Cursor<Tool.SortKey>,
	): Promise<Page<Tool>>;
	listAll(ctx: DbReadCtx): Promise<Tool[]>;
	upsert(ctx: DbWriteCtx, tool: Tool): Promise<void>;
	delete(ctx: DbWriteCtx, spec: Tool.Spec): Promise<number>;
	/** Execute a shell command. Uses `sh -c` to support PATH-based commands. */
	executeCommand(ctx: ServiceCtx, command: string, cwd?: string): Promise<void>;
}
