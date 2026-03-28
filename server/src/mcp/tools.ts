import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { TrpcHttpClient } from "./trpc-client";

interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function ok(result: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
	};
}

function err(message: string) {
	return { content: [{ type: "text" as const, text: message }], isError: true };
}

function buildTools(client: TrpcHttpClient): ToolDef[] {
	return [
		{
			name: "list_projects",
			description: "List all the available projects",
			inputSchema: { type: "object", properties: {} },
			handler: async () => {
				const result = await client.query("project.list");
				return result;
			},
		},
		{
			name: "list_tasks",
			description:
				"List all the tasks in a project with optional status filtering. `project_id` is required!",
			inputSchema: {
				type: "object",
				properties: {
					project_id: { type: "string", description: "Project ID (UUID)" },
					status: {
						type: "string",
						enum: ["todo", "inprogress", "inreview", "done", "cancelled"],
						description: "Filter by task status (optional)",
					},
				},
				required: ["project_id"],
			},
			handler: async (args) => {
				const input: Record<string, unknown> = {
					projectId: args.project_id,
				};
				if (args.status) input.status = args.status;
				return client.query("task.list", input);
			},
		},
		{
			name: "create_task",
			description:
				"Create a new task in a project. Always pass the `project_id` of the project you want to create the task in - it is required!",
			inputSchema: {
				type: "object",
				properties: {
					project_id: { type: "string", description: "Project ID (UUID)" },
					title: { type: "string", description: "Task title" },
					description: {
						type: "string",
						description: "Task description (optional)",
					},
				},
				required: ["project_id", "title"],
			},
			handler: async (args) => {
				const input: Record<string, unknown> = {
					projectId: args.project_id,
					title: args.title,
				};
				if (args.description) input.description = args.description;
				return client.mutation("task.create", input);
			},
		},
		{
			name: "get_task",
			description:
				"Get detailed information about a specific task. You can use `list_tasks` to find the `task_id`. `task_id` is required.",
			inputSchema: {
				type: "object",
				properties: {
					task_id: { type: "string", description: "Task ID (UUID)" },
				},
				required: ["task_id"],
			},
			handler: async (args) => {
				return client.query("task.get", { taskId: args.task_id });
			},
		},
		{
			name: "update_task",
			description:
				"Update an existing task's title, description, or status. `task_id` is required. `title`, `description`, and `status` are optional.",
			inputSchema: {
				type: "object",
				properties: {
					task_id: { type: "string", description: "Task ID (UUID)" },
					title: { type: "string", description: "New title (optional)" },
					description: {
						type: "string",
						description: "New description (optional)",
					},
					status: {
						type: "string",
						enum: ["todo", "inprogress", "inreview", "done", "cancelled"],
						description: "New status (optional)",
					},
				},
				required: ["task_id"],
			},
			handler: async (args) => {
				const input: Record<string, unknown> = { taskId: args.task_id };
				if (args.title) input.title = args.title;
				if (args.description) input.description = args.description;
				if (args.status) input.status = args.status;
				return client.mutation("task.update", input);
			},
		},
		{
			name: "delete_task",
			description: "Delete a task. `task_id` is required.",
			inputSchema: {
				type: "object",
				properties: {
					task_id: { type: "string", description: "Task ID (UUID)" },
				},
				required: ["task_id"],
			},
			handler: async (args) => {
				return client.mutation("task.delete", { taskId: args.task_id });
			},
		},
		{
			name: "start_workspace_session",
			description:
				"Start working on a task by creating and launching a new workspace session.",
			inputSchema: {
				type: "object",
				properties: {
					task_id: { type: "string", description: "Task ID (UUID)" },
					prompt: {
						type: "string",
						description: "Prompt for the agent (optional)",
					},
				},
				required: ["task_id"],
			},
			handler: async (args) => {
				const input: Record<string, unknown> = { taskId: args.task_id };
				if (args.prompt) input.prompt = args.prompt;
				return client.mutation("execution.start", input);
			},
		},
		{
			name: "update_setup_script",
			description:
				"Update a project's setup script. The setup script runs when initializing a workspace.",
			inputSchema: {
				type: "object",
				properties: {
					project_id: { type: "string", description: "Project ID (UUID)" },
					setup_script: { type: "string", description: "Setup script content" },
				},
				required: ["project_id", "setup_script"],
			},
			handler: async (args) => {
				return client.mutation("project.update", {
					projectId: args.project_id,
					setupScript: args.setup_script,
				});
			},
		},
		{
			name: "update_cleanup_script",
			description:
				"Update a project's cleanup script. The cleanup script runs when tearing down a workspace.",
			inputSchema: {
				type: "object",
				properties: {
					project_id: { type: "string", description: "Project ID (UUID)" },
					cleanup_script: {
						type: "string",
						description: "Cleanup script content",
					},
				},
				required: ["project_id", "cleanup_script"],
			},
			handler: async (args) => {
				return client.mutation("project.update", {
					projectId: args.project_id,
					cleanupScript: args.cleanup_script,
				});
			},
		},
		{
			name: "update_dev_server_script",
			description:
				"Update a project's dev server script. The dev server script starts the development server.",
			inputSchema: {
				type: "object",
				properties: {
					project_id: { type: "string", description: "Project ID (UUID)" },
					dev_server_script: {
						type: "string",
						description: "Dev server script content",
					},
				},
				required: ["project_id", "dev_server_script"],
			},
			handler: async (args) => {
				return client.mutation("project.update", {
					projectId: args.project_id,
					devServerScript: args.dev_server_script,
				});
			},
		},
	];
}

async function buildContextTool(
	client: TrpcHttpClient,
): Promise<ToolDef | null> {
	const cwd = process.cwd();
	try {
		const result = await client.query<{ ok: boolean; value?: unknown }>(
			"workspace.findByPath",
			{ worktreePath: cwd },
		);
		if (!result || !result.ok || !result.value) return null;

		const context = result.value;
		return {
			name: "get_context",
			description:
				"Return project, task, and workspace metadata for the current workspace session context",
			inputSchema: { type: "object", properties: {} },
			handler: async () => context,
		};
	} catch {
		return null;
	}
}

export async function registerMcpTools(
	server: Server,
	client: TrpcHttpClient,
): Promise<void> {
	const tools = buildTools(client);

	// Conditionally add get_context tool
	const contextTool = await buildContextTool(client);
	if (contextTool) {
		tools.push(contextTool);
	}

	const toolMap = new Map(tools.map((t) => [t.name, t]));

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const tool = toolMap.get(request.params.name);
		if (!tool) {
			return err(`Unknown tool: ${request.params.name}`);
		}
		try {
			const result = await tool.handler(
				(request.params.arguments ?? {}) as Record<string, unknown>,
			);
			return ok(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return err(message);
		}
	});
}
