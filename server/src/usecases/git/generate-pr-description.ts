import { join } from "node:path";
import { unlink } from "node:fs/promises";
import { Session } from "../../models/session";
import type { WriteContext } from "../../types/context";

const PR_DESCRIPTION_FILE = ".pr-description.json";

const PR_DESCRIPTION_PROMPT = `You are generating a Pull Request description.
Analyze the changes in this branch compared to the base branch and generate:
1. A concise PR title summarizing the changes
2. A detailed PR body in markdown explaining what changed and why

Write the result as JSON to the file "${PR_DESCRIPTION_FILE}" in the current directory:
{"title": "...", "body": "..."}

Output ONLY the JSON file. Do not create the PR yourself.`;

export async function generatePrDescription(
	ctx: WriteContext,
	params: {
		workspaceId: string;
		worktreePath: string;
	},
): Promise<{ title: string; body: string } | null> {
	// Find the latest session for this workspace
	const sessions = ctx.repos.session.list(
		Session.ByWorkspaceId(params.workspaceId),
		{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
	);
	const session = sessions.items[0];
	if (!session) {
		ctx.logger.warn("No session found for workspace, skipping PR description generation");
		return null;
	}

	// Get resume info for session fork (context inheritance)
	const resumeInfo = ctx.repos.codingAgentTurn.findLatestResumeInfoByWorkspaceId(
		params.workspaceId,
	);

	try {
		// Start coding agent and wait for completion
		const result = await ctx.repos.executor.startProtocolAndWait({
			sessionId: session.id,
			runReason: "codingagent",
			workingDir: params.worktreePath,
			prompt: PR_DESCRIPTION_PROMPT,
			permissionMode: "bypassPermissions",
			resumeSessionId: resumeInfo?.agentSessionId ?? undefined,
			resumeMessageId: resumeInfo?.agentMessageId ?? undefined,
		});

		if (result.exitCode !== 0) {
			ctx.logger.warn("PR description agent exited with non-zero code", {
				exitCode: result.exitCode,
			});
			return null;
		}

		// Read the generated description file
		const descPath = join(params.worktreePath, PR_DESCRIPTION_FILE);
		const file = Bun.file(descPath);
		if (!(await file.exists())) {
			ctx.logger.warn("PR description file not found", { descPath });
			return null;
		}

		const content = await file.text();
		const json = JSON.parse(content);

		// Cleanup
		await unlink(descPath).catch(() => {});

		if (typeof json.title !== "string" || typeof json.body !== "string") {
			ctx.logger.warn("PR description file has invalid format", { json });
			return null;
		}

		return { title: json.title, body: json.body };
	} catch (error) {
		ctx.logger.warn("Failed to generate PR description", error);
		return null;
	}
}
