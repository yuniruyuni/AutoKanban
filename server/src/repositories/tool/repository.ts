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
	/**
	 * Spawn a process from an explicit argv vector (no shell).
	 * Path lookup for argv[0] is done by the OS (execvp semantics), so
	 * PATH-based binaries like `code`, `cursor` work without `sh -c`.
	 * Callers that need shell semantics must wrap explicitly:
	 *   executeCommand(ctx, ["sh", "-c", shellCommand], cwd)
	 */
	executeCommand(ctx: ServiceCtx, argv: string[], cwd?: string): Promise<void>;
}
