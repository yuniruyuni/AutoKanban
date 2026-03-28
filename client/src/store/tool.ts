import { proxy } from "valtio";

export interface Tool {
	id: string;
	name: string;
	icon: string;
	iconColor: string;
	command: string;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

interface ToolState {
	tools: Tool[];
}

export const toolStore = proxy<ToolState>({
	tools: [],
});

export const toolActions = {
	setTools(tools: Tool[]) {
		toolStore.tools = tools;
	},

	addTool(tool: Tool) {
		toolStore.tools.push(tool);
		// Sort by sortOrder
		toolStore.tools.sort((a, b) => a.sortOrder - b.sortOrder);
	},

	updateTool(toolId: string, updates: Partial<Tool>) {
		const index = toolStore.tools.findIndex((t) => t.id === toolId);
		if (index !== -1) {
			toolStore.tools[index] = { ...toolStore.tools[index], ...updates };
			// Re-sort by sortOrder
			toolStore.tools.sort((a, b) => a.sortOrder - b.sortOrder);
		}
	},

	removeTool(toolId: string) {
		const index = toolStore.tools.findIndex((t) => t.id === toolId);
		if (index !== -1) {
			toolStore.tools.splice(index, 1);
		}
	},
};
