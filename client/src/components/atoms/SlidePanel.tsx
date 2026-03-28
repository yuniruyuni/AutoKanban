import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SlidePanelProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: ReactNode;
	footer?: ReactNode;
	className?: string;
}

export function SlidePanel({
	isOpen,
	onClose,
	title,
	subtitle,
	children,
	footer,
	className,
}: SlidePanelProps) {
	if (!isOpen) return null;

	return (
		<>
			{/* Overlay */}
			<div
				className="fixed inset-0 bg-black/30 z-40"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Panel */}
			<div
				className={cn(
					"fixed top-0 right-0 h-full w-[440px] bg-primary border-l border-border z-50",
					"flex flex-col shadow-xl",
					"animate-in slide-in-from-right duration-200",
					className,
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between py-6 px-7 border-b border-border">
					<div className="space-y-1.5">
						<h2 className="text-xl font-semibold text-primary-foreground">{title}</h2>
						{subtitle && (
							<p className="text-sm font-semibold font-mono text-accent">
								{subtitle}
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center h-9 w-9 rounded-md bg-hover text-secondary-foreground hover:text-primary-foreground transition-colors"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto p-7 flex flex-col gap-6">
					{children}
				</div>

				{/* Footer */}
				{footer && (
					<div className="flex justify-end gap-3 border-t border-border py-5 px-7">
						{footer}
					</div>
				)}
			</div>
		</>
	);
}
