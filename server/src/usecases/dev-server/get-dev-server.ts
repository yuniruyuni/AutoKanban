import { DevServerProcess } from "../../models/dev-server-process";
import { usecase } from "../runner";

export interface GetDevServerInput {
	sessionId: string;
}

export const getDevServer = (input: GetDevServerInput) =>
	usecase({
		read: async (ctx) => {
			const page = await ctx.repos.devServerProcess.list(
				DevServerProcess.BySessionId(input.sessionId),
				{ limit: 1, sort: DevServerProcess.defaultSort },
			);
			return {
				executionProcess: page.items.length > 0 ? page.items[0] : null,
			};
		},
	});
