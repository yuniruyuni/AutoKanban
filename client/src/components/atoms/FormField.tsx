import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
	label: string;
	description?: string;
	children: ReactNode;
	className?: string;
}

export function FormField({
	label,
	description,
	children,
	className,
}: FormFieldProps) {
	return (
		<div className={cn("space-y-1.5", className)}>
			<span className="block text-sm font-medium text-primary">{label}</span>
			{description && <p className="text-sm text-muted">{description}</p>}
			{children}
		</div>
	);
}
