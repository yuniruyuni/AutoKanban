import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ServiceCtx } from "../../common";
import type {
	AgentAdapter,
	AgentConfigRepository as AgentConfigRepositoryDef,
} from "../repository";

const ADAPTERS: AgentAdapter[] = [
	{
		agentId: "claude-code",
		displayName: "Claude Code",
		configPath: join(homedir(), ".claude.json"),
		serversKey: "mcpServers",
	},
];

export class AgentConfigRepository implements AgentConfigRepositoryDef {
	listSupportedAgents(_ctx: ServiceCtx): AgentAdapter[] {
		return ADAPTERS;
	}

	getAdapter(_ctx: ServiceCtx, agentId: string): AgentAdapter | null {
		return ADAPTERS.find((a) => a.agentId === agentId) ?? null;
	}

	readMcpServers(_ctx: ServiceCtx, agentId: string): Record<string, unknown> {
		const adapter = this.getAdapter(_ctx, agentId);
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

	writeMcpServers(
		_ctx: ServiceCtx,
		agentId: string,
		servers: Record<string, unknown>,
	): void {
		const adapter = this.getAdapter(_ctx, agentId);
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
		_ctx: ServiceCtx,
		agentId: string,
		name: string,
		config: Record<string, unknown>,
	): void {
		const servers = this.readMcpServers(_ctx, agentId);
		servers[name] = config;
		this.writeMcpServers(_ctx, agentId, servers);
	}

	removeServer(_ctx: ServiceCtx, agentId: string, name: string): void {
		const servers = this.readMcpServers(_ctx, agentId);
		delete servers[name];
		this.writeMcpServers(_ctx, agentId, servers);
	}
}
