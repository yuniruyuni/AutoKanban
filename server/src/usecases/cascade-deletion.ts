import { Approval } from "../models/approval";
import { CodingAgentProcess } from "../models/coding-agent-process";
import { CodingAgentTurn } from "../models/coding-agent-turn";
import { DevServerProcess } from "../models/dev-server-process";
import { Session } from "../models/session";
import { WorkspaceRepo } from "../models/workspace-repo";
import { WorkspaceScriptProcess } from "../models/workspace-script-process";
import type { WriteContext } from "./context";

export interface CascadeIds {
	codingAgentProcessIds: string[];
	devServerProcessIds: string[];
	workspaceScriptProcessIds: string[];
	sessionIds: string[];
	workspaceIds: string[];
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
