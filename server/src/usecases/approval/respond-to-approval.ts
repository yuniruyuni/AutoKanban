// @specre 01KPNSJ3R6ZE147WHQKD0ASB9A
import { Approval } from "../../models/approval";
import { fail } from "../../models/common";
import { usecase } from "../runner";

// ============================================
// Respond to Approval
// ============================================

/**
 * Respond to a pending approval (plan or permission).
 * Updates DB via ApprovalStore and resolves the waiting Promise.
 */
export const respondToApproval = (
	approvalId: string,
	executionProcessId: string,
	status: "approved" | "denied",
	reason?: string | null,
) =>
	usecase({
		read: async (ctx) => {
			// Verify approval exists
			const approval = await ctx.repos.approval.get(Approval.ById(approvalId));
			if (!approval) {
				return fail("NOT_FOUND", "Approval not found", {
					approvalId,
				});
			}

			const validationError = Approval.validateForResponse(
				approval,
				executionProcessId,
			);
			if (validationError) return validationError;

			return { approval };
		},

		post: async (ctx, { approval }) => {
			const success = await ctx.repos.approvalStore.respond(
				approval.id,
				status,
				reason ?? null,
			);

			return { success, approval };
		},

		finish: async (ctx, { success, approval }) => {
			if (success) {
				const updated = Approval.respond(approval, status, reason ?? null);
				await ctx.repos.approval.upsert(updated);
			}
			return { success };
		},

		result: ({ success }) => ({ success }),
	});

// ============================================
// Get Pending Approvals
// ============================================

/**
 * Get pending approvals for an execution process.
 */
export const getPendingApprovals = (executionProcessId: string) =>
	usecase({
		read: async (ctx) => {
			// Fallback to DB for pending approvals (server restart recovery)
			const spec = Approval.ByExecutionProcessId(executionProcessId).and(
				Approval.ByStatus("pending"),
			);
			const page = await ctx.repos.approval.list(spec, { limit: 100 });
			return { dbApprovals: page.items };
		},

		post: (ctx, { dbApprovals }) => {
			// First check in-memory store (normal flow)
			const inMemory = ctx.repos.approvalStore.listPending(executionProcessId);
			if (inMemory.length > 0) {
				return { approvals: inMemory };
			}

			// Use DB fallback
			return { approvals: dbApprovals };
		},

		result: ({ approvals }) => ({
			approvals: approvals.map((a) => ({
				id: a.id,
				executionProcessId: a.executionProcessId,
				toolName: a.toolName,
				toolCallId: a.toolCallId,
				status: a.status,
				createdAt: a.createdAt.toISOString(),
			})),
		}),
	});
