import { ArrowRight, GitBranch } from "lucide-react";

interface BranchInfoProps {
	worktreeBranch: string;
	baseBranch: string;
	ahead?: number;
	behind?: number;
}

export function BranchInfo({ worktreeBranch, baseBranch }: BranchInfoProps) {
	return (
		<div className="flex items-center gap-2">
			{/* Worktree branch - light bg with border, gap-1.5 (6px), rounded-sm (4px), padding [4,10] */}
			<span className="flex items-center gap-1.5 rounded-sm border border-[#E4E4E7] bg-[#F5F5F5] px-2.5 py-1 font-mono text-xs font-medium text-[#71717A]">
				<GitBranch className="h-3 w-3 text-[#71717A]" />
				{worktreeBranch}
			</span>
			{/* Arrow - 14x14 */}
			<ArrowRight className="h-3.5 w-3.5 text-[#A1A1AA]" />
			{/* Base branch - accent filled, gap-1.5 (6px), rounded-sm (4px), padding [4,10] */}
			<span className="flex items-center gap-1.5 rounded-sm bg-[#E87B35] px-2.5 py-1 font-mono text-xs font-medium text-white">
				<GitBranch className="h-3 w-3 text-white" />
				{baseBranch}
			</span>
		</div>
	);
}
