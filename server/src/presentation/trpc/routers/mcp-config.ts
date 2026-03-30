import { z } from "zod";
import { getAutoKanbanCommand, readPortFile } from "../../../infra/port-file";
import { getPreconfiguredServers } from "../../../models/agent-config-defaults";
import { publicProcedure, router } from "../init";

export const mcpConfigRouter = router({
	getAgentConfig: publicProcedure
		.input(z.object({ agentId: z.string() }))
		.query(({ ctx, input }) => {
			const adapter = ctx.repos.agentConfig.getAdapter(input.agentId);
			if (!adapter) {
				return { servers: {}, configPath: null };
			}
			const servers = ctx.repos.agentConfig.readMcpServers(input.agentId);
			return { servers, configPath: adapter.configPath };
		}),

	updateAgentConfig: publicProcedure
		.input(
			z.object({
				agentId: z.string(),
				servers: z.record(z.unknown()),
			}),
		)
		.mutation(({ ctx, input }) => {
			ctx.repos.agentConfig.writeMcpServers(
				input.agentId,
				input.servers as Record<string, unknown>,
			);
			return { success: true };
		}),

	injectSelf: publicProcedure
		.input(z.object({ agentId: z.string() }))
		.mutation(({ ctx, input }) => {
			const servers = getPreconfiguredServers();
			ctx.repos.agentConfig.injectServer(
				input.agentId,
				"auto_kanban",
				servers.auto_kanban.config,
			);
			return { success: true };
		}),

	listPreconfigured: publicProcedure.query(() => getPreconfiguredServers()),

	listAgents: publicProcedure.query(({ ctx }) => {
		return ctx.repos.agentConfig.listSupportedAgents().map((a) => ({
			agentId: a.agentId,
			displayName: a.displayName,
			configPath: a.configPath,
		}));
	}),

	getServerInfo: publicProcedure.query(() => {
		const port = readPortFile();
		const cmd = getAutoKanbanCommand();
		return {
			port,
			isRunning: port !== null,
			mcpCommand: cmd,
		};
	}),
});
