// @specre 01KPNSJ3R0HQW7R1ZZQDS33ZNA
import { usecase } from "../runner";

interface UpdateSummaryInput {
	processId: string;
	summary: string;
}

export const updateSummary = (input: UpdateSummaryInput) =>
	usecase({
		write: async (ctx) => {
			await ctx.repos.codingAgentTurn.updateSummary(
				input.processId,
				input.summary,
			);
		},
	});
