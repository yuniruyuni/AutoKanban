// @specre 01KPNSJ3R0HQW7R1ZZQDS33ZNA
import { CodingAgentTurn } from "../../models/coding-agent-turn";
import { usecase } from "../runner";

interface UpdateSummaryInput {
	processId: string;
	summary: string;
}

export const updateSummary = (input: UpdateSummaryInput) =>
	usecase({
		read: async (ctx) => {
			const turn = await ctx.repos.codingAgentTurn.get(
				CodingAgentTurn.ByExecutionProcessId(input.processId),
			);
			return { turn };
		},

		process: (_ctx, { turn }) => {
			if (!turn) return { updated: null };
			return { updated: CodingAgentTurn.withSummary(turn, input.summary) };
		},

		write: async (ctx, { updated }) => {
			if (updated) await ctx.repos.codingAgentTurn.upsert(updated);
		},
	});
