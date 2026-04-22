// @specre 01KPNSHJWC2NZQA92FWDK177XH
// @specre 01KPNSJ3R2G1397A2C25KH9821
import { Approval } from "../../models/approval";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import type { DriverApprovalRequest } from "../../models/driver-approval-request";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

/**
 * Handle approval request: set statuses to awaiting, wait for response,
 * relay to executor, restore statuses.
 */
export const handleApprovalRequest = (
	processId: string,
	request: DriverApprovalRequest,
) =>
	usecase({
		read: async (ctx) => {
			const execProcess = await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(processId),
			);

			// Find task via codingAgentProcess -> session -> workspace -> task
			let taskId: string | null = null;
			if (execProcess) {
				const session = await ctx.repos.session.get(
					Session.ById(execProcess.sessionId),
				);
				if (session) {
					const workspace = await ctx.repos.workspace.get(
						Workspace.ById(session.workspaceId),
					);
					taskId = workspace?.taskId ?? null;
				}
			}

			const task = taskId ? await ctx.repos.task.get(Task.ById(taskId)) : null;

			return { execProcess, task };
		},

		write: async (ctx, { execProcess, task }) => {
			if (execProcess) {
				const updated = CodingAgentProcess.toAwaitingApproval(execProcess);
				if (updated) {
					await ctx.repos.codingAgentProcess.upsert(updated);
				}
			}

			if (task) {
				const updated = Task.toInReview(task);
				if (updated) {
					await ctx.repos.task.upsert(updated);
				}
			}

			const approval = Approval.create({
				executionProcessId: processId,
				toolName: request.toolName,
				toolCallId: request.toolCallId,
			});
			await ctx.repos.approval.upsert(approval);

			return { approval, taskId: task?.id ?? null };
		},

		post: async (ctx, { approval, taskId }) => {
			const response = await ctx.repos.approvalStore.createAndWait(approval);

			const approved = response.status === "approved";

			// Use the control protocol request_id (from protocolContext), not
			// toolCallId (which may be tool_use_id). The control_response must
			// match the control_request's request_id for Claude Code to process it.
			const protocolCtx = request.protocolContext as {
				requestId?: string;
				requestSubtype?: string;
			};
			const requestId = protocolCtx.requestId ?? request.toolCallId;

			await ctx.repos.executor.sendPermissionResponse(
				processId,
				requestId,
				approved,
				protocolCtx.requestSubtype,
				response.reason ?? undefined,
				undefined,
				request.toolInput,
			);

			return { taskId };
		},

		finish: async (ctx, { taskId }) => {
			// Restore coding agent process status
			const currentProcess = await ctx.repos.codingAgentProcess.get(
				CodingAgentProcess.ById(processId),
			);
			if (currentProcess) {
				const restored = CodingAgentProcess.restoreFromApproval(currentProcess);
				if (restored) {
					await ctx.repos.codingAgentProcess.upsert(restored);
				}
			}

			// Restore task status
			if (taskId) {
				const task = await ctx.repos.task.get(Task.ById(taskId));
				if (task) {
					const restored = Task.restoreFromInReview(task);
					if (restored) {
						await ctx.repos.task.upsert(restored);
					}
				}
			}

			return {};
		},
	});
