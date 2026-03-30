import { usecase } from "../runner";

interface UpdateSessionInfoInput {
	processId: string;
	agentSessionId: string | null;
	agentMessageId: string | null;
}

export const updateSessionInfo = (input: UpdateSessionInfoInput) =>
	usecase({
		write: async (ctx) => {
			if (input.agentSessionId) {
				await ctx.repos.codingAgentTurn.updateAgentSessionId(
					input.processId,
					input.agentSessionId,
				);
			}
			if (input.agentMessageId) {
				await ctx.repos.codingAgentTurn.updateAgentMessageId(
					input.processId,
					input.agentMessageId,
				);
			}
		},
	});
