import { createBrowserRouter, Navigate } from "react-router-dom";
import { KanbanPage } from "./pages/KanbanPage";
import { NewProjectPage } from "./pages/NewProjectPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { AgentDetailPage } from "./pages/settings/AgentDetailPage";
import { AgentPage } from "./pages/settings/AgentPage";
import { MCPServerPage } from "./pages/settings/MCPServerPage";
import { TaskTemplatePage } from "./pages/settings/TaskTemplatePage";
import { ToolsPage } from "./pages/settings/ToolsPage";
import { TaskFullscreenPage } from "./pages/TaskFullscreenPage";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <ProjectsPage />,
	},
	{
		path: "/projects/new",
		element: <NewProjectPage />,
	},
	{
		path: "/projects/:projectId",
		element: <KanbanPage />,
	},
	{
		path: "/projects/:projectId/tasks/:taskId",
		element: <KanbanPage />,
	},
	{
		path: "/projects/:projectId/tasks/:taskId/fullscreen",
		element: <TaskFullscreenPage />,
	},
	{
		path: "/settings",
		element: <Navigate to="/settings/tools" replace />,
	},
	{
		path: "/settings/tools",
		element: <ToolsPage />,
	},
	{
		path: "/settings/mcp-server",
		element: <MCPServerPage />,
	},
	{
		path: "/settings/task-templates",
		element: <TaskTemplatePage />,
	},
	{
		path: "/settings/agent",
		element: <AgentPage />,
	},
	{
		path: "/settings/agent/:agentId",
		element: <AgentDetailPage />,
	},
]);
