import { useEffect } from "react";
import { mapTool } from "@/lib/mappers";
import { type Tool, toolActions } from "@/store";
import { trpc } from "@/trpc";

export function useTools() {
	const query = trpc.tool.list.useQuery();

	useEffect(() => {
		if (query.data) {
			const tools = query.data.items.map(mapTool);
			toolActions.setTools(tools);
		}
	}, [query.data]);

	return {
		tools: query.data?.items.map(mapTool) ?? [],
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
	};
}

interface CreateToolInput {
	name: string;
	icon: string;
	iconColor?: string;
	command?: string;
	argv?: string[] | null;
	sortOrder?: number;
}

interface UpdateToolInput {
	toolId: string;
	name?: string;
	icon?: string;
	iconColor?: string;
	command?: string;
	argv?: string[] | null;
	sortOrder?: number;
}

interface ExecuteToolInput {
	toolId: string;
	taskId?: string;
	projectId?: string;
}

export function useToolMutations() {
	const utils = trpc.useUtils();

	const createTool = trpc.tool.create.useMutation({
		onSuccess: () => {
			utils.tool.list.invalidate();
		},
	});

	const updateTool = trpc.tool.update.useMutation({
		onSuccess: () => {
			utils.tool.list.invalidate();
		},
	});

	const deleteTool = trpc.tool.delete.useMutation({
		onSuccess: () => {
			utils.tool.list.invalidate();
		},
	});

	const executeToolMutation = trpc.tool.execute.useMutation();

	return {
		createTool: async (input: CreateToolInput): Promise<Tool> => {
			const result = await createTool.mutateAsync(input);
			return mapTool(result);
		},

		updateTool: async (input: UpdateToolInput): Promise<Tool> => {
			const result = await updateTool.mutateAsync(input);
			return mapTool(result);
		},

		deleteTool: async (toolId: string): Promise<void> => {
			await deleteTool.mutateAsync({ toolId });
		},

		executeTool: async (input: ExecuteToolInput): Promise<void> => {
			await executeToolMutation.mutateAsync(input);
		},

		isCreating: createTool.isPending,
		isUpdating: updateTool.isPending,
		isDeleting: deleteTool.isPending,
		isExecuting: executeToolMutation.isPending,
	};
}
