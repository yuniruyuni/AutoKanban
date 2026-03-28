import { filterWhitespaceHunks } from "@/lib/diff-parser";
import { cn } from "@/lib/utils";

export function UnifiedDiff({
	rawDiff,
	hideWhitespace,
}: {
	rawDiff: string;
	hideWhitespace: boolean;
}) {
	const filtered = hideWhitespace ? filterWhitespaceHunks(rawDiff) : rawDiff;
	const lines = filtered.split("\n");
	let oldLineNum = 0;
	let newLineNum = 0;

	// Filter out metadata lines
	const contentLines = lines.filter((line) => {
		if (
			line.startsWith("diff ") ||
			line.startsWith("index ") ||
			line.startsWith("---") ||
			line.startsWith("+++")
		) {
			return false;
		}
		return true;
	});

	return (
		<div className="font-mono text-xs">
			{contentLines.map((line, index) => {
				// Handle hunk headers
				if (line.startsWith("@@")) {
					const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
					if (match) {
						oldLineNum = parseInt(match[1], 10) - 1;
						newLineNum = parseInt(match[2], 10) - 1;
					}
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
							key={index}
							className="flex bg-[#F0F3F8] px-5 py-2 text-[#57606A]"
						>
							<span className="w-8 flex-shrink-0 text-right pr-4 select-none" />
							<span className="w-8 flex-shrink-0 text-right pr-4 select-none" />
							<span>{line}</span>
						</div>
					);
				}

				const isAddition = line.startsWith("+");
				const isDeletion = line.startsWith("-");

				if (isAddition) {
					newLineNum++;
				} else if (isDeletion) {
					oldLineNum++;
				} else {
					oldLineNum++;
					newLineNum++;
				}

				const bgColor = isAddition
					? "bg-[#DAFBE1]"
					: isDeletion
						? "bg-[#FFE2DD]"
						: "";

				const textColor = isAddition
					? "text-[#116329]"
					: isDeletion
						? "text-[#CF222E]"
						: "text-[#24292F]";

				const lineNumColor = "text-[#8C959F]";

				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
					<div key={index} className={cn("flex gap-4 px-5 py-0.5", bgColor)}>
						<span
							className={cn(
								"w-8 flex-shrink-0 text-right select-none",
								lineNumColor,
							)}
						>
							{isDeletion ? oldLineNum : isAddition ? "" : oldLineNum}
						</span>
						<span
							className={cn(
								"w-8 flex-shrink-0 text-right select-none",
								lineNumColor,
							)}
						>
							{isAddition ? newLineNum : isDeletion ? "" : newLineNum}
						</span>
						<span className={cn("break-all min-w-0", textColor)}>{line}</span>
					</div>
				);
			})}
		</div>
	);
}
