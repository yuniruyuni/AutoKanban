// @specre 01KPNSJ3RX9X81V6FS6GB9G86R
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { Tool } from "../../models/tool";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const executeTool = (
	toolId: string,
	context?: { taskId?: string; projectId?: string },
) =>
	usecase({
		pre: async () => {
			if (!context?.taskId && !context?.projectId) {
				return fail(
					"INVALID_INPUT",
					"Either taskId or projectId must be provided",
				);
			}
			return {};
		},

		read: async (ctx) => {
			const tool = await ctx.repos.tool.get(Tool.ById(toolId));
			if (!tool) {
				return fail("NOT_FOUND", "Tool not found", { toolId });
			}

			// Gather DB data needed to determine the path
			let project: Project | null = null;
			let workspaceId: string | null = null;
			let targetPath: string | null = null;

			if (context?.taskId) {
				const task = await ctx.repos.task.get(Task.ById(context.taskId));
				if (!task) {
					return fail("NOT_FOUND", "Task not found", {
						taskId: context.taskId,
					});
				}

				project = await ctx.repos.project.get(Project.ById(task.projectId));
				if (!project) {
					return fail("NOT_FOUND", "Project not found", {
						projectId: task.projectId,
					});
				}

				const workspace = await ctx.repos.workspace.get(
					Workspace.ByTaskIdActive(context.taskId),
				);
				if (workspace) {
					workspaceId = workspace.id;
				} else {
					targetPath = project.repoPath;
				}
			} else if (context?.projectId) {
				project = await ctx.repos.project.get(Project.ById(context.projectId));
				if (!project) {
					return fail("NOT_FOUND", "Project not found", {
						projectId: context.projectId,
					});
				}
				targetPath = project.repoPath;
			}

			return { tool, project, workspaceId, targetPath };
		},

		process: (_, { tool, project, workspaceId, targetPath }) => {
			return {
				tool,
				projectName: project?.name ?? null,
				workspaceId,
				targetPath,
			};
		},

		post: async (ctx, { tool, projectName, workspaceId, targetPath }) => {
			// Resolve worktree path (External call) if needed
			let path = targetPath;
			if (workspaceId && projectName) {
				path = ctx.repos.worktree.getWorktreePath(workspaceId, projectName);
			}

			const finalPath = path ?? "";

			const resolved = resolveToolInvocation(tool, finalPath);
			if (resolved.kind === "fail") {
				return fail(resolved.code, resolved.message);
			}

			if (resolved.legacy) {
				ctx.logger.warn(
					"Tool uses legacy string `command`; please migrate to `argv`. " +
						"Path is shell-escaped during substitution to mitigate injection, " +
						"but argv form is the safer long-term shape.",
					{ toolId: tool.id, name: tool.name },
				);
			}

			try {
				await ctx.repos.tool.executeCommand(
					resolved.argv,
					finalPath || undefined,
				);
				return {
					success: true,
					command: resolved.display,
				};
			} catch (error) {
				return fail("EXECUTION_ERROR", `Failed to execute command: ${error}`);
			}
		},
	});

type Resolved =
	| { kind: "ok"; argv: string[]; display: string; legacy: boolean }
	| {
			kind: "fail";
			code: "INVALID_COMMAND";
			message: string;
	  };

// Decide which form the tool uses (argv preferred) and substitute {path}.
// Exported for unit tests; the usecase wraps this with logging + spawn.
export function resolveToolInvocation(tool: Tool, finalPath: string): Resolved {
	if (tool.argv && tool.argv.length > 0) {
		const argv = tool.argv.map((arg) => arg.replaceAll("{path}", finalPath));
		return {
			kind: "ok",
			argv,
			// Render argv as a shell-quoted display string for UI / logs only.
			display: argv.map(shellQuote).join(" "),
			legacy: false,
		};
	}

	const trimmed = tool.command.trim();
	if (!trimmed) {
		return {
			kind: "fail",
			code: "INVALID_COMMAND",
			message: "Command is empty",
		};
	}

	// Legacy: substitute {path} into a shell command. Shell-escape finalPath
	// so spaces / `;` / `$` / backticks in the path can never break out of
	// the placeholder. The command author still owns everything else; this
	// only protects the substituted path.
	const escaped = shellQuote(finalPath);
	const command = trimmed.replaceAll("{path}", escaped);
	return {
		kind: "ok",
		argv: ["sh", "-c", command],
		display: command,
		legacy: true,
	};
}

// POSIX shell single-quote escaping: wrap in '...' and replace each ' with '\''.
// Always quotes (even when not strictly needed) so callers don't have to think
// about which characters are "safe".
function shellQuote(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}
