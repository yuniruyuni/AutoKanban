// @specre 01KPNSJ3QGNXV9410M3DFH802A
import { AgentSetting } from "../../models/agent-setting";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import {
	findPendingToolUses,
	type PendingToolUse,
} from "../../models/conversation/conversation-parser";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Variant } from "../../models/variant";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { WorkspaceScriptProcess } from "../../models/workspace-script-process";
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
					// Find the latest coding agent process for this session
					const processesPage = await ctx.repos.codingAgentProcess.list(
						CodingAgentProcess.BySessionId(latestSession.id),
						{ limit: 1, sort: CodingAgentProcess.defaultSort },
					);
					const latestProcess = processesPage.items[0];

					if (latestProcess) {
						// Get logs and find interrupted Task tools
						const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
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

			// Look up agent command setting
			const agentSettingEntity = await ctx.repos.agentSetting.get(
				AgentSetting.ById(executor),
			);

			return {
				task,
				project,
				activeWorkspace,
				activeHasSessions,
				maxAttempt,
				resumeInfo,
				interruptedTools,
				variantEntity,
				agentSettingEntity,
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
				agentSettingEntity,
			},
		) => {
			const strategy = Workspace.determineAttemptStrategy({
				activeWorkspace,
				activeHasSessions,
				maxAttempt,
				taskId: task.id,
				containerRef: project.repoPath,
			});

			const workspace = strategy.workspace;
			const isNewWorkspace = strategy.action === "new";
			const workspaceToArchive =
				strategy.action === "new" ? strategy.workspaceToArchive : null;

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

			// Create CodingAgentProcess and CodingAgentTurn in process step (pure)
			const codingAgentProcess = CodingAgentProcess.create({
				sessionId: session.id,
			});
			const codingAgentTurn = CodingAgentTurn.create({
				executionProcessId: codingAgentProcess.id,
				prompt,
			});

			// Create prepare script process entity (will be persisted in finish if used)
			const prepareScriptProcess = WorkspaceScriptProcess.create({
				sessionId: session.id,
				scriptType: "prepare",
			});

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
				agentSettingEntity,
				codingAgentProcess,
				codingAgentTurn,
				prepareScriptProcess,
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
				agentSettingEntity,
				codingAgentProcess,
				codingAgentTurn,
				prepareScriptProcess,
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

			// Persist CodingAgentProcess and CodingAgentTurn
			await ctx.repos.codingAgentProcess.upsert(codingAgentProcess);
			await ctx.repos.codingAgentTurn.upsert(codingAgentTurn);

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
				agentSettingEntity,
				codingAgentProcess,
				codingAgentTurn,
				prepareScriptProcess,
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
				agentSettingEntity,
				codingAgentProcess,
				prepareScriptProcess,
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

			// Compute updated workspace with worktree path (DB write deferred to finish)
			let updatedWorkspace: Workspace | null = null;
			if (isNewWorkspace && worktreePath) {
				updatedWorkspace = {
					...workspace,
					worktreePath: ctx.repos.worktree.getWorkspaceDir(workspace.id),
					updatedAt: ctx.now,
				};
			}

			// Run prepare script if configured
			let completedPrepareProcess: WorkspaceScriptProcess | null = null;
			let prepareProcessLogs: { stdout: string; stderr: string } | null = null;
			const config = await ctx.repos.workspaceConfig.load(worktreePath);
			if (config.prepare) {
				ctx.logger.info(
					`Running prepare script: ${config.prepare} in ${worktreePath}`,
				);
				const result = await ctx.repos.scriptRunner.run({
					command: config.prepare,
					workingDir: worktreePath,
				});
				prepareProcessLogs = {
					stdout: result.stdout,
					stderr: result.stderr,
				};
				if (result.exitCode !== 0) {
					completedPrepareProcess = WorkspaceScriptProcess.complete(
						prepareScriptProcess,
						"failed",
						result.exitCode,
					);
					ctx.logger.error(
						`Prepare script failed with exit code ${result.exitCode}`,
					);
					return {
						updatedWorkspace,
						completedPrepareProcess,
						prepareProcessLogs,
						prepareFailed: true as const,
					};
				}
				completedPrepareProcess = WorkspaceScriptProcess.complete(
					prepareScriptProcess,
					"completed",
					result.exitCode,
				);
				ctx.logger.info("Prepare script completed successfully");
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

			// Resolve command from agent settings (fetched in read step)
			const command = agentSettingEntity?.command ?? undefined;

			// Start the coding agent process in protocol mode
			// Protocol mode enables session resumption for follow-up messages
			// If we have resume info from a previous session, use it to continue the conversation
			ctx.logger.info("Starting coding agent process (protocol mode):", {
				sessionId: session.id,
				workingDir,
				promptLength: prompt.length,
				resuming: !!resumeInfo,
				resumeSessionId: resumeInfo?.agentSessionId,
				interruptedTaskCount: interruptedTools.length,
				command,
			});

			await ctx.repos.executor.startProtocol({
				id: codingAgentProcess.id,
				sessionId: session.id,
				runReason: "codingagent",
				workingDir,
				prompt,
				permissionMode: variantEntity?.permissionMode,
				model: variantEntity?.model ?? input.model,
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

			const result: StartExecutionResult = {
				workspaceId: workspace.id,
				sessionId: session.id,
				executionProcessId: codingAgentProcess.id,
				worktreePath,
			};

			ctx.logger.info("Execution started successfully:", result);

			return {
				...result,
				updatedWorkspace,
				completedPrepareProcess,
				prepareProcessLogs,
				prepareFailed: false as const,
			};
		},

		finish: async (ctx, data) => {
			// Persist workspace worktree path update in a new DB transaction
			if (data.updatedWorkspace) {
				await ctx.repos.workspace.upsert(data.updatedWorkspace);
			}

			// Persist prepare script process and logs if prepare was executed
			if (data.completedPrepareProcess) {
				await ctx.repos.workspaceScriptProcess.upsert(
					data.completedPrepareProcess,
				);
				if (data.prepareProcessLogs) {
					await ctx.repos.workspaceScriptProcessLogs.upsertLogs({
						workspaceScriptProcessId: data.completedPrepareProcess.id,
						logs: `${data.prepareProcessLogs.stdout}${data.prepareProcessLogs.stderr}`,
					});
				}
			}

			if (data.prepareFailed) {
				return fail(
					"PREPARE_SCRIPT_FAILED",
					"Prepare script failed, agent not started",
				);
			}

			const result: StartExecutionResult = {
				workspaceId: data.workspaceId,
				sessionId: data.sessionId,
				executionProcessId: data.executionProcessId,
				worktreePath: data.worktreePath,
			};
			return result;
		},
	});
