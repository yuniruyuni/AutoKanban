import { cn } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	subtitle?: string;
	className?: string;
}

export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
	return (
		<div className={cn(className)}>
			<h1 className="text-[28px] font-bold text-primary">{title}</h1>
			{subtitle && <p className="text-sm text-muted">{subtitle}</p>}
		</div>
	);
}
