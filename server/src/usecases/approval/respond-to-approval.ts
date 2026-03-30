import { Approval } from "../../models/approval";
import { fail } from "../../models/common";
import { usecase } from "../runner";

// ============================================
// Respond to Approval
// ============================================

export interface RespondToApprovalInput {
	approvalId: string;
	executionProcessId: string;
	status: "approved" | "denied";
	reason?: string | null;
}

export interface RespondToApprovalResult {
	success: boolean;
}

/**
 * Respond to a pending approval (plan or permission).
 * Updates DB via ApprovalStore and resolves the waiting Promise.
 */
export const respondToApproval = (input: RespondToApprovalInput) =>
	usecase({
		read: async (ctx) => {
			// Verify approval exists
			const approval = await ctx.repos.approval.get(
				Approval.ById(input.approvalId),
			);
			if (!approval) {
				return fail("NOT_FOUND", "Approval not found", {
					approvalId: input.approvalId,
				});
			}

			if (approval.status !== "pending") {
				return fail("INVALID_STATE", "Approval already responded", {
					approvalId: input.approvalId,
					status: approval.status,
				});
			}

			if (approval.executionProcessId !== input.executionProcessId) {
				return fail(
					"INVALID_STATE",
					"Approval does not belong to this process",
					{
						approvalId: input.approvalId,
						executionProcessId: input.executionProcessId,
					},
				);
			}

			return { approval };
		},

		post: async (ctx, { approval }) => {
			const success = await ctx.repos.approvalStore.respond(
				approval.id,
				input.status,
				input.reason ?? null,
			);

			return { success, approval };
		},

		finish: async (ctx, { success, approval }) => {
			if (success) {
				const updated = Approval.respond(
					approval,
					input.status,
					input.reason ?? null,
				);
				await ctx.repos.approval.upsert(updated);
			}
			return { success };
		},

		result: ({ success }): RespondToApprovalResult => ({ success }),
	});

// ============================================
// Get Pending Approvals
// ============================================

export interface GetPendingApprovalsInput {
	executionProcessId: string;
}

/**
 * Get pending approvals for an execution process.
 */
export const getPendingApprovals = (input: GetPendingApprovalsInput) =>
	usecase({
		read: async (ctx) => {
			// Fallback to DB for pending approvals (server restart recovery)
			const spec = Approval.ByExecutionProcessId(input.executionProcessId).and(
				Approval.ByStatus("pending"),
			);
			const page = await ctx.repos.approval.list(spec, { limit: 100 });
			return { dbApprovals: page.items };
		},

		post: (ctx, { dbApprovals }) => {
			// First check in-memory store (normal flow)
			const inMemory = ctx.repos.approvalStore.listPending(
				input.executionProcessId,
			);
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
