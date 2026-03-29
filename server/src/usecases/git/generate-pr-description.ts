import type { WriteContext } from "../../types/context";

const PR_DESCRIPTION_PROMPT = `Analyze the changes in this branch compared to the base branch and generate a Pull Request title and description.

The title should be concise and summarize the changes.
The body should be detailed markdown explaining what changed and why.`;

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

export async function generatePrDescription(
	ctx: WriteContext,
	params: {
		workspaceId: string;
		worktreePath: string;
	},
): Promise<{ title: string; body: string } | null> {
	const resumeInfo =
		ctx.repos.codingAgentTurn.findLatestResumeInfoByWorkspaceId(
			params.workspaceId,
		);

	try {
		return await ctx.repos.executor.runStructured<{
			title: string;
			body: string;
		}>(undefined, {
			workingDir: params.worktreePath,
			prompt: PR_DESCRIPTION_PROMPT,
			schema: PR_DESCRIPTION_SCHEMA,
			resumeSessionId: resumeInfo?.agentSessionId ?? undefined,
		});
	} catch (error) {
		ctx.logger.warn("Failed to generate PR description", error);
		return null;
	}
}
