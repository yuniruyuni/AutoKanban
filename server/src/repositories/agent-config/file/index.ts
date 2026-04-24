import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
		format: "json",
	},
	{
		agentId: "codex-cli",
		displayName: "Codex CLI",
		configPath: join(homedir(), ".codex", "config.toml"),
		serversKey: "mcp_servers",
		format: "codex-toml",
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
		if (adapter.format === "codex-toml") {
			return readCodexMcpServers(adapter.configPath);
		}

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
		if (adapter.format === "codex-toml") {
			writeCodexMcpServers(adapter.configPath, servers);
			return;
		}

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
		mkdirSync(dirname(adapter.configPath), { recursive: true });
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

function readCodexMcpServers(path: string): Record<string, unknown> {
	if (!existsSync(path)) return {};
	const content = readFileSync(path, "utf-8");
	const servers: Record<string, unknown> = {};
	const sectionRegex = /^\[mcp_servers\.([^\]]+)\]\s*$/gm;
	const sections: Array<{ name: string; start: number; end: number }> = [];
	let match = sectionRegex.exec(content);
	while (match) {
		sections.push({
			name: match[1],
			start: match.index + match[0].length,
			end: content.length,
		});
		match = sectionRegex.exec(content);
	}
	for (let i = 0; i < sections.length; i++) {
		sections[i].end = sections[i + 1]?.start ?? content.length;
		const body = content.slice(sections[i].start, sections[i].end);
		const command = readTomlString(body, "command");
		const args = readTomlStringArray(body, "args");
		const env = readTomlInlineTable(body, "env");
		if (command) {
			servers[sections[i].name] = {
				command,
				...(args ? { args } : {}),
				...(env ? { env } : {}),
			};
		}
	}
	return servers;
}

function writeCodexMcpServers(
	path: string,
	servers: Record<string, unknown>,
): void {
	const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
	const stripped = existing
		.replace(/\n?\[mcp_servers\.[^\]]+\][\s\S]*?(?=\n\[[^\]]+\]|\s*$)/g, "")
		.trimEnd();
	const blocks = Object.entries(servers).map(([name, config]) =>
		formatCodexMcpServer(name, config as Record<string, unknown>),
	);
	const content = [stripped, ...blocks].filter(Boolean).join("\n\n");
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${content}\n`, "utf-8");
}

function formatCodexMcpServer(
	name: string,
	config: Record<string, unknown>,
): string {
	const lines = [`[mcp_servers.${name}]`];
	if (typeof config.command === "string") {
		lines.push(`command = ${tomlString(config.command)}`);
	}
	if (Array.isArray(config.args)) {
		lines.push(
			`args = [${config.args.map((arg) => tomlString(String(arg))).join(", ")}]`,
		);
	}
	if (
		config.env &&
		typeof config.env === "object" &&
		!Array.isArray(config.env)
	) {
		const entries = Object.entries(config.env as Record<string, unknown>).map(
			([key, value]) => `${key} = ${tomlString(String(value))}`,
		);
		lines.push(`env = { ${entries.join(", ")} }`);
	}
	return lines.join("\n");
}

function readTomlString(body: string, key: string): string | null {
	const match = body.match(
		new RegExp(`^${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m"),
	);
	return match ? unescapeTomlString(match[1]) : null;
}

function readTomlStringArray(body: string, key: string): string[] | null {
	const match = body.match(new RegExp(`^${key}\\s*=\\s*\\[([^\\]]*)\\]`, "m"));
	if (!match) return null;
	return Array.from(match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)).map((m) =>
		unescapeTomlString(m[1]),
	);
}

function readTomlInlineTable(
	body: string,
	key: string,
): Record<string, string> | null {
	const match = body.match(new RegExp(`^${key}\\s*=\\s*\\{([^}]*)\\}`, "m"));
	if (!match) return null;
	const env: Record<string, string> = {};
	for (const item of match[1].split(",")) {
		const pair = item.match(/\s*([A-Za-z0-9_]+)\s*=\s*"((?:[^"\\]|\\.)*)"/);
		if (pair) env[pair[1]] = unescapeTomlString(pair[2]);
	}
	return env;
}

function tomlString(value: string): string {
	return JSON.stringify(value);
}

function unescapeTomlString(value: string): string {
	return JSON.parse(`"${value}"`) as string;
}
