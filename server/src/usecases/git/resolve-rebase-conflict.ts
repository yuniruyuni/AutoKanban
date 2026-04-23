// @specre 01KPX8ZRJMGPQS2DPB2GRN2HJT
import { AgentSetting } from "../../models/agent-setting";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { fail } from "../../models/common";
import {
	type PendingToolUse,
	parseLogsToConversation,
	pendingToolUsesToProtocolFormat,
} from "../../models/conversation/conversation-parser";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Variant } from "../../models/variant";
import { Workspace } from "../../models/workspace";
import { WorkspaceRepo } from "../../models/workspace-repo";
import { collectInterruptedTools } from "../collect-interrupted-tools";
import { usecase } from "../runner";

/**
 * Build the prompt sent to the Coding Agent when a rebase conflict is
 * detected. Colocated with the usecase so regressions show up in tests.
 */
export function buildRebaseConflictPrompt(
	targetBranch: string,
	conflictedFiles: readonly string[],
): string {
	const fileList = conflictedFiles.map((f) => `- ${f}`).join("\n");
	return [
		`\`git rebase\` onto \`${targetBranch}\` が conflict しました。解消して rebase を完了してください。`,
		"",
		"Conflicted files:",
		fileList,
		"",
		"手順:",
		"1. 各ファイルの `<<<<<<<` / `=======` / `>>>>>>>` マーカーを読んで、両側の変更の意図を理解する",
		"2. 正しい統合結果に編集する",
		"3. `git add <file>` で解決済みとして staged にする",
		"4. 全ファイルが staged になったら `git rebase --continue` を実行する",
		"5. `--continue` で新たな conflict が発生したら 1 からやり直す（rebase が clean に終わるまで繰り返す）",
		"6. 判断に確信が持てない conflict があれば、勝手に決めず、最後のメッセージで状況と選択肢をユーザに提示して作業を止める",
		"",
		"cwd は既に worktree 内です。",
	].join("\n");
}

/**
 * Spawn (or message) a Coding Agent turn instructing it to resolve the
 * in-progress rebase conflict autonomously.
 *
 * Uses the task's latest session, so conflict resolution appears as a
 * follow-up turn in the existing task conversation. Mechanics mirror
 * `queueMessage` — the only difference is that the prompt is built from
 * the live rebase state (target branch + conflicted files) rather than
 * supplied by the caller.
 */
export const resolveRebaseConflict = (workspaceId: string, projectId: string) =>
	usecase({
		read: async (ctx) => {
			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", `Workspace not found: ${workspaceId}`);
			}

			const project = await ctx.repos.project.get(Project.ById(projectId));
			if (!project) {
				return fail("NOT_FOUND", `Project not found: ${projectId}`);
			}

			const sessionsPage = await ctx.repos.session.list(
				Session.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);
			const session = sessionsPage.items[0];
			if (!session) {
				return fail(
					"INVALID_STATE",
					"Workspace has no session to resolve conflict in",
				);
			}

			const workspaceReposPage = await ctx.repos.workspaceRepo.list(
				WorkspaceRepo.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: WorkspaceRepo.defaultSort },
			);
			const workspaceRepo = workspaceReposPage.items[0];
			const targetBranch = workspaceRepo?.targetBranch ?? project.branch;

			const codingAgentProcessPage = await ctx.repos.codingAgentProcess.list(
				CodingAgentProcess.BySessionId(session.id),
				{ limit: 1, sort: CodingAgentProcess.defaultSort },
			);
			const latestProcess = codingAgentProcessPage.items[0];

			const resumeInfo = await ctx.repos.codingAgentTurn.findLatestResumeInfo(
				session.id,
			);

			const executor = session.executor ?? Session.DEFAULT_EXECUTOR;
			const variantEntity = session.variant
				? await ctx.repos.variant.get(
						Variant.ByExecutorAndName(executor, session.variant),
					)
				: null;

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

			if (resumeInfo) {
				interruptedTools = await collectInterruptedTools(ctx, latestProcess);
			}

			return {
				workspace,
				project,
				session,
				latestProcess,
				targetBranch,
				resumeInfo,
				variantEntity,
				agentSettingEntity,
				isIdle,
				isRunning,
				interruptedTools,
			};
		},

		process: (_ctx, data) => {
			const codingAgentProcess = CodingAgentProcess.create({
				sessionId: data.session.id,
			});
			return { ...data, codingAgentProcess };
		},

		post: async (ctx, data) => {
			const {
				workspace,
				project,
				session,
				latestProcess,
				targetBranch,
				resumeInfo,
				variantEntity,
				agentSettingEntity,
				isIdle,
				isRunning,
				interruptedTools,
				codingAgentProcess,
			} = data;

			const worktreePath = ctx.repos.worktree.getWorktreePath(
				workspace.id,
				project.name,
			);
			const exists = await ctx.repos.worktree.worktreeExists(
				workspace.id,
				project.name,
			);
			if (!exists) {
				return fail("NOT_FOUND", "Worktree does not exist");
			}

			const inProgress = await ctx.repos.git.isRebaseInProgress(worktreePath);
			if (!inProgress) {
				return fail("INVALID_STATE", "No rebase in progress on this worktree");
			}

			const conflictedFiles =
				await ctx.repos.git.getConflictedFiles(worktreePath);
			if (conflictedFiles.length === 0) {
				return fail(
					"INVALID_STATE",
					"Rebase is in progress but no conflicts to resolve",
				);
			}

			const prompt = buildRebaseConflictPrompt(targetBranch, conflictedFiles);
			const workingDir = Workspace.resolveWorkingDir(workspace, project);
			const canSendImmediately = CodingAgentProcess.canReceiveMessage(
				latestProcess,
				isIdle,
			);

			const queuedMessage = ctx.repos.messageQueue.queue(
				session.id,
				prompt,
				session.executor ?? undefined,
				session.variant ?? undefined,
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
					content: [{ type: "text", text: prompt }],
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

			const command = agentSettingEntity?.command ?? undefined;

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
				interruptedTools: pendingToolUsesToProtocolFormat(interruptedTools),
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

		result: ({ queuedMessage, sentImmediately, executionProcessId }) => ({
			queuedMessage,
			sentImmediately,
			executionProcessId,
		}),
	});
