// @specre 01KPNSJ3QYE2ZFFYFFQ19JD3AH
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { usecase } from "../runner";

interface UpdateSessionInfoInput {
	processId: string;
	agentSessionId: string | null;
	agentMessageId: string | null;
}

export const updateSessionInfo = (input: UpdateSessionInfoInput) =>
	usecase({
		read: async (ctx) => {
			const turn = await ctx.repos.codingAgentTurn.get(
				CodingAgentTurn.ByExecutionProcessId(input.processId),
			);
			return { turn };
		},

		process: (_ctx, { turn }) => {
			if (!turn) return { updated: null };
			let updated = turn;
			if (input.agentSessionId) {
				updated = CodingAgentTurn.withAgentSessionId(
					updated,
					input.agentSessionId,
				);
			}
			if (input.agentMessageId) {
				updated = CodingAgentTurn.withAgentMessageId(
					updated,
					input.agentMessageId,
				);
			}
			return { updated };
		},

		write: async (ctx, { updated }) => {
			if (updated) await ctx.repos.codingAgentTurn.upsert(updated);
		},
	});
