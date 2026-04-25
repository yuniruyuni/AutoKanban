// @specre 01KPNSJ3RRYH45YHGMS83W76H0
// @specre 01KPZT8Z802KXZRGTYZKDZVH06
// @specre 01KPZT8XW9MWN21TTAE1AFS3YF
import { findFreePort } from "../../infra/net/find-free-port";
import { fail } from "../../models/common";
import { DevServerProcess } from "../../models/dev-server-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export const startDevServer = (taskId: string) =>
	usecase({
		// Reserve the proxy port eagerly so the DB row can carry it by the time
		// `write` commits. The port is AutoKanban's own pass-through for this
		// preview (see DevServerProcess.proxyPort docs).
		pre: async () => {
			return { proxyPort: await findFreePort() };
		},

		read: async (ctx, { proxyPort }) => {
			// Get task
			const task = await ctx.repos.task.get(Task.ById(taskId));
			if (!task) {
				return fail("NOT_FOUND", "Task not found", {
					taskId,
				});
			}

			// Get project
			const project = await ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: task.projectId,
				});
			}

			// Find active workspace
			const workspace = await ctx.repos.workspace.get(
				Workspace.ByTaskIdActive(taskId),
			);
			if (!workspace) {
				return fail("NOT_FOUND", "No active workspace for task");
			}

			if (!workspace.worktreePath) {
				return fail("INVALID_STATE", "Workspace has no worktree path");
			}

			// Find latest session
			const sessionPage = await ctx.repos.session.list(
				Session.ByWorkspaceId(workspace.id),
				{ limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
			);
			if (sessionPage.items.length === 0) {
				return fail("NOT_FOUND", "No session found for workspace");
			}
			const session = sessionPage.items[0];

			// Check for existing running dev server in this session
			const existingPage = await ctx.repos.devServerProcess.list(
				DevServerProcess.BySessionId(session.id).and(
					DevServerProcess.ByStatus("running"),
				),
				{ limit: 1, sort: DevServerProcess.defaultSort },
			);
			if (existingPage.items.length > 0) {
				// Already running, return existing
				return {
					alreadyRunning: true as const,
					executionProcessId: existingPage.items[0].id,
				};
			}

			return {
				alreadyRunning: false as const,
				task,
				session,
				workspace,
				project,
				proxyPort,
			};
		},

		process: (_ctx, data) => {
			if (data.alreadyRunning) return data;
			const devServerProcess = DevServerProcess.create({
				sessionId: data.session.id,
				proxyPort: data.proxyPort,
			});
			return { ...data, devServerProcess };
		},

		// The DevServerProcess row must exist in the DB before we spawn, so the
		// stream of stdout chunks LogCollector writes to dev_server_process_logs
		// does not race the FK. Previously this was deferred to `finish`.
		write: async (ctx, data) => {
			if (data.alreadyRunning) return data;
			await ctx.repos.devServerProcess.upsert(data.devServerProcess);
			return data;
		},

		post: async (ctx, data) => {
			if (data.alreadyRunning) return data;

			// Resolve actual repo path inside worktree
			const worktreePath = ctx.repos.worktree.getWorktreePath(
				data.workspace.id,
				data.project.name,
			);

			const config = await ctx.repos.workspaceConfig.load(worktreePath);
			if (!config.server) {
				return fail("INVALID_STATE", "No server script in auto-kanban.json");
			}

			// Start the AutoKanban-side pass-through proxy BEFORE the child
			// dev server. The proxy immediately accepts viewer connections and
			// serves a "starting…" placeholder until a target URL is detected
			// from the child's stdout (see LogCollector's onUrlDetected hook).
			//
			// `proxyPort` was a best-effort reservation made in `pre`; if the
			// kernel handed it to another listener in the meantime, the proxy
			// transparently rebinds on a fresh free port and returns it. We
			// reconcile any port drift with the DB row in `finish`.
			const { port: boundProxyPort } = await ctx.repos.previewProxy.start(
				data.devServerProcess.id,
				data.devServerProcess.proxyPort,
			);

			ctx.repos.devServer.start({
				processId: data.devServerProcess.id,
				sessionId: data.session.id,
				command: config.server,
				workingDir: worktreePath,
				processType: "devserver",
				context: {
					taskId: data.task.id,
					workspaceId: data.workspace.id,
					projectId: data.project.id,
				},
			});
			return {
				...data,
				worktreePath,
				serverCommand: config.server,
				boundProxyPort,
			};
		},

		// Reconcile the DB row when `previewProxy.start` had to fall back to a
		// different port than the one stamped during `write`. Common case: ports
		// match and this is a no-op.
		finish: async (ctx, data) => {
			if (data.alreadyRunning) return data;
			if (data.boundProxyPort === data.devServerProcess.proxyPort) return data;
			const updated = {
				...data.devServerProcess,
				proxyPort: data.boundProxyPort,
			};
			await ctx.repos.devServerProcess.upsert(updated);
			return { ...data, devServerProcess: updated };
		},

		result: (data) => ({
			executionProcessId: data.alreadyRunning
				? data.executionProcessId
				: data.devServerProcess.id,
		}),
	});
