// @specre 01KPNSJ3QH0F7EGESDD7AV06F6
import { AgentSetting } from "../../models/agent-setting";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import {
	findPendingToolUses,
	type PendingToolUse,
	parseLogsToConversation,
} from "../../models/conversation/conversation-parser";
import type { QueuedMessage, QueueStatus } from "../../models/message-queue";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Variant } from "../../models/variant";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
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
 * Queue a message for a session and record it in the logs.
 */
export const queueMessage = (input: QueueMessageInput) =>
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

			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(session.workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", "Workspace not found", {
					workspaceId: session.workspaceId,
				});
			}

			const codingAgentProcessPage = await ctx.repos.codingAgentProcess.list(
				CodingAgentProcess.BySessionId(input.sessionId),
				{ limit: 1, sort: CodingAgentProcess.defaultSort },
			);
			const latestProcess = codingAgentProcessPage.items[0];

			const workspaceReposPage = await ctx.repos.workspaceRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const workspaceRepo = workspaceReposPage.items[0];
			const project = workspaceRepo
				? await ctx.repos.project.get(Project.ById(workspaceRepo.projectId))
				: null;

			const resumeInfo = await ctx.repos.codingAgentTurn.findLatestResumeInfo(
				input.sessionId,
			);

			const executor = input.executor ?? "claude-code";
			const variantEntity = input.variant
				? await ctx.repos.variant.get(
						Variant.ByExecutorAndName(executor, input.variant),
					)
				: null;

			// Look up agent command setting
			const agentSettingEntity = await ctx.repos.agentSetting.get(
				AgentSetting.ById(executor),
			);

			let isIdle = false;
			let isRunning = false;
			let interruptedTools: PendingToolUse[] = [];

			if (latestProcess?.status === "running") {
				isRunning = true;
				const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
					latestProcess.id,
				);
				if (logs?.logs) {
					const parseResult = parseLogsToConversation(logs.logs);
					isIdle = parseResult.isIdle;
				}
			}

			if (resumeInfo && latestProcess && latestProcess.status !== "running") {
				const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
					latestProcess.id,
				);
				if (logs?.logs) {
					interruptedTools = findPendingToolUses(logs.logs);
				}
			}

			return {
				session,
				workspace,
				latestProcess,
				project,
				resumeInfo,
				variantEntity,
				agentSettingEntity,
				isIdle,
				isRunning,
				interruptedTools,
			};
		},

		process: (
			_ctx,
			{
				session,
				workspace,
				latestProcess,
				project,
				resumeInfo,
				variantEntity,
				agentSettingEntity,
				isIdle,
				isRunning,
				interruptedTools,
			},
		) => {
			const workingDir = Workspace.resolveWorkingDir(workspace, project);
			const codingAgentProcess = CodingAgentProcess.create({
				sessionId: session.id,
			});

			return {
				session,
				workspace,
				latestProcess,
				workingDir,
				resumeInfo,
				variantEntity,
				agentSettingEntity,
				codingAgentProcess,
				isIdle,
				isRunning,
				interruptedTools,
			};
		},

		post: async (
			ctx,
			{
				session,
				latestProcess,
				workingDir,
				resumeInfo,
				variantEntity,
				agentSettingEntity,
				codingAgentProcess,
				isIdle,
				isRunning,
				interruptedTools,
			},
		) => {
			const canSendImmediately = !isRunning || isIdle;

			const queuedMessage = ctx.repos.messageQueue.queue(
				session.id,
				input.prompt,
				input.executor,
				input.variant,
			);

			if (!canSendImmediately) {
				return {
					queuedMessage,
					sentImmediately: false as const,
					startedNewProcess: false as const,
				};
			}

			ctx.repos.messageQueue.consume(session.id);

			const userMsgJson = JSON.stringify({
				type: "user",
				message: {
					role: "user",
					content: [{ type: "text", text: input.prompt }],
				},
			});

			const logTimestamp = ctx.now;
			const logToMemory = (processId: string) => {
				const store = ctx.repos.logStoreManager.get(processId);
				if (store) {
					store.append(undefined as never, {
						timestamp: logTimestamp,
						source: "stdin",
						data: userMsgJson,
					});
				}
			};

			// Case 1: Send to existing process
			if (isRunning && isIdle && latestProcess) {
				const success = await ctx.repos.executor.sendMessage(
					latestProcess.id,
					queuedMessage.prompt,
				);

				if (success) {
					logToMemory(latestProcess.id);
					return {
						queuedMessage,
						sentImmediately: true as const,
						executionProcessId: latestProcess.id,
						startedNewProcess: false as const,
						userMsgJson,
						logTimestamp,
					};
				}
			}

			// Resolve command from agent settings (fetched in read step)
			const command = agentSettingEntity?.command ?? undefined;

			// Case 2: Start new process
			if (!workingDir) {
				ctx.repos.messageQueue.queue(
					session.id,
					queuedMessage.prompt,
					queuedMessage.executor,
					queuedMessage.variant,
				);
				return {
					queuedMessage,
					sentImmediately: false as const,
					startedNewProcess: false as const,
				};
			}

			await ctx.repos.executor.startProtocol({
				id: codingAgentProcess.id,
				sessionId: session.id,
				runReason: "codingagent",
				workingDir,
				prompt: queuedMessage.prompt,
				permissionMode: variantEntity?.permissionMode,
				model: variantEntity?.model ?? undefined,
				command,
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

			logToMemory(codingAgentProcess.id);

			const turn = CodingAgentTurn.create({
				executionProcessId: codingAgentProcess.id,
				prompt: queuedMessage.prompt,
			});

			return {
				queuedMessage,
				sentImmediately: true as const,
				executionProcessId: codingAgentProcess.id,
				startedNewProcess: true as const,
				codingAgentProcess,
				turn,
				userMsgJson,
				logTimestamp,
			};
		},

		finish: async (ctx, postResult) => {
			if (postResult.startedNewProcess) {
				await ctx.repos.codingAgentProcess.upsert(
					postResult.codingAgentProcess,
				);
				await ctx.repos.codingAgentTurn.upsert(postResult.turn);
			}

			if (
				postResult.sentImmediately &&
				postResult.executionProcessId &&
				postResult.userMsgJson
			) {
				const timestamp = postResult.logTimestamp.toISOString();
				await ctx.repos.codingAgentProcessLogs.appendLogs(
					postResult.executionProcessId,
					`[${timestamp}] [stdin] ${postResult.userMsgJson}\n`,
				);
			}

			return {
				queuedMessage: postResult.queuedMessage,
				sentImmediately: postResult.sentImmediately,
				executionProcessId:
					"executionProcessId" in postResult
						? postResult.executionProcessId
						: undefined,
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
