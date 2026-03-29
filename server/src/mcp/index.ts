import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getBaseUrl } from "../lib/port-file";
import { registerMcpTools } from "./tools";
import { TrpcHttpClient } from "./trpc-client";

export async function runMcpServer(): Promise<void> {
	const baseUrl = getBaseUrl();
	const client = new TrpcHttpClient(baseUrl);

	const server = new Server(
		{ name: "auto-kanban", version: "0.1.0" },
		{
			capabilities: { tools: {}, resources: {} },
			instructions:
				"A task and project management server. If you need to create or update tickets or tasks then use these tools. Most of them absolutely require that you pass the `project_id` of the project that you are currently working on. You can get project ids by using `list_projects`. Call `list_tasks` to fetch the `task_ids` of all the tasks in a project. TOOLS: 'list_projects', 'list_tasks', 'create_task', 'start_workspace_session', 'get_task', 'update_task', 'delete_task', 'update_setup_script', 'update_cleanup_script', 'update_dev_server_script'. Make sure to pass `project_id` or `task_id` where required. You can use list tools to get the available ids.",
		},
	);

	await registerMcpTools(server, client);

	server.setRequestHandler(ListResourcesRequestSchema, async () => ({
		resources: [
			{
				uri: "auto-kanban://schema",
				name: "auto-kanban.json schema",
				description:
					"JSON Schema for auto-kanban.json workspace configuration file",
				mimeType: "application/schema+json",
			},
		],
	}));

	server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
		if (request.params.uri === "auto-kanban://schema") {
			const schemaPath = join(
				import.meta.dir,
				"../schemas/auto-kanban.schema.json",
			);
			const schema = readFileSync(schemaPath, "utf-8");
			return {
				contents: [
					{
						uri: request.params.uri,
						mimeType: "application/schema+json",
						text: schema,
					},
				],
			};
		}
		throw new Error(`Unknown resource: ${request.params.uri}`);
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Block until the parent process closes stdin (disconnects).
	// server.connect() returns immediately after setup, so we need to
	// keep the process alive while the MCP transport reads from stdin.
	await new Promise<void>((resolve) => {
		server.onclose = () => resolve();
	});
}
