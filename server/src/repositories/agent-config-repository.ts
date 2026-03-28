import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AgentAdapter {
	agentId: string;
	displayName: string;
	configPath: string;
	serversKey: string;
}

const ADAPTERS: AgentAdapter[] = [
	{
		agentId: "claude-code",
		displayName: "Claude Code",
		configPath: join(homedir(), ".claude.json"),
		serversKey: "mcpServers",
	},
];

export interface IAgentConfigRepository {
	listSupportedAgents(): AgentAdapter[];
	getAdapter(agentId: string): AgentAdapter | null;
	readMcpServers(agentId: string): Record<string, unknown>;
	writeMcpServers(agentId: string, servers: Record<string, unknown>): void;
	injectServer(
		agentId: string,
		name: string,
		config: Record<string, unknown>,
	): void;
	removeServer(agentId: string, name: string): void;
}

export class AgentConfigRepository implements IAgentConfigRepository {
	listSupportedAgents(): AgentAdapter[] {
		return ADAPTERS;
	}

	getAdapter(agentId: string): AgentAdapter | null {
		return ADAPTERS.find((a) => a.agentId === agentId) ?? null;
	}

	readMcpServers(agentId: string): Record<string, unknown> {
		const adapter = this.getAdapter(agentId);
		if (!adapter) return {};

		try {
			if (!existsSync(adapter.configPath)) return {};
			const content = readFileSync(adapter.configPath, "utf-8");
			const config = JSON.parse(content);
			return (config[adapter.serversKey] as Record<string, unknown>) ?? {};
		} catch {
			return {};
		}
	}

	writeMcpServers(agentId: string, servers: Record<string, unknown>): void {
		const adapter = this.getAdapter(agentId);
		if (!adapter) return;

		let config: Record<string, unknown> = {};
		try {
			if (existsSync(adapter.configPath)) {
				const content = readFileSync(adapter.configPath, "utf-8");
				config = JSON.parse(content);
			}
		} catch {
			config = {};
		}

		config[adapter.serversKey] = servers;
		writeFileSync(adapter.configPath, JSON.stringify(config, null, 2), "utf-8");
	}

	injectServer(
		agentId: string,
		name: string,
		config: Record<string, unknown>,
	): void {
		const servers = this.readMcpServers(agentId);
		servers[name] = config;
		this.writeMcpServers(agentId, servers);
	}

	removeServer(agentId: string, name: string): void {
		const servers = this.readMcpServers(agentId);
		delete servers[name];
		this.writeMcpServers(agentId, servers);
	}
}
