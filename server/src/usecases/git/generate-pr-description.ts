// @specre 01KPNSJ3RW522THM9SJXK6HYN3
import type { ILogger } from "../../infra/logger/types";
import { AgentSetting } from "../../models/agent-setting";
import { CodingAgentProcess } from "../../models/coding-agent-process";
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

// ============================================
// Input
// ============================================

export interface GeneratePrDescriptionInput {
	workspaceId: string;
	projectId: string;
}

// ============================================
// Constants
// ============================================

const MAX_CONTEXT_BYTES = 100 * 1024; // 100KB

const PR_DESCRIPTION_PROMPT_TEMPLATE = (conversationContext: string) =>
	`Analyze the changes in this branch compared to the base branch and generate a Pull Request title and description.
The title should be concise and summarize the changes.
The body should be detailed markdown explaining what changed and why.

<conversation>
${conversationContext}
</conversation>

Use this context to write a more informative PR description.`;

const PR_DESCRIPTION_SCHEMA = {
	type: "object",
	properties: {
		title: {
			type: "string",
			description: "Concise PR title summarizing the changes",
		},
		body: {
			type: "string",
			description:
				"Detailed PR body in markdown explaining what changed and why",
		},
	},
	required: ["title", "body"],
};

// ============================================
// Usecase
// ============================================

export const generatePrDescription = (input: GeneratePrDescriptionInput) =>
	usecase({
		read: async (ctx) => {
			// 1. Get workspace, verify it exists
			const workspace = await ctx.repos.workspace.get(
				Workspace.ById(input.workspaceId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", `Workspace not found: ${input.workspaceId}`);
			}

			// 2. Get project for worktree path resolution
			const project = await ctx.repos.project.get(
				Project.ById(input.projectId),
			);
			if (!project) {
				return fail("NOT_FOUND", `Project not found: ${input.projectId}`);
			}

			// 3. Get latest session for workspace
			const sessionsPage = await ctx.repos.session.list(
				Session.ByWorkspaceId(input.workspaceId),
				{ limit: 1, sort: Session.defaultSort },
			);
			const latestSession = sessionsPage.items[0];

			// 4. Get conversation context from logs (optional - may not exist yet)
			let conversationContext = "";
			if (latestSession) {
				const processesPage = await ctx.repos.codingAgentProcess.list(
					CodingAgentProcess.BySessionId(latestSession.id),
					{ limit: 1, sort: CodingAgentProcess.defaultSort },
				);
				const latestProcess = processesPage.items[0];
				if (latestProcess) {
					const logs = await ctx.repos.codingAgentProcessLogs.getLogs(
						latestProcess.id,
					);
					conversationContext = logs?.logs ?? "";
					if (conversationContext.length > MAX_CONTEXT_BYTES) {
						conversationContext = conversationContext.slice(-MAX_CONTEXT_BYTES);
					}
				}
			}

			// Look up agent command setting for structured output
			const agentSettingEntity = await ctx.repos.agentSetting.get(
				AgentSetting.ById("claude-code"),
			);

			return { conversationContext, workspace, project, agentSettingEntity };
		},

		post: async (
			ctx,
			{ conversationContext, workspace, project, agentSettingEntity },
		) => {
			// 1. Create DraftPullRequest in "generating" status
			ctx.repos.draftPullRequest.create(input.workspaceId, input.projectId);

			// 2. Build prompt with conversation context
			const prompt = PR_DESCRIPTION_PROMPT_TEMPLATE(conversationContext);

			// 3. Resolve worktree path (workspace dir + project name)
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				workspace.id,
				project.name,
			);

			if (!worktreePath) {
				ctx.repos.draftPullRequest.fail(input.workspaceId, input.projectId);
				return fail("NOT_FOUND", "Cannot resolve working directory");
			}

			// Resolve command from agent settings (fetched in read step)
			const command = agentSettingEntity?.command ?? undefined;

			const proc = ctx.repos.executor.spawnStructured(undefined, {
				workingDir: worktreePath,
				prompt,
				schema: PR_DESCRIPTION_SCHEMA,
				command,
			});

			if (!proc) {
				ctx.logger.error(
					"[generatePrDescription] spawnStructured returned null",
				);
				ctx.repos.draftPullRequest.fail(input.workspaceId, input.projectId);
				return fail(
					"INTERNAL",
					"Failed to spawn structured process for PR description generation",
				);
			}

			// 4. Start background consumption (fire and forget)
			consumeStructuredProcess(
				{ draftPullRequest: ctx.repos.draftPullRequest },
				ctx.logger,
				input.workspaceId,
				input.projectId,
				proc,
			).catch(() => {
				// Error already handled inside consumeStructuredProcess
			});

			return {};
		},
	});

// ============================================
// Background process consumer
// ============================================

async function consumeStructuredProcess(
	repos: {
		draftPullRequest: {
			appendLog(workspaceId: string, projectId: string, log: string): void;
			complete(
				workspaceId: string,
				projectId: string,
				title: string,
				body: string,
			): void;
			fail(workspaceId: string, projectId: string): void;
			get(workspaceId: string, projectId: string): { logs: string } | undefined;
		};
	},
	logger: ILogger,
	workspaceId: string,
	projectId: string,
	proc: {
		stdout: ReadableStream<Uint8Array>;
		stderr: ReadableStream<Uint8Array>;
		exited: Promise<number>;
	},
): Promise<void> {
	const stdoutDecoder = new TextDecoder();
	const stderrDecoder = new TextDecoder();
	let stdoutBuffer = "";

	// Read a stream, append to logs, and optionally accumulate into a buffer
	const readStream = async (
		stream: ReadableStream<Uint8Array>,
		decoder: TextDecoder,
		accumulate?: (chunk: string) => void,
	) => {
		const reader = stream.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				repos.draftPullRequest.appendLog(workspaceId, projectId, chunk);
				accumulate?.(chunk);
			}
		} finally {
			reader.releaseLock();
		}
	};

	try {
		await Promise.all([
			readStream(proc.stdout, stdoutDecoder, (chunk) => {
				stdoutBuffer += chunk;
			}),
			readStream(proc.stderr, stderrDecoder),
		]);

		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			repos.draftPullRequest.fail(workspaceId, projectId);
			return;
		}

		// Parse stdout to extract structured_output
		// stdout is accumulated separately to avoid stderr contamination
		if (!stdoutBuffer) {
			repos.draftPullRequest.fail(workspaceId, projectId);
			return;
		}

		try {
			const parsed = JSON.parse(stdoutBuffer) as Record<string, unknown>;
			const structured =
				(parsed.structured_output as { title?: string; body?: string }) ??
				parsed;

			if (
				typeof structured.title === "string" &&
				typeof structured.body === "string"
			) {
				repos.draftPullRequest.complete(
					workspaceId,
					projectId,
					structured.title,
					structured.body,
				);
			} else {
				repos.draftPullRequest.fail(workspaceId, projectId);
			}
		} catch {
			repos.draftPullRequest.fail(workspaceId, projectId);
		}
	} catch (err) {
		logger.error("[consumeStructuredProcess] unexpected error:", err);
		repos.draftPullRequest.fail(workspaceId, projectId);
	}
}
