import {
	filterWhitespaceHunks,
	pairSideBySide,
	parseDiffLines,
} from "@/lib/diff-parser";
import { cn } from "@/lib/utils";

export function SideBySideDiff({
	rawDiff,
	hideWhitespace,
}: {
	rawDiff: string;
	hideWhitespace: boolean;
}) {
	const filtered = hideWhitespace ? filterWhitespaceHunks(rawDiff) : rawDiff;
	const lines = parseDiffLines(filtered);
	const pairs = pairSideBySide(lines);

	return (
		<div className="font-mono text-xs whitespace-pre-wrap">
			{pairs.map((pair, index) => {
				if (pair.left?.type === "hunk") {
					return (
						// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
						<div key={index} className="flex">
							<div className="flex w-1/2 min-w-0 bg-[#F0F3F8] px-5 py-2 text-[#57606A] border-r border-[#E4E4E7]">
								<span className="w-8 flex-shrink-0" />
								<span className="break-all">{pair.left.content}</span>
							</div>
							<div className="flex w-1/2 min-w-0 bg-[#F0F3F8] px-5 py-2 text-[#57606A]">
								<span className="w-8 flex-shrink-0" />
								<span className="break-all">{pair.right?.content}</span>
							</div>
						</div>
					);
				}

				const leftBg = !pair.left
					? "bg-[#F5F5F5]"
					: pair.left.type === "deletion"
						? "bg-[#FFE2DD]"
						: "";
				const rightBg = !pair.right
					? "bg-[#F5F5F5]"
					: pair.right.type === "addition"
						? "bg-[#DAFBE1]"
						: "";
				const leftTextColor =
					pair.left?.type === "deletion" ? "text-[#CF222E]" : "text-[#24292F]";
				const rightTextColor =
					pair.right?.type === "addition" ? "text-[#116329]" : "text-[#24292F]";

				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
					<div key={index} className="flex">
						{/* Left (old) */}
						<div
							className={cn(
								"flex w-1/2 min-w-0 gap-4 px-5 py-0.5 border-r border-[#E4E4E7]",
								leftBg,
							)}
						>
							<span className="w-8 flex-shrink-0 text-right text-[#8C959F] select-none">
								{pair.left?.oldLineNum ?? ""}
							</span>
							<span className={cn("break-all", leftTextColor)}>
								{pair.left?.content ?? ""}
							</span>
						</div>
						{/* Right (new) */}
						<div
							className={cn("flex w-1/2 min-w-0 gap-4 px-5 py-0.5", rightBg)}
						>
							<span className="w-8 flex-shrink-0 text-right text-[#8C959F] select-none">
								{pair.right?.newLineNum ?? ""}
							</span>
							<span className={cn("break-all", rightTextColor)}>
								{pair.right?.content ?? ""}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}
