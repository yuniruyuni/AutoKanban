// @specre 01KPNSHJW0CXD6X1YSAFEWHKXP
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import type { Task } from "../../models/task";
import { usecase } from "../runner";

export const createTask = (task: Task) =>
	usecase({
		read: async (ctx) => {
			const project = await ctx.repos.project.get(Project.ById(task.projectId));
			if (!project) {
				return fail("NOT_FOUND", "Project not found", {
					projectId: task.projectId,
				});
			}
			return {};
		},

		write: async (ctx) => {
			await ctx.repos.task.upsert(task);
			return task;
		},
	});
