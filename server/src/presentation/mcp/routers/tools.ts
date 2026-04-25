import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { TrpcHttpClient } from "../../../infra/trpc/client";
import { TaskStatusSchema } from "../../trpc/routers/task";

export interface ToolDef {
	name: string;
	description: string;
	schema: z.ZodTypeAny;
	handler: (input: unknown) => Promise<unknown>;
}

// Per-tool typed builder: schema and handler input share a Zod-inferred type at
// the definition site, but the resulting array stays uniformly typed.
function defineTool<S extends z.ZodTypeAny>(args: {
	name: string;
	description: string;
	schema: S;
	handler: (input: z.infer<S>) => Promise<unknown>;
}): ToolDef {
	return args as ToolDef;
}

function ok(result: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
	};
}

function err(message: string) {
	return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function formatZodError(error: z.ZodError, toolName: string): string {
	const lines = error.errors.map((issue) => {
		const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
		return `  - ${path}: ${issue.message}`;
	});
	return `Invalid input for tool "${toolName}":\n${lines.join("\n")}`;
}

export function buildInputSchema(
	schema: z.ZodTypeAny,
): Record<string, unknown> {
	const json = zodToJsonSchema(schema, { target: "jsonSchema7" }) as Record<
		string,
		unknown
	>;
	// MCP `inputSchema` is an inline JSON Schema fragment; the top-level
	// `$schema` URI only matters for standalone documents.
	delete json.$schema;
	return json;
}

const ProjectIdField = z.string().uuid().describe("Project ID (UUID)");
const TaskIdField = z.string().uuid().describe("Task ID (UUID)");

function buildTools(client: TrpcHttpClient): ToolDef[] {
	return [
		defineTool({
			name: "list_projects",
			description: "List all the available projects",
			schema: z.object({}).strict(),
			handler: async () => client.query("project.list"),
		}),
		defineTool({
			name: "list_tasks",
			description:
				"List all the tasks in a project with optional status filtering. `project_id` is required!",
			schema: z
				.object({
					project_id: ProjectIdField,
					status: TaskStatusSchema.optional().describe(
						"Filter by task status (optional)",
					),
				})
				.strict(),
			handler: async (input) => {
				const trpcInput: Record<string, unknown> = {
					projectId: input.project_id,
				};
				if (input.status) trpcInput.status = input.status;
				return client.query("task.list", trpcInput);
			},
		}),
		defineTool({
			name: "create_task",
			description:
				"Create a new task in a project. Always pass the `project_id` of the project you want to create the task in - it is required!",
			schema: z
				.object({
					project_id: ProjectIdField,
					title: z.string().min(1).describe("Task title"),
					description: z
						.string()
						.optional()
						.describe("Task description (optional)"),
				})
				.strict(),
			handler: async (input) => {
				const trpcInput: Record<string, unknown> = {
					projectId: input.project_id,
					title: input.title,
				};
				if (input.description) trpcInput.description = input.description;
				return client.mutation("task.create", trpcInput);
			},
		}),
		defineTool({
			name: "get_task",
			description:
				"Get detailed information about a specific task. You can use `list_tasks` to find the `task_id`. `task_id` is required.",
			schema: z.object({ task_id: TaskIdField }).strict(),
			handler: async (input) =>
				client.query("task.get", { taskId: input.task_id }),
		}),
		defineTool({
			name: "update_task",
			description:
				"Update an existing task's title, description, or status. `task_id` is required. `title`, `description`, and `status` are optional.",
			schema: z
				.object({
					task_id: TaskIdField,
					title: z.string().min(1).optional().describe("New title (optional)"),
					description: z
						.string()
						.optional()
						.describe("New description (optional)"),
					status: TaskStatusSchema.optional().describe("New status (optional)"),
				})
				.strict(),
			handler: async (input) => {
				const trpcInput: Record<string, unknown> = { taskId: input.task_id };
				if (input.title) trpcInput.title = input.title;
				if (input.description) trpcInput.description = input.description;
				if (input.status) trpcInput.status = input.status;
				return client.mutation("task.update", trpcInput);
			},
		}),
		defineTool({
			name: "delete_task",
			description: "Delete a task. `task_id` is required.",
			schema: z.object({ task_id: TaskIdField }).strict(),
			handler: async (input) =>
				client.mutation("task.delete", { taskId: input.task_id }),
		}),
		defineTool({
			name: "start_workspace_session",
			description:
				"Start working on a task by creating and launching a new workspace session.",
			schema: z
				.object({
					task_id: TaskIdField,
					prompt: z
						.string()
						.optional()
						.describe("Prompt for the agent (optional)"),
				})
				.strict(),
			handler: async (input) => {
				const trpcInput: Record<string, unknown> = { taskId: input.task_id };
				if (input.prompt) trpcInput.prompt = input.prompt;
				return client.mutation("execution.start", trpcInput);
			},
		}),
	];
}

async function buildContextTool(
	client: TrpcHttpClient,
): Promise<ToolDef | null> {
	const cwd = process.cwd();
	try {
		const context = await client.query("workspace.findByPath", {
			worktreePath: cwd,
		});
		if (!context) return null;

		return defineTool({
			name: "get_context",
			description:
				"Return project, task, and workspace metadata for the current workspace session context",
			schema: z.object({}).strict(),
			handler: async () => context,
		});
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
			inputSchema: buildInputSchema(t.schema),
		})),
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const tool = toolMap.get(request.params.name);
		if (!tool) {
			return err(`Unknown tool: ${request.params.name}`);
		}
		const parsed = tool.schema.safeParse(request.params.arguments ?? {});
		if (!parsed.success) {
			return err(formatZodError(parsed.error, tool.name));
		}
		try {
			const result = await tool.handler(parsed.data);
			return ok(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return err(message);
		}
	});
}
