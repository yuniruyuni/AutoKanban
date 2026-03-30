import { Approval } from "../../models/approval";
import { ExecutionProcess } from "../../models/execution-process";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import type { DriverApprovalRequest } from "../../repositories/executor/orchestrator/driver-approval-request";
import { usecase } from "../runner";

export interface ApprovalRequestInput {
	processId: string;
	request: DriverApprovalRequest;
}

/**
 * Handle approval request: set statuses to awaiting, wait for response,
 * relay to executor, restore statuses.
 */
export const handleApprovalRequest = (input: ApprovalRequestInput) =>
	usecase({
		read: async (ctx) => {
			const execProcess = await ctx.repos.executionProcess.get(
				ExecutionProcess.ById(input.processId),
			);

			// Find task via executionProcess → session → workspace → task
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
			if (execProcess && execProcess.status === "running") {
				await ctx.repos.executionProcess.upsert({
					...execProcess,
					status: "awaiting_approval",
					updatedAt: new Date(),
				});
			}

			if (task && task.status === "inprogress") {
				await ctx.repos.task.upsert({
					...task,
					status: "inreview",
					updatedAt: new Date(),
				});
			}

			const approval = Approval.create({
				executionProcessId: input.processId,
				toolName: input.request.toolName,
				toolCallId: input.request.toolCallId,
			});

			return { approval, taskId: task?.id ?? null };
		},

		post: async (ctx, { approval, taskId }) => {
			const response = await ctx.repos.approvalStore.createAndWait(
				approval,
				ctx.repos.approval,
			);

			const approved = response.status === "approved";

			await ctx.repos.executor.sendPermissionResponse(
				input.processId,
				input.request.toolCallId,
				approved,
				(input.request.protocolContext as { requestSubtype?: string })
					?.requestSubtype,
				response.reason ?? undefined,
				undefined,
				input.request.toolInput,
			);

			// Restore execution process status
			const currentProcess = await ctx.repos.executionProcess.get(
				ExecutionProcess.ById(input.processId),
			);
			if (currentProcess && currentProcess.status === "awaiting_approval") {
				await ctx.repos.executionProcess.upsert({
					...currentProcess,
					status: "running",
					updatedAt: new Date(),
				});
			}

			// Restore task status
			if (taskId) {
				const task = await ctx.repos.task.get(Task.ById(taskId));
				if (task && task.status === "inreview") {
					await ctx.repos.task.upsert({
						...task,
						status: "inprogress",
						updatedAt: new Date(),
					});
				}
			}

			return {};
		},
	});
