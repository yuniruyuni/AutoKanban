// @specre 01KPNSEAVR0V2FXNAGASW9P9FJ
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { Task } from "../../models/task";
import { usecase } from "../runner";

export interface CreateProjectInput {
	name: string;
	description?: string | null;
	repoPath: string;
	branch?: string;
}

export const createProject = (input: CreateProjectInput) =>
	usecase({
		pre: async () => {
			// Validate required fields
			if (!input.name?.trim()) {
				return fail("INVALID_INPUT", "Project name is required");
			}
			if (!input.repoPath?.trim()) {
				return fail("INVALID_INPUT", "Repository path is required");
			}
			return {};
		},

		read: async (ctx) => {
			// Check if a project with this repo path already exists
			const existing = await ctx.repos.project.get(
				Project.ByRepoPath(input.repoPath),
			);
			if (existing) {
				return fail(
					"DUPLICATE",
					"A project with this repository path already exists",
					{
						existingProjectId: existing.id,
						repoPath: input.repoPath,
					},
				);
			}
			return {};
		},

		process: () => {
			const project = Project.create({
				name: input.name.trim(),
				description: input.description?.trim() || null,
				repoPath: input.repoPath,
				branch: input.branch || "main",
			});
			return { project };
		},

		write: async (ctx, { project }) => {
			await ctx.repos.project.upsert(project);

			// Generate default tasks from templates
			const templates = await ctx.repos.taskTemplate.listAll();
			for (const tmpl of templates) {
				if (tmpl.condition === "no_dev_server") {
					continue;
				}

				const task = Task.create({
					projectId: project.id,
					title: tmpl.title,
					description: tmpl.description,
				});
				await ctx.repos.task.upsert(task);
			}

			return project;
		},

		post: async (ctx, project) => {
			// Validate that repoPath is a git repository with at least one commit
			const isRepo = await ctx.repos.git.isGitRepo(input.repoPath);
			if (!isRepo) {
				return fail(
					"INVALID_INPUT",
					"The specified path is not a git repository",
					{
						repoPath: input.repoPath,
					},
				);
			}

			const branches = await ctx.repos.git.listBranches(input.repoPath);
			if (branches.length === 0) {
				return fail(
					"INVALID_INPUT",
					"The repository has no commits yet. Please make an initial commit first.",
					{ repoPath: input.repoPath },
				);
			}

			return project;
		},
	});
