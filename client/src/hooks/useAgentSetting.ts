import { trpc } from "@/trpc";

export function useAgentSetting(agentId: string) {
	const query = trpc.agentSetting.get.useQuery({ agentId });

	const defaultCommand = query.data?.defaultCommand ?? null;
	const effectiveCommand = query.data?.command ?? defaultCommand;
	const availability = trpc.agentSetting.checkAvailability.useQuery(
		{ command: effectiveCommand ?? "" },
		{ enabled: !!effectiveCommand },
	);

	const utils = trpc.useUtils();

	const updateMutation = trpc.agentSetting.update.useMutation({
		onSuccess: () => {
			utils.agentSetting.get.invalidate({ agentId });
			utils.agentSetting.checkAvailability.invalidate();
		},
	});

	return {
		command: query.data?.command ?? null,
		defaultCommand,
		isAvailable: availability.data?.available ?? false,
		isLoading: query.isLoading,
		updateCommand: (command: string) =>
			updateMutation.mutateAsync({ agentId, command }),
		isUpdating: updateMutation.isPending,
	};
}
