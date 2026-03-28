import { cn } from "@/lib/utils";
import type { TokenUsageEntry } from "./types";

interface TokenUsageBarProps {
	usage: TokenUsageEntry;
}

function formatTokens(n: number): string {
	if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

export function TokenUsageBar({ usage }: TokenUsageBarProps) {
	const percentage = Math.min(
		(usage.totalTokens / usage.contextWindow) * 100,
		100,
	);

	const barColor =
		percentage > 80
			? "bg-red-500"
			: percentage > 50
				? "bg-yellow-500"
				: "bg-green-500";

	return (
		<div className="group relative">
			<div className="flex items-center gap-2">
				<div className="h-1.5 w-24 overflow-hidden rounded-full bg-hover">
					<div
						className={cn("h-full rounded-full transition-all", barColor)}
						style={{ width: `${percentage}%` }}
					/>
				</div>
				<span className="text-xs text-muted">
					{formatTokens(usage.totalTokens)}
				</span>
			</div>

			{/* Tooltip */}
			<div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden rounded bg-gray-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
				<div>Input: {formatTokens(usage.inputTokens)}</div>
				<div>Output: {formatTokens(usage.outputTokens)}</div>
				<div>
					Total: {formatTokens(usage.totalTokens)} /{" "}
					{formatTokens(usage.contextWindow)}
				</div>
				<div>{percentage.toFixed(1)}% used</div>
			</div>
		</div>
	);
}
