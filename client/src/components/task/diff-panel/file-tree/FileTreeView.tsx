import type { GitDiff } from "@/hooks/useGit";
import type { TreeNode } from "@/lib/diff-parser";
import { FileTreeNode } from "./FileTreeNode";

interface FileTreeViewProps {
	tree: TreeNode;
	selectedFile: string | null;
	onSelectFile: (path: string) => void;
	diffs: GitDiff[];
}

export function FileTreeView({
	tree,
	selectedFile,
	onSelectFile,
	diffs,
}: FileTreeViewProps) {
	return (
		<div>
			{Array.from(tree.children.values()).map((node) => (
				<FileTreeNode
					key={node.path}
					node={node}
					depth={0}
					selectedFile={selectedFile}
					onSelectFile={onSelectFile}
					diffs={diffs}
				/>
			))}
		</div>
	);
}
