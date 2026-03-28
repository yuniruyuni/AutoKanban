import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/trpc";

export interface DirectoryEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	isGitRepo: boolean;
	size?: number;
}

export interface DirectoryBrowserState {
	currentPath: string;
	parentPath: string | null;
	entries: DirectoryEntry[];
}

export function useDirectoryBrowser(
	initialPath?: string,
	includeFiles?: boolean,
) {
	const [path, setPath] = useState<string | undefined>(initialPath);

	// Sync internal state when initialPath changes from outside
	useEffect(() => {
		setPath(initialPath);
	}, [initialPath]);

	const query = trpc.project.browseDirectory.useQuery({ path, includeFiles });

	const navigateTo = useCallback((newPath: string) => {
		setPath(newPath);
	}, []);

	const navigateUp = useCallback(() => {
		if (query.data?.parentPath) {
			setPath(query.data.parentPath);
		}
	}, [query.data]);

	const navigateToHome = useCallback(() => {
		setPath(undefined);
	}, []);

	return {
		currentPath: query.data?.currentPath ?? "",
		parentPath: query.data?.parentPath ?? null,
		entries: query.data?.entries ?? [],
		isLoading: query.isLoading,
		error: query.error ?? null,
		navigateTo,
		navigateUp,
		navigateToHome,
		canNavigateUp: !!query.data?.parentPath,
	};
}

export interface GitInfo {
	isGitRepo: boolean;
	hasCommits: boolean;
	path: string;
	currentBranch: string | null;
	remoteUrl: string | null;
	repoName: string | null;
}

export function useGitInfo(path: string | null) {
	const utils = trpc.useUtils();

	const query = trpc.project.getGitInfo.useQuery(
		{ path: path ?? "" },
		{ enabled: !!path },
	);

	const initGitRepoMutation = trpc.project.initGitRepo.useMutation({
		onSuccess: () => {
			// Invalidate git info query to refresh the data
			if (path) {
				utils.project.getGitInfo.invalidate({ path });
				utils.project.browseDirectory.invalidate();
			}
		},
	});

	return {
		gitInfo: query.data ?? null,
		isLoading: query.isLoading,
		error: query.error ?? null,
		refetch: query.refetch,
		initGitRepo: async (defaultBranch?: string) => {
			if (!path) throw new Error("No path selected");
			return await initGitRepoMutation.mutateAsync({ path, defaultBranch });
		},
		isInitializing: initGitRepoMutation.isPending,
	};
}
