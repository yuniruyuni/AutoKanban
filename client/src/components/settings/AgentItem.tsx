import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentItemProps {
	name: string;
	letter: string;
	bgColor: string;
	statusText: string;
	onConfigure: () => void;
	className?: string;
}

export function AgentItem({
	name,
	letter,
	bgColor,
	statusText,
	onConfigure,
	className,
}: AgentItemProps) {
	return (
		<div
			className={cn("flex items-center justify-between py-4 px-5", className)}
		>
			<div className="flex items-center gap-3">
				<div
					className="flex items-center justify-center w-10 h-10 rounded-md text-white text-sm font-bold shrink-0"
					style={{ backgroundColor: bgColor }}
				>
					{letter}
				</div>
				<div className="flex flex-col gap-0.5">
					<p className="text-[15px] font-semibold text-primary-foreground">
						{name}
					</p>
					<p className="text-[13px] text-muted">{statusText}</p>
				</div>
			</div>
			<button
				type="button"
				onClick={onConfigure}
				className="flex items-center gap-1.5 rounded-md bg-secondary border border-border px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-hover transition-colors"
			>
				<Settings className="h-3.5 w-3.5 text-secondary-foreground" />
				Configure
			</button>
		</div>
	);
}
