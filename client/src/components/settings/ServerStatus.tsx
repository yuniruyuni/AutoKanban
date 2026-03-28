import { cn } from "@/lib/utils";

interface ServerStatusProps {
	name: string;
	detail: string;
	connected: boolean;
	className?: string;
}

export function ServerStatus({
	name,
	detail,
	connected,
	className,
}: ServerStatusProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-3 border border-border rounded-lg py-4 px-5",
				className,
			)}
		>
			<div
				className={cn(
					"h-2.5 w-2.5 rounded-full shrink-0",
					connected ? "bg-success" : "bg-muted",
				)}
				title={connected ? "Connected" : "Disconnected"}
			/>
			<div className="flex flex-col gap-0.5">
				<p className="text-sm font-semibold text-primary-foreground">{name}</p>
				<p className="text-xs text-muted">{detail}</p>
			</div>
		</div>
	);
}
