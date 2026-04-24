// @specre 01KPNSJ3RA08KSRZFYJ61HG2AB
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { DevServerProcess } from "../../models/dev-server-process";
import type { SSEDeltaResult, SSEEvent } from "../../models/sse";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
import type { ReadContext } from "../context";
import { usecase } from "../runner";

// ============================================
// State tracked between delta calls
// ============================================

export interface LogStreamState {
	/** Character offset into the raw logs — next delta starts here */
	offset: number;
	/**
	 * True once the stream has emitted its terminal "done" event. Further
	 * delta calls become no-ops so the SSE loop can idle cheaply until the
	 * client (who received "done") closes its EventSource and aborts the
	 * connection.
	 */
	isDone: boolean;
}

// ============================================
// Params (extracted from route)
// ============================================

export interface LogStreamParams {
	executionProcessId: string;
}

// Superset of the statuses used by the three process tables. CodingAgentProcess
// additionally has "awaiting_approval", which is non-terminal so it behaves
// exactly like "running" for streaming purposes.
type ProcessStatus =
	| "running"
	| "awaiting_approval"
	| "completed"
	| "failed"
	| "killed";

interface ProcessSnapshot {
	status: ProcessStatus;
	exitCode: number | null;
}

/**
 * Resolve logs for an execution process by trying each of the three logs
 * tables in turn. The process-id space is unique across tables (ULIDs), so
 * whichever returns non-null is the authoritative source. Coding-agent is
 * tried first because it is the overwhelmingly common case.
 */
async function loadLogsFromAnySource(
	ctx: ReadContext,
	executionProcessId: string,
): Promise<{ logs: string } | null> {
	const coding =
		await ctx.repos.codingAgentProcessLogs.getLogs(executionProcessId);
	if (coding) return { logs: coding.logs };

	const dev = await ctx.repos.devServerProcessLogs.getLogs(executionProcessId);
	if (dev) return { logs: dev.logs };

	const script =
		await ctx.repos.workspaceScriptProcessLogs.getLogs(executionProcessId);
	if (script) return { logs: script.logs };

	return null;
}

/**
 * Look up the process status across the three process tables. Used to know
 * when to stop streaming: a terminal status means no more log chunks will
 * arrive, so we can emit "done" and let the client close the SSE.
 */
async function loadProcessStatus(
	ctx: ReadContext,
	executionProcessId: string,
): Promise<ProcessSnapshot | null> {
	const coding = await ctx.repos.codingAgentProcess.get(
		CodingAgentProcess.ById(executionProcessId),
	);
	if (coding) return { status: coding.status, exitCode: coding.exitCode };

	const dev = await ctx.repos.devServerProcess.get(
		DevServerProcess.ById(executionProcessId),
	);
	if (dev) return { status: dev.status, exitCode: dev.exitCode };

	const script = await ctx.repos.workspaceScriptProcess.get(
		WorkspaceScriptProcess.ById(executionProcessId),
	);
	if (script) return { status: script.status, exitCode: script.exitCode };

	return null;
}

function isTerminal(status: ProcessStatus | undefined): boolean {
	return status === "completed" || status === "failed" || status === "killed";
}

function doneEvent(snapshot: ProcessSnapshot | null): SSEEvent {
	return {
		type: "done",
		data: {
			status: snapshot?.status ?? "completed",
			exitCode: snapshot?.exitCode ?? null,
		},
	};
}

// ============================================
// Snapshot usecase
// ============================================

export const getLogStreamSnapshot = (params: LogStreamParams) =>
	usecase({
		read: async (ctx) => {
			const logs = await loadLogsFromAnySource(ctx, params.executionProcessId);
			const status = await loadProcessStatus(ctx, params.executionProcessId);
			return { logs, status };
		},

		process: (_ctx, { logs, status }): SSEDeltaResult<LogStreamState> => {
			const terminal = isTerminal(status?.status);
			const content = logs?.logs ?? "";
			const events: SSEEvent[] = [];
			if (content.length > 0) events.push({ type: "log", data: content });
			if (terminal) events.push(doneEvent(status));
			return {
				events,
				state: { offset: content.length, isDone: terminal },
			};
		},
	});

// ============================================
// Delta usecase
// ============================================

export const getLogStreamDelta = (
	params: LogStreamParams,
	state: LogStreamState,
) =>
	usecase({
		read: async (ctx) => {
			// Once we have already emitted `done`, skip status probing — the
			// client should be closing the connection and we do not need to
			// do further work.
			if (state.isDone) {
				const logs = await loadLogsFromAnySource(
					ctx,
					params.executionProcessId,
				);
				return { logs, status: null };
			}
			const logs = await loadLogsFromAnySource(ctx, params.executionProcessId);
			const status = await loadProcessStatus(ctx, params.executionProcessId);
			return { logs, status };
		},

		process: (_ctx, { logs, status }): SSEDeltaResult<LogStreamState> => {
			if (state.isDone) {
				return { events: [], state };
			}

			const content = logs?.logs ?? "";
			const hasNew = content.length > state.offset;
			const newContent = hasNew ? content.slice(state.offset) : "";
			const nextOffset = hasNew ? content.length : state.offset;

			const events: SSEEvent[] = [];
			if (hasNew) events.push({ type: "log", data: newContent });

			// Emit `done` only once we are caught up AND the process has
			// reached a terminal status. If new chunks arrived this tick we
			// defer the `done` to the next poll so the client never sees a
			// `done` before the log events that precede it.
			const terminal = isTerminal(status?.status);
			const emitDone = terminal && !hasNew;
			if (emitDone) events.push(doneEvent(status));

			return {
				events,
				state: { offset: nextOffset, isDone: emitDone },
			};
		},
	});
