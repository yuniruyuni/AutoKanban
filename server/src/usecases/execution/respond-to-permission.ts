// @specre 01KPNSJ3R9YG1J1XFNB5CPZJR3
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { Session } from "../../models/session";
import { usecase } from "../runner";

// ============================================
// Respond to Permission Request
// ============================================

/**
 * Respond to a pending permission request from Claude Code.
 * Sends a control_response to the running process.
 */
export const respondToPermission = (
	sessionId: string,
	requestId: string,
	approved: boolean,
	reason?: string,
) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId,
				});
			}

			// Get the coding agent process
			const codingAgentProcessPage = await ctx.repos.codingAgentProcess.list(
				CodingAgentProcess.BySessionId(sessionId),
				{ limit: 1, sort: CodingAgentProcess.defaultSort },
			);
			const latestProcess = codingAgentProcessPage.items[0];

			if (!latestProcess || latestProcess.status !== "running") {
				return fail("INVALID_STATE", "No running coding agent process", {
					sessionId,
				});
			}

			return { session, latestProcess };
		},

		post: async (ctx, { latestProcess }) => {
			const permission = ctx.repos.permissionStore.get(requestId);
			if (!permission) {
				return fail("NOT_FOUND", "Permission request not found", {
					requestId,
				});
			}

			const success = await ctx.repos.executor.sendPermissionResponse(
				latestProcess.id,
				requestId,
				approved,
				undefined,
				reason,
			);

			// Remove from store
			ctx.repos.permissionStore.remove(requestId);

			return { success };
		},

		result: ({ success }) => ({ success }),
	});

/**
 * Get pending permissions for a session.
 */
export const getPendingPermissions = (input: { sessionId: string }) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			return { session };
		},

		post: (ctx) => {
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
