import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
	title: string;
	subtitle?: string;
	action?: ReactNode;
	className?: string;
}

export function SectionHeader({
	title,
	subtitle,
	action,
	className,
}: SectionHeaderProps) {
	return (
		<div className={cn("flex items-center justify-between", className)}>
			<div>
				<h3 className="text-base font-semibold text-primary">{title}</h3>
				{subtitle && <p className="text-sm text-muted">{subtitle}</p>}
			</div>
			{action && <div>{action}</div>}
		</div>
	);
}
