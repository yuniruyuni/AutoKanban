// @specre 01KPQ6W85T6VTJEQWKM3BNVPMC
import { z } from "zod";
import { browseDirectory } from "../../../usecases/project/browse-directory";
import { createProject } from "../../../usecases/project/create-project";
import { deleteProject } from "../../../usecases/project/delete-project";
import { getGitInfo } from "../../../usecases/project/get-git-info";
import { getProject } from "../../../usecases/project/get-project";
import { initCommit } from "../../../usecases/project/init-commit";
import { initGitRepo } from "../../../usecases/project/init-git-repo";
import { listProjects } from "../../../usecases/project/list-projects";
import { updateProject } from "../../../usecases/project/update-project";
import { handleResult } from "../handle-result";
import { publicProcedure, router } from "../init";

// Project name is used as a path segment under ~/.auto-kanban/worktrees/<workspaceId>/<projectName>/.
// WorktreeRepository.getWorktreePath is the backstop, but we reject the obvious
// traversal vectors here so bad names never land in the DB in the first place.
export const projectNameSchema = z
	.string()
	.min(1)
	.max(100)
	.refine((s) => !/[/\\\0]/.test(s), {
		message: "Project name cannot contain path separators or null bytes",
	})
	.refine((s) => !s.startsWith("."), {
		message: "Project name cannot start with '.'",
	})
	.refine((s) => s === s.trim(), {
		message: "Project name cannot have leading or trailing whitespace",
	});

export const projectRouter = router({
	create: publicProcedure
		.input(
			z.object({
				name: projectNameSchema,
				description: z.string().optional().nullable(),
				repoPath: z.string().min(1),
				branch: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await createProject(input).run(ctx)),
		),

	get: publicProcedure
		.input(z.object({ projectId: z.string().uuid() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getProject(input).run(ctx)),
		),

	list: publicProcedure.query(async ({ ctx }) =>
		handleResult(await listProjects().run(ctx)),
	),

	update: publicProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				name: projectNameSchema.optional(),
				description: z.string().optional().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await updateProject(input).run(ctx)),
		),

	delete: publicProcedure
		.input(
			z.object({
				projectId: z.string().uuid(),
				deleteWorktrees: z.boolean().optional().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await deleteProject(input).run(ctx)),
		),

	browseDirectory: publicProcedure
		.input(
			z.object({
				path: z.string().optional(),
				includeFiles: z.boolean().optional(),
			}),
		)
		.query(async ({ ctx, input }) =>
			handleResult(await browseDirectory(input).run(ctx)),
		),

	getGitInfo: publicProcedure
		.input(z.object({ path: z.string() }))
		.query(async ({ ctx, input }) =>
			handleResult(await getGitInfo(input).run(ctx)),
		),

	initGitRepo: publicProcedure
		.input(
			z.object({
				path: z.string(),
				defaultBranch: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) =>
			handleResult(await initGitRepo(input).run(ctx)),
		),

	initCommit: publicProcedure
		.input(z.object({ path: z.string() }))
		.mutation(async ({ ctx, input }) =>
			handleResult(await initCommit(input).run(ctx)),
		),
});
