import { router } from "../trpc";
import { approvalRouter } from "./approval";
import { devServerRouter } from "./dev-server";
import { executionRouter } from "./execution";
import { gitRouter } from "./git";
import { mcpConfigRouter } from "./mcp-config";
import { projectRouter } from "./project";
import { taskRouter } from "./task";
import { taskTemplateRouter } from "./task-template";
import { toolRouter } from "./tool";
import { variantRouter } from "./variant";
import { workspaceRouter } from "./workspace";

export const appRouter = router({
	task: taskRouter,
	project: projectRouter,
	execution: executionRouter,
	devServer: devServerRouter,
	approval: approvalRouter,
	git: gitRouter,
	taskTemplate: taskTemplateRouter,
	tool: toolRouter,
	variant: variantRouter,
	workspace: workspaceRouter,
	mcpConfig: mcpConfigRouter,
});

export type AppRouter = typeof appRouter;
