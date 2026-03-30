import { Approval } from "../../models/approval";
import { ExecutionProcess } from "../../models/execution-process";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import type { FullRepos } from "../../repositories/common";
import type { Repos } from "../../repositories";
import type {
	ExecutorRepository as ExecutorRepositoryImpl,
	ProcessCompletionInfo,
} from "../../repositories/executor";
import type { DriverApprovalRequest } from "../../repositories/executor/orchestrator/driver-approval-request";
import type { ILogger } from "../../lib/logger/types";
import { logStoreManager } from "../../repositories/log-store";
import { createServiceCtx } from "../../repositories/common";

/**
 * Sets up event handlers that bridge executor process events to DB operations.
 *
 * This is the lifecycle layer: it reacts to process-level events (completion,
 * approval requests) and performs the corresponding DB writes. The executor
 * itself is pure process I/O with no database knowledge.
 */
export function setupExecutionLifecycle(
	executor: ExecutorRepositoryImpl,
	repos: FullRepos<Repos>,
	logger: ILogger,
): void {
	const log = logger.child("ExecutionLifecycle");

	// ============================================
	// On process complete: update ExecutionProcess status, close log store
	// ============================================
	executor.onProcessComplete(async (info: ProcessCompletionInfo) => {
		try {
			const existing = await repos.executionProcess.get(
				ExecutionProcess.ById(info.processId),
			);
			if (existing) {
				const now = new Date();
				await repos.executionProcess.upsert({
					...existing,
					status: info.status,
					exitCode: info.exitCode,
					completedAt: now,
					updatedAt: now,
				});
			}
		} catch (error) {
			log.error("Failed to update execution process on completion:", error);
		}

		// Close the in-memory log store for this process
		logStoreManager.close(createServiceCtx(), info.processId);
	});

	// ============================================
	// On approval request: create approval, wait for response, relay to driver
	// ============================================
	executor.onApprovalRequest(
		async (processId: string, request: DriverApprovalRequest) => {
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

			// Find the task for this process and set it to inreview
			const taskId = await findTaskIdForProcess(processId, repos, executor);
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
				// Create the approval and wait for user response
				const response = await repos.approvalStore.createAndWait(
					approval,
					repos.approval,
				);

				const approved = response.status === "approved";

				// Send the response back to the driver via the executor
				await repos.executor.sendPermissionResponse(
					processId,
					request.toolCallId,
					approved,
					(request.protocolContext as { requestSubtype?: string })
						?.requestSubtype,
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
		},
	);
}

/**
 * Finds the task ID associated with a running process by traversing:
 * process → session → workspace → task
 */
async function findTaskIdForProcess(
	processId: string,
	repos: FullRepos<Repos>,
	executor: ExecutorRepositoryImpl,
): Promise<string | null> {
	const runningProcess = executor.get(createServiceCtx(), processId);
	if (!runningProcess) return null;

	try {
		const session = await repos.session.get(
			Session.ById(runningProcess.sessionId),
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
