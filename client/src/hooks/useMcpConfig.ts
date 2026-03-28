import { trpc } from "@/trpc";

export function useMcpConfig(agentId: string) {
	const agentConfig = trpc.mcpConfig.getAgentConfig.useQuery({ agentId });
	const preconfigured = trpc.mcpConfig.listPreconfigured.useQuery();
	const agents = trpc.mcpConfig.listAgents.useQuery();
	const serverInfo = trpc.mcpConfig.getServerInfo.useQuery();
	const utils = trpc.useUtils();

	const updateConfig = trpc.mcpConfig.updateAgentConfig.useMutation({
		onSuccess: () => {
			utils.mcpConfig.getAgentConfig.invalidate({ agentId });
		},
	});

	const injectSelf = trpc.mcpConfig.injectSelf.useMutation({
		onSuccess: () => {
			utils.mcpConfig.getAgentConfig.invalidate({ agentId });
		},
	});

	return {
		servers: agentConfig.data?.servers ?? {},
		configPath: agentConfig.data?.configPath ?? null,
		preconfiguredServers: preconfigured.data ?? {},
		supportedAgents: agents.data ?? [],
		serverInfo: serverInfo.data ?? { port: null, isRunning: false },
		isLoading: agentConfig.isLoading,

		updateServers: async (servers: Record<string, unknown>) => {
			await updateConfig.mutateAsync({ agentId, servers });
		},

		injectAutoKanban: async () => {
			await injectSelf.mutateAsync({ agentId });
		},

		toggleServer: async (
			serverName: string,
			config: Record<string, unknown>,
			enabled: boolean,
		) => {
			const current: Record<string, unknown> = {
				...(agentConfig.data?.servers ?? {}),
			};
			if (enabled) {
				current[serverName] = config;
			} else {
				delete current[serverName];
			}
			await updateConfig.mutateAsync({ agentId, servers: current });
		},

		isUpdating: updateConfig.isPending,
		isInjecting: injectSelf.isPending,
		refetch: agentConfig.refetch,
	};
}

export function useServerInfo() {
	const serverInfo = trpc.mcpConfig.getServerInfo.useQuery();
	return {
		port: serverInfo.data?.port ?? null,
		isRunning: serverInfo.data?.isRunning ?? false,
		mcpCommand: serverInfo.data?.mcpCommand ?? null,
		isLoading: serverInfo.isLoading,
	};
}

export function useSupportedAgents() {
	const agents = trpc.mcpConfig.listAgents.useQuery();
	return {
		agents: agents.data ?? [],
		isLoading: agents.isLoading,
	};
}
