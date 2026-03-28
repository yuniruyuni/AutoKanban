/**
 * Path builder functions for URL-based routing
 */
export const paths = {
	/** Home / Projects list */
	home: () => "/",

	/** New project page */
	newProject: () => "/projects/new",

	/** Kanban board for a project (no side panel) */
	project: (projectId: string) => `/projects/${projectId}`,

	/** Kanban board with task detail side panel */
	task: (projectId: string, taskId: string) =>
		`/projects/${projectId}/tasks/${taskId}`,

	/** Task detail fullscreen view */
	taskFullscreen: (projectId: string, taskId: string) =>
		`/projects/${projectId}/tasks/${taskId}/fullscreen`,

	/** Settings root (redirects to tools) */
	settings: () => "/settings",

	/** Tools settings page */
	tools: () => "/settings/tools",

	/** MCP Server settings page */
	mcpServer: () => "/settings/mcp-server",

	/** Agent settings page */
	agent: () => "/settings/agent",

	/** Agent detail page */
	agentDetail: (agentId: string) => `/settings/agent/${agentId}`,

	/** Task template settings page */
	taskTemplates: () => "/settings/task-templates",
};
