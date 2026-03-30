import { getAutoKanbanCommand } from "../infra/port-file";

export interface PreconfiguredServer {
	name: string;
	config: Record<string, unknown>;
	description: string;
}

export function getPreconfiguredServers(): Record<string, PreconfiguredServer> {
	const akCmd = getAutoKanbanCommand();
	return {
		auto_kanban: {
			name: "Auto Kanban",
			config: { command: akCmd.command, args: akCmd.args },
			description: "Auto Kanban task management",
		},
		context7: {
			name: "Context7",
			config: { type: "http", url: "https://mcp.context7.com/mcp" },
			description: "Up-to-date library documentation",
		},
		playwright: {
			name: "Playwright",
			config: { command: "npx", args: ["@playwright/mcp@latest"] },
			description: "Browser automation",
		},
		chrome_devtools: {
			name: "Chrome DevTools",
			config: { command: "npx", args: ["chrome-devtools-mcp@latest"] },
			description: "Chrome DevTools integration",
		},
	};
}
