import {
	findPendingToolUses,
	type PendingToolUse,
	parseLogsToConversation,
} from "../../lib/conversation-parser";
import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Variant } from "../../models/variant";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import type { QueuedMessage, QueueStatus } from "../../repositories";
import { usecase } from "../runner";

// ============================================
// Queue Message
// ============================================

export interface QueueMessageInput {
	sessionId: string;
	prompt: string;
	executor?: string;
	variant?: string;
}

export interface QueueMessageResult {
	queuedMessage: QueuedMessage;
	sentImmediately: boolean;
	executionProcessId?: string;
}

/**
 * Queue a message for a session.
 *
 * This is the unified message sending endpoint:
 * 1. Always adds the message to the queue
 * 2. Immediately checks if the process is idle
 * 3. If idle, consumes from queue and sends the message
 * 4. Returns the result with a flag indicating if the message was sent immediately
 */
export const queueMessage = (input: QueueMessageInput) =>
	usecase({
		read: async (ctx) => {
			// Verify session exists
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			// Get the workspace
			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", "Workspace not found", {
					workspaceId: session.workspaceId,
				});
			}

			// Get the latest execution process for this session
			const executionProcessPage = await ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(input.sessionId),
				{ limit: 1, sort: ExecutionProcess.defaultSort },
			);
			const latestProcess = executionProcessPage.items[0];

			// Get the project for the workspace (to get worktree path)
			const workspaceReposPage = await ctx.repos.workspaceRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const workspaceRepo = workspaceReposPage.items[0];
			const project = workspaceRepo
				? await ctx.repos.project.get(Project.ById(workspaceRepo.projectId))
				: null;

			// Get resume info for continuing the Claude Code session
			const resumeInfo = await ctx.repos.codingAgentTurn.findLatestResumeInfo(
				input.sessionId,
			);

			// Look up variant entity to get permissionMode and model
			const executor = input.executor ?? "claude-code";
			const variantEntity = input.variant
				? await ctx.repos.variant.get(
						Variant.ByExecutorAndName(executor, input.variant),
					)
				: null;

			return {
				session,
				workspace,
				latestProcess,
				project,
				resumeInfo,
				variantEntity,
			};
		},

		process: (
			_ctx,
			{ session, workspace, latestProcess, project, resumeInfo, variantEntity },
		) => {
			// Determine working directory (needed for new process)
			let workingDir: string | null = null;
			if (workspace.worktreePath) {
				workingDir = project
					? `${workspace.worktreePath}/${project.name}`
					: workspace.worktreePath;
			} else if (project) {
				workingDir = project.repoPath;
			}

			return {
				session,
				workspace,
				latestProcess,
				workingDir,
				resumeInfo,
				variantEntity,
			};
		},

		post: async (
			ctx,
			{ session, latestProcess, workingDir, resumeInfo, variantEntity },
		) => {
			// Check if the latest process is idle (waiting for input)
			let isIdle = false;
			let isRunning = false;
			if (latestProcess?.status === "running") {
				isRunning = true;
				const logs = await ctx.repos.executionProcessLogs.getLogs(
					latestProcess.id,
				);
				if (logs?.logs) {
					const parseResult = parseLogsToConversation(logs.logs);
					isIdle = parseResult.isIdle;
				}
			}

			// Find interrupted tools if resuming from a killed/failed EP
			let interruptedTools: PendingToolUse[] = [];
			if (resumeInfo && latestProcess && latestProcess.status !== "running") {
				const logs = await ctx.repos.executionProcessLogs.getLogs(
					latestProcess.id,
				);
				if (logs?.logs) {
					interruptedTools = findPendingToolUses(logs.logs);
				}
			}

			const canSendImmediately = !isRunning || isIdle;

			// Queue the message
			const queuedMessage = ctx.repos.messageQueue.queue(
				session.id,
				input.prompt,
				input.executor,
				input.variant,
			);

			if (!canSendImmediately) {
				// Cannot send immediately - message stays in queue
				return {
					queuedMessage,
					sentImmediately: false,
				};
			}

			// Consume the message from queue (we're about to send it)
			ctx.repos.messageQueue.consume(session.id);

			// Case 1: Running process is idle - send message to existing process
			if (isRunning && isIdle && latestProcess) {
				const success = await ctx.repos.executor.sendMessage(
					latestProcess.id,
					queuedMessage.prompt,
				);

				if (success) {
					return {
						queuedMessage,
						sentImmediately: true,
						executionProcessId: latestProcess.id,
					};
				}
				// Process no longer exists in memory - fall through to start new process
			}

			// Case 2: No running process - start a new one
			if (!workingDir) {
				// Put message back in queue if we can't start a process
				ctx.repos.messageQueue.queue(
					session.id,
					queuedMessage.prompt,
					queuedMessage.executor,
					queuedMessage.variant,
				);
				return {
					queuedMessage,
					sentImmediately: false,
				};
			}

			const runningProcess = await ctx.repos.executor.startProtocol({
				sessionId: session.id,
				runReason: "codingagent",
				workingDir,
				prompt: queuedMessage.prompt,
				permissionMode: variantEntity?.permissionMode,
				model: variantEntity?.model ?? undefined,
				resumeSessionId: resumeInfo?.agentSessionId,
				resumeMessageId: resumeInfo?.agentMessageId ?? undefined,
				interruptedTools:
					interruptedTools.length > 0
						? interruptedTools.map((t) => ({
								toolId: t.toolId,
								toolName: t.toolName,
							}))
						: undefined,
			});

			return {
				queuedMessage,
				sentImmediately: true,
				executionProcessId: runningProcess.id,
			};
		},

		result: ({
			queuedMessage,
			sentImmediately,
			executionProcessId,
		}): QueueMessageResult => ({
			queuedMessage,
			sentImmediately,
			executionProcessId,
		}),
	});

// ============================================
// Get Queue Status
// ============================================

export interface GetQueueStatusInput {
	sessionId: string;
}

export interface GetQueueStatusResult {
	status: QueueStatus;
}

export const getQueueStatus = (input: GetQueueStatusInput) =>
	usecase({
		read: async (ctx) => {
			// Verify session exists
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

		post: (ctx, { session }) => {
			const status = ctx.repos.messageQueue.getStatus(session.id);
			return { status };
		},

		result: ({ status }): GetQueueStatusResult => ({
			status,
		}),
	});

// ============================================
// Cancel Queue
// ============================================

export interface CancelQueueInput {
	sessionId: string;
}

export interface CancelQueueResult {
	cancelled: boolean;
}

export const cancelQueue = (input: CancelQueueInput) =>
	usecase({
		read: async (ctx) => {
			// Verify session exists
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

		post: (ctx, { session }) => {
			const cancelled = ctx.repos.messageQueue.cancel(session.id);
			return { cancelled };
		},

		result: ({ cancelled }): CancelQueueResult => ({
			cancelled,
		}),
	});
