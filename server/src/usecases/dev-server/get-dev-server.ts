import { ExecutionProcess } from "../../models/execution-process";
import { usecase } from "../runner";

export interface GetDevServerInput {
	sessionId: string;
}

export const getDevServer = (input: GetDevServerInput) =>
	usecase({
		read: (ctx) => {
			const page = ctx.repos.executionProcess.list(
				ExecutionProcess.BySessionId(input.sessionId).and(
					ExecutionProcess.ByRunReason("devserver"),
				),
				{ limit: 1, sort: ExecutionProcess.defaultSort },
			);
			return {
				executionProcess:
					page.items.length > 0 ? page.items[0] : null,
			};
		},
	});
