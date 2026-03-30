import { Approval } from "../../../models/approval";
import { ExecutionProcess } from "../../../models/execution-process";
import { Session } from "../../../models/session";
import { Task } from "../../../models/task";
import { Workspace } from "../../../models/workspace";
import type { FullRepos } from "../../../repositories/common";
import type { Repos } from "../../../repositories";
import type { ILogger } from "../../../lib/logger/types";
import type { DriverApprovalRequest } from "../../../repositories/executor/orchestrator/driver-approval-request";

export async function handleApprovalRequest(
	repos: FullRepos<Repos>,
	logger: ILogger,
	processId: string,
	request: DriverApprovalRequest,
): Promise<void> {
	const log = logger.child("OnApprovalRequest");

	const approval = Approval.create({
		executionProcessId: processId,
		toolName: request.toolName,
		toolCallId: request.toolCallId,
	});

	// Set execution process to awaiting_approval
	const execProcess = await repos.executionProcess.get(
		ExecutionProcess.ById(processId),
	);
	if (execProcess && execProcess.status === "running") {
		await repos.executionProcess.upsert({
			...execProcess,
			status: "awaiting_approval",
			updatedAt: new Date(),
		});
	}

	// Find task and set to inreview
	const taskId = await findTaskIdForProcess(processId, repos);
	if (taskId) {
		const task = await repos.task.get(Task.ById(taskId));
		if (task && task.status === "inprogress") {
			await repos.task.upsert({
				...task,
				status: "inreview",
				updatedAt: new Date(),
			});
		}
	}

	try {
		// Wait for user response
		const response = await repos.approvalStore.createAndWait(
			approval,
			repos.approval,
		);

		const approved = response.status === "approved";

		// Relay response to executor
		await repos.executor.sendPermissionResponse(
			processId,
			request.toolCallId,
			approved,
			(request.protocolContext as { requestSubtype?: string })?.requestSubtype,
			response.reason ?? undefined,
			undefined,
			request.toolInput,
		);

		// Restore execution process status
		const currentProcess = await repos.executionProcess.get(
			ExecutionProcess.ById(processId),
		);
		if (currentProcess && currentProcess.status === "awaiting_approval") {
			await repos.executionProcess.upsert({
				...currentProcess,
				status: "running",
				updatedAt: new Date(),
			});
		}

		// Restore task status
		if (taskId) {
			const task = await repos.task.get(Task.ById(taskId));
			if (task && task.status === "inreview") {
				await repos.task.upsert({
					...task,
					status: "inprogress",
					updatedAt: new Date(),
				});
			}
		}
	} catch (error) {
		log.error("Error handling approval request:", error);
	}
}

async function findTaskIdForProcess(
	processId: string,
	repos: FullRepos<Repos>,
): Promise<string | null> {
	try {
		const process = await repos.executor.get(processId);
		if (!process) return null;

		const session = await repos.session.get(
			Session.ById(process.sessionId),
		);
		if (!session) return null;

		const workspace = await repos.workspace.get(
			Workspace.ById(session.workspaceId),
		);
		if (!workspace) return null;

		return workspace.taskId;
	} catch {
		return null;
	}
}
