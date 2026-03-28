import { trpc } from "@/trpc";

export function useVariants(executor: string) {
	const query = trpc.variant.list.useQuery({ executor });
	return {
		variants: query.data?.items ?? [],
		isLoading: query.isLoading,
	};
}

export function useVariantMutations() {
	const utils = trpc.useUtils();

	const createVariant = trpc.variant.create.useMutation({
		onSuccess: () => {
			utils.variant.list.invalidate();
		},
	});

	const updateVariant = trpc.variant.update.useMutation({
		onSuccess: () => {
			utils.variant.list.invalidate();
		},
	});

	const deleteVariant = trpc.variant.delete.useMutation({
		onSuccess: () => {
			utils.variant.list.invalidate();
		},
	});

	return {
		createVariant: createVariant.mutateAsync,
		updateVariant: updateVariant.mutateAsync,
		deleteVariant: deleteVariant.mutateAsync,
		isCreating: createVariant.isPending,
		isUpdating: updateVariant.isPending,
		isDeleting: deleteVariant.isPending,
	};
}
