import type { CodingAgent } from "./agent";
import { claudeCodeAgent } from "./claude-code";
import { codexCliAgent } from "./codex-cli";
import { geminiCliAgent } from "./gemini-cli";

export class AgentCatalog {
	private readonly agents: Map<string, CodingAgent>;

	constructor(agents: readonly CodingAgent[]) {
		this.agents = new Map(agents.map((agent) => [agent.id, agent]));
	}

	get(agentId: string | null | undefined): CodingAgent | null {
		if (!agentId) return this.agents.get("claude-code") ?? null;
		return this.agents.get(agentId) ?? null;
	}

	require(agentId: string | null | undefined): CodingAgent {
		const agent = this.get(agentId);
		if (!agent) {
			throw new Error(`Unknown coding agent: ${agentId ?? "<default>"}`);
		}
		return agent;
	}

	list(): CodingAgent[] {
		return Array.from(this.agents.values());
	}
}

export const defaultAgentCatalog = new AgentCatalog([
	claudeCodeAgent,
	geminiCliAgent,
	codexCliAgent,
]);
