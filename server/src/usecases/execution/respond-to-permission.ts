import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Session } from "../../models/session";
import { usecase } from "../runner";

// ============================================
// Respond to Permission Request
// ============================================

export interface RespondToPermissionInput {
	sessionId: string;
	requestId: string;
	approved: boolean;
	reason?: string;
}

export interface RespondToPermissionResult {
	success: boolean;
}

/**
 * Respond to a pending permission request from Claude Code.
 * Sends a control_response to the running process.
 */
export const respondToPermission = (input: RespondToPermissionInput) =>
	usecase({
		read: (ctx) => {
			const session = ctx.repos.session.get(Session.ById(input.sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			const permission = ctx.repos.permissionStore.get(input.requestId);
			if (!permission) {
				return fail("NOT_FOUND", "Permission request not found", {
					requestId: input.requestId,
				});
			}

			// Get the execution process
			const executionProcessPage = ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(input.sessionId),
				{ limit: 1, sort: ExecutionProcess.defaultSort },
			);
			const latestProcess = executionProcessPage.items[0];

			if (!latestProcess || latestProcess.status !== "running") {
				return fail("INVALID_STATE", "No running execution process", {
					sessionId: input.sessionId,
				});
			}

			return { session, permission, latestProcess };
		},

		post: async (ctx, { latestProcess }) => {
			const success = await ctx.repos.executor.sendPermissionResponse(
				latestProcess.id,
				input.requestId,
				input.approved,
				undefined,
				input.reason,
			);

			// Remove from store
			ctx.repos.permissionStore.remove(input.requestId);

			return { success };
		},

		result: ({ success }): RespondToPermissionResult => ({ success }),
	});

/**
 * Get pending permissions for a session.
 */
export const getPendingPermissions = (input: { sessionId: string }) =>
	usecase({
		read: (ctx) => {
			const session = ctx.repos.session.get(Session.ById(input.sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			const permissions = ctx.repos.permissionStore.listBySession(
				input.sessionId,
			);
			return { permissions };
		},

		result: ({ permissions }) => ({
			permissions: permissions.map((p) => ({
				requestId: p.requestId,
				toolName: p.toolName,
				toolInput: p.toolInput,
				requestedAt: p.requestedAt.toISOString(),
				timeoutMs: p.timeoutMs,
			})),
		}),
	});
