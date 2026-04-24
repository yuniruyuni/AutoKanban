import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolve AutoKanban's state directory.
 *
 * Defaults to `~/.auto-kanban` for the usual single-instance user experience,
 * but can be overridden via the `AUTO_KANBAN_HOME` env var so a spawned child
 * AutoKanban (e.g. when previewing the AutoKanban project itself) can run
 * with a fully isolated DB / ports / pgschema binary / worktree pool without
 * stomping on the parent's state. The isolation is opt-in: the child's
 * project-provided `auto-kanban.json` scripts set `AUTO_KANBAN_HOME` using
 * the `AK_PROCESS_ID` env handed down by the parent.
 */
export function getAutoKanbanHome(): string {
	return process.env.AUTO_KANBAN_HOME ?? join(homedir(), ".auto-kanban");
}
