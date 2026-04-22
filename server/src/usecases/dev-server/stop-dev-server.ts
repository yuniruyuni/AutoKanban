import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { usecase } from "../runner";

export const stopDevServer = (executionProcessId: string) =>
	usecase({
		read: async (ctx) => {
			const ep = await ctx.repos.devServerProcess.get(
				DevServerProcess.ById(executionProcessId),
			);
			if (!ep) {
				return fail("NOT_FOUND", "Dev server process not found");
			}
			if (ep.status !== "running") {
				return fail("INVALID_STATE", "Dev server is not running");
			}
			return { devServerProcess: ep };
		},

		write: async (ctx, { devServerProcess }) => {
			const updated = DevServerProcess.complete(
				devServerProcess,
				"killed",
				null,
			);
			await ctx.repos.devServerProcess.upsert(updated);
			return { devServerProcess: updated };
		},

		post: (ctx, { devServerProcess }) => {
			ctx.repos.devServer.stop(devServerProcess.id);
			return { devServerProcess };
		},

		result: () => ({ stopped: true }),
	});
