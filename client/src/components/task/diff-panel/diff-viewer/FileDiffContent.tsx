import { useFileDiff } from "@/hooks/useGit";
import { SideBySideDiff } from "./SideBySideDiff";
import { UnifiedDiff } from "./UnifiedDiff";

interface FileDiffContentProps {
	workspaceId: string;
	projectId: string;
	filePath: string;
	viewMode: "unified" | "side-by-side";
	hideWhitespace: boolean;
}

export function FileDiffContent({
	workspaceId,
	projectId,
	filePath,
	viewMode,
	hideWhitespace,
}: FileDiffContentProps) {
	const { diff, isLoading } = useFileDiff(workspaceId, projectId, filePath);

	if (isLoading) {
		return (
			<div className="flex h-32 items-center justify-center text-muted text-xs">
				Loading diff...
			</div>
		);
	}

	if (!diff) {
		return (
			<div className="flex h-32 items-center justify-center text-muted text-xs">
				No diff available
			</div>
		);
	}

	if (viewMode === "side-by-side") {
		return <SideBySideDiff rawDiff={diff} hideWhitespace={hideWhitespace} />;
	}

	return <UnifiedDiff rawDiff={diff} hideWhitespace={hideWhitespace} />;
}
