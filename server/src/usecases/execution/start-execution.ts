import {
	findPendingToolUses,
	type PendingToolUse,
} from "../../models/conversation/conversation-parser";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { ExecutionProcess } from "../../models/execution-process";
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Variant } from "../../models/variant";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { usecase } from "../runner";

/**
 * Generate prompt from task.
 * Combines task title and description into a single prompt string.
 */
function taskToPrompt(task: Task): string {
	if (task.description?.trim()) {
		return `${task.title}\n\n${task.description}`;
	}
	return task.title;
}

export interface StartExecutionInput {
	taskId: string;
	prompt?: string; // If not provided, uses task.description
	executor?: string;
	variant?: string; // Configuration variant (e.g., 'default', 'plan')
	workingDir?: string; // If not provided, uses project worktree
	dangerouslySkipPermissions?: boolean;
	model?: string;
	targetBranch?: string; // Target branch for the worktree
}

export interface StartExecutionResult {
	workspaceId: string;
	sessionId: string;
	executionProcessId: string;
	worktreePath: string;
}

export const startExecution = (input: StartExecutionInput) =>
	usecase({
		read: async (ctx) => {
			// Verify task exists
			const task = await ctx.repos.task.get(Task.ById(input.taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
			}

			// Get the project (Project = 1 Repo)
			const project = await ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: task.projectId,
				});
			}

			// Check if there's already an active workspace for this task
			const activeWorkspace = await ctx.repos.workspace.get(
				Workspace.ByTaskIdActive(input.taskId),
			);

			// Check if active workspace has sessions (i.e., has been executed before)
			// startExecution always creates a new attempt when sessions exist.
			// Resume from killed state is handled by queueMessage (follow-up).
			let activeHasSessions = false;
			if (activeWorkspace) {
				const sessionsPage = await ctx.repos.session.list(
					Session.ByWorkspaceId(activeWorkspace.id),
					{ limit: 1 },
				);
				activeHasSessions = sessionsPage.items.length > 0;
			}

			// Get max attempt for this task
			const maxAttempt = await ctx.repos.workspace.getMaxAttempt(input.taskId);

			// Determine resume info only when reusing the same workspace (no new attempt)
			const resumeInfo =
				activeWorkspace && !activeHasSessions
					? await ctx.repos.codingAgentTurn.findLatestResumeInfoByWorkspaceId(
							activeWorkspace.id,
						)
					: null;

			// Find interrupted Task tools if we're resuming
			// These need synthetic error results to prevent Claude from getting stuck
			let interruptedTools: PendingToolUse[] = [];
			if (resumeInfo && activeWorkspace) {
				// Find the latest session in this workspace
				const sessionsPage = await ctx.repos.session.list(
					Session.ByWorkspaceId(activeWorkspace.id),
					{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
				);
				const latestSession = sessionsPage.items[0];

				if (latestSession) {
					// Find the latest execution process for this session
					const processesPage = await ctx.repos.executionProcess.list(
						ExecutionProcess.BySessionId(latestSession.id),
						{ limit: 1, sort: ExecutionProcess.defaultSort },
					);
					const latestProcess = processesPage.items[0];

					if (latestProcess) {
						// Get logs and find interrupted Task tools
						const logs = await ctx.repos.executionProcessLogs.getLogs(
							latestProcess.id,
						);
						if (logs?.logs) {
							interruptedTools = findPendingToolUses(logs.logs);
						}
					}
				}
			}

			// Look up variant entity if specified
			const executor = input.executor ?? "claude-code";
			const variantEntity = input.variant
				? await ctx.repos.variant.get(
						Variant.ByExecutorAndName(executor, input.variant),
					)
				: null;

			return {
				task,
				project,
				activeWorkspace,
				activeHasSessions,
				maxAttempt,
				resumeInfo,
				interruptedTools,
				variantEntity,
			};
		},

		process: (
			_ctx,
			{
				task,
				project,
				activeWorkspace,
				activeHasSessions,
				maxAttempt,
				resumeInfo,
				interruptedTools,
				variantEntity,
			},
		) => {
			let workspace: Workspace;
			let isNewWorkspace: boolean;
			let workspaceToArchive: Workspace | null = null;

			if (activeWorkspace && !activeHasSessions) {
				// Active workspace exists but has no sessions (never executed) — reuse it
				workspace = activeWorkspace;
				isNewWorkspace = false;
			} else if (activeWorkspace && activeHasSessions) {
				// Active workspace has been executed — archive it and create new attempt
				workspaceToArchive = activeWorkspace;
				const newAttempt = maxAttempt + 1;
				workspace = Workspace.create({
					taskId: task.id,
					containerRef: project.repoPath,
					attempt: newAttempt,
				});
				isNewWorkspace = true;
			} else {
				// No active workspace — create new one
				const newAttempt = maxAttempt + 1;
				workspace = Workspace.create({
					taskId: task.id,
					containerRef: project.repoPath,
					attempt: newAttempt,
				});
				isNewWorkspace = true;
			}

			// Create workspace repo entry for new workspaces
			const workspaceRepo = WorkspaceRepo.create({
				workspaceId: workspace.id,
				projectId: project.id,
				targetBranch: input.targetBranch ?? project.branch,
			});

			// Create new session
			const session = Session.create({
				workspaceId: workspace.id,
				executor: input.executor ?? "claude-code",
				variant: input.variant,
			});

			// Always use task.title + task.description as prompt
			// Ignore input.prompt - initial prompt should come from task
			const prompt = taskToPrompt(task);

			return {
				task,
				workspace,
				workspaceRepo,
				session,
				isNewWorkspace,
				workspaceToArchive,
				project,
				prompt,
				resumeInfo,
				interruptedTools,
				variantEntity,
			};
		},

		write: async (
			ctx,
			{
				task,
				workspace,
				workspaceRepo,
				session,
				isNewWorkspace,
				workspaceToArchive,
				project,
				prompt,
				resumeInfo,
				interruptedTools,
				variantEntity,
			},
		) => {
			// Archive the previous workspace if needed
			if (workspaceToArchive) {
				await ctx.repos.workspace.upsert({
					...workspaceToArchive,
					archived: true,
					updatedAt: ctx.now,
				});
			}

			// Save workspace if new
			if (isNewWorkspace) {
				await ctx.repos.workspace.upsert(workspace);
				await ctx.repos.workspaceRepo.upsert(workspaceRepo);
			}

			// Save session
			await ctx.repos.session.upsert(session);

			// Move task to inprogress atomically with the execution start
			if (task.status !== "inprogress") {
				await ctx.repos.task.upsert({
					...task,
					status: "inprogress",
					updatedAt: ctx.now,
				});
			}

			return {
				workspace,
				workspaceRepo,
				session,
				project,
				prompt,
				isNewWorkspace,
				resumeInfo,
				interruptedTools,
				variantEntity,
			};
		},

		post: async (
			ctx,
			{
				workspace,
				workspaceRepo,
				session,
				project,
				prompt,
				isNewWorkspace,
				resumeInfo,
				interruptedTools,
				variantEntity,
			},
		) => {
			// Create worktree for the project, using targetBranch as the starting point
			let worktreePath: string;

			try {
				worktreePath = await ctx.repos.worktree.ensureWorktreeExists(
					workspace,
					project,
					workspaceRepo.targetBranch,
				);
			} catch (error) {
				// Return explicit error instead of silently falling back
				return fail(
					"WORKTREE_ERROR",
					`Failed to create worktree for ${project.name}: ${error}`,
				);
			}

			// Update workspace with worktree path
			if (isNewWorkspace && worktreePath) {
				workspace.worktreePath = ctx.repos.worktree.getWorkspaceDir(
					workspace.id,
				);
				workspace.updatedAt = ctx.now;
				await ctx.repos.workspace.upsert(workspace);
			}

			// Determine working directory
			const workingDir = input.workingDir ?? worktreePath;

			// Prompt is always generated from task.title, so it should never be empty
			// (unless the task has no title, which should be caught earlier)
			if (!prompt) {
				return fail(
					"INVALID_INPUT",
					"Task has no title - cannot generate prompt",
				);
			}

			// Start the Claude Code process in protocol mode
			// Protocol mode enables session resumption for follow-up messages
			// If we have resume info from a previous session, use it to continue the conversation
			ctx.logger.info("Starting Claude Code process (protocol mode):", {
				sessionId: session.id,
				workingDir,
				promptLength: prompt.length,
				resuming: !!resumeInfo,
				resumeSessionId: resumeInfo?.agentSessionId,
				interruptedTaskCount: interruptedTools.length,
			});

			const runningProcess = await ctx.repos.executor.startProtocol({
				sessionId: session.id,
				runReason: "codingagent",
				workingDir,
				prompt,
				permissionMode: variantEntity?.permissionMode,
				model: variantEntity?.model ?? input.model,
				resumeSessionId: resumeInfo?.agentSessionId,
				resumeMessageId: resumeInfo?.agentMessageId ?? undefined,
				interruptedTools:
					interruptedTools.length > 0
						? interruptedTools.map((t) => ({
								toolId: t.toolId,
								toolName: t.toolName,
							}))
						: undefined,
				logsRepo: ctx.repos.executionProcessLogs,
				codingAgentTurnRepo: ctx.repos.codingAgentTurn,
			});

			// Create ExecutionProcess DB record
			const now = new Date();
			await ctx.repos.executionProcess.upsert({
				id: runningProcess.id,
				sessionId: session.id,
				runReason: "codingagent",
				status: "running",
				exitCode: null,
				startedAt: now,
				completedAt: null,
				createdAt: now,
				updatedAt: now,
			});

			// Create CodingAgentTurn DB record
			const turn = CodingAgentTurn.create({
				executionProcessId: runningProcess.id,
				prompt,
			});
			await ctx.repos.codingAgentTurn.upsert(turn);

			const result: StartExecutionResult = {
				workspaceId: workspace.id,
				sessionId: session.id,
				executionProcessId: runningProcess.id,
				worktreePath,
			};

			ctx.logger.info("Execution started successfully:", result);

			return result;
		},
	});
