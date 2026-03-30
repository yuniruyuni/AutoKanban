import { TaskTemplate } from "../../models/task-template";
import { usecase } from "../runner";

export const seedTaskTemplates = () =>
	usecase({
		read: async (ctx) => {
			const existing = await ctx.repos.taskTemplate.listAll();
			return { existing };
		},

		write: async (ctx, { existing }) => {
			if (existing.length > 0) return {};

			const templates: Array<{
				title: string;
				description: string;
				condition: TaskTemplate.Condition;
				sortOrder: number;
			}> = [
				{
					title: "devServerScriptを調査・設定する",
					description:
						"プロジェクトの開発サーバー起動コマンドを調査し、プロジェクト設定のdevServerScriptに登録してください。",
					condition: "no_dev_server",
					sortOrder: 0,
				},
			];

			for (const tmpl of templates) {
				await ctx.repos.taskTemplate.upsert(
					TaskTemplate.create({
						title: tmpl.title,
						description: tmpl.description,
						condition: tmpl.condition,
						sortOrder: tmpl.sortOrder,
					}),
				);
			}

			return {};
		},
	});
