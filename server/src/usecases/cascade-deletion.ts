// Re-export models used in executeCascadeDeletion (avoid unused-import after extraction)
import { Approval } from "../models/approval";
import { CodingAgentProcess } from "../models/coding-agent-process";
import { CodingAgentTurn } from "../models/coding-agent-turn";
import { DevServerProcess } from "../models/dev-server-process";
import { Session } from "../models/session";
import type { Workspace } from "../models/workspace";
import { WorkspaceRepo } from "../models/workspace-repo";
import { WorkspaceScriptProcess } from "../models/workspace-script-process";
import type { ReadContext, WriteContext } from "./context";

export interface CascadeIds {
	codingAgentProcessIds: string[];
	devServerProcessIds: string[];
	workspaceScriptProcessIds: string[];
	sessionIds: string[];
	workspaceIds: string[];
}

/**
 * Collect all entity IDs that need cascade deletion from a list of workspaces.
 * Traverses workspace → sessions → processes (3 types) hierarchy.
 * Shared by delete-task and delete-project read steps.
 */
export async function collectCascadeIds(
	ctx: ReadContext,
	workspaces: Workspace[],
): Promise<CascadeIds> {
	const workspaceIds: string[] = [];
	const sessionIds: string[] = [];
	const codingAgentProcessIds: string[] = [];
	const devServerProcessIds: string[] = [];
	const workspaceScriptProcessIds: string[] = [];

	for (const ws of workspaces) {
		workspaceIds.push(ws.id);
		const sessions = await ctx.repos.session.list(
			Session.ByWorkspaceId(ws.id),
			{ limit: 10000 },
		);
		for (const session of sessions.items) {
			sessionIds.push(session.id);

			const caProcesses = await ctx.repos.codingAgentProcess.list(
				CodingAgentProcess.BySessionId(session.id),
				{ limit: 10000 },
			);
			for (const proc of caProcesses.items) {
				codingAgentProcessIds.push(proc.id);
			}

			const dsProcesses = await ctx.repos.devServerProcess.list(
				DevServerProcess.BySessionId(session.id),
				{ limit: 10000 },
			);
			for (const proc of dsProcesses.items) {
				devServerProcessIds.push(proc.id);
			}

			const wsProcesses = await ctx.repos.workspaceScriptProcess.list(
				WorkspaceScriptProcess.BySessionId(session.id),
				{ limit: 10000 },
			);
			for (const proc of wsProcesses.items) {
				workspaceScriptProcessIds.push(proc.id);
			}
		}
	}

	return {
		workspaceIds,
		sessionIds,
		codingAgentProcessIds,
		devServerProcessIds,
		workspaceScriptProcessIds,
	};
}

/**
 * Delete dependent entities in reverse dependency order.
 * Shared by delete-task and delete-project write steps.
 *
 * Deletion order:
 * 1. approvals, turns, logs (depend on coding_agent_processes)
 * 1b. dev server process logs
 * 1c. workspace script process logs
 * 2. processes (depend on sessions)
 * 3. sessions (depend on workspaces)
 * 4. workspace_repos (depend on workspaces)
 */
export async function executeCascadeDeletion(
	ctx: WriteContext,
	ids: CascadeIds,
): Promise<void> {
	// 1. approvals & coding_agent_turns & logs (depend on coding_agent_processes)
	for (const epId of ids.codingAgentProcessIds) {
		await ctx.repos.approval.delete(Approval.ByExecutionProcessId(epId));
		await ctx.repos.codingAgentTurn.delete(
			CodingAgentTurn.ByExecutionProcessId(epId),
		);
		await ctx.repos.codingAgentProcessLogs.deleteLogs(epId);
	}

	// 1b. dev server process logs
	for (const epId of ids.devServerProcessIds) {
		await ctx.repos.devServerProcessLogs.deleteLogs(epId);
	}

	// 1c. workspace script process logs
	for (const epId of ids.workspaceScriptProcessIds) {
		await ctx.repos.workspaceScriptProcessLogs.deleteLogs(epId);
	}

	// 2. processes (depend on sessions)
	for (const sessionId of ids.sessionIds) {
		await ctx.repos.codingAgentProcess.delete(
			CodingAgentProcess.BySessionId(sessionId),
		);
		await ctx.repos.devServerProcess.delete(
			DevServerProcess.BySessionId(sessionId),
		);
		await ctx.repos.workspaceScriptProcess.delete(
			WorkspaceScriptProcess.BySessionId(sessionId),
		);
	}

	// 3. sessions (depend on workspaces)
	for (const wsId of ids.workspaceIds) {
		await ctx.repos.session.delete(Session.ByWorkspaceId(wsId));
	}

	// 4. workspace_repos (depend on workspaces)
	for (const wsId of ids.workspaceIds) {
		await ctx.repos.workspaceRepo.delete(WorkspaceRepo.ByWorkspaceId(wsId));
	}
}
