import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
	open: boolean;
	onClose: () => void;
	children: ReactNode;
	className?: string;
	/** Width of the dialog in pixels. Defaults to 480. */
	width?: number;
}

export function Dialog({
	open,
	onClose,
	children,
	className,
	width = 480,
}: DialogProps) {
	const overlayRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		if (open) {
			document.addEventListener("keydown", handleEscape);
			document.body.style.overflow = "hidden";
		}

		return () => {
			document.removeEventListener("keydown", handleEscape);
			document.body.style.overflow = "";
		};
	}, [open, onClose]);

	if (!open) return null;

	const handleOverlayClick = (e: React.MouseEvent) => {
		if (e.target === overlayRef.current) {
			onClose();
		}
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: dialog overlay dismisses on click
		<div
			ref={overlayRef}
			role="presentation"
			onClick={handleOverlayClick}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		>
			<div
				className={cn(
					"relative flex max-h-[90vh] flex-col overflow-hidden rounded-lg border border-border bg-primary shadow-lg",
					className,
				)}
				style={{ width: `${width}px` }}
			>
				{children}
			</div>
		</div>
	);
}

interface DialogHeaderProps {
	children: ReactNode;
	subtitle?: string;
	onClose?: () => void;
	/** Header size variant. 'lg' uses 20px title + 14px subtitle (default). 'md' uses 18px title + 13px subtitle. */
	size?: "md" | "lg";
}

export function DialogHeader({
	children,
	subtitle,
	onClose,
	size = "lg",
}: DialogHeaderProps) {
	return (
		<div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-5">
			<div className="flex flex-col gap-1">
				<h2
					className={cn(
						"font-semibold text-primary-foreground",
						size === "md" ? "text-lg" : "text-xl",
					)}
				>
					{children}
				</h2>
				{subtitle && (
					<p
						className={cn(
							"text-secondary-foreground",
							size === "md" ? "text-[13px]" : "text-sm",
						)}
					>
						{subtitle}
					</p>
				)}
			</div>
			{onClose && (
				<button
					type="button"
					onClick={onClose}
					className="flex h-8 w-8 items-center justify-center rounded-md bg-hover text-muted hover:text-secondary-foreground"
				>
					<X className="h-[18px] w-[18px]" />
				</button>
			)}
		</div>
	);
}

interface DialogContentProps {
	children: ReactNode;
	className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
	return (
		<div
			className={cn(
				"flex min-h-0 flex-col gap-5 overflow-y-auto p-6",
				className,
			)}
		>
			{children}
		</div>
	);
}

interface DialogFooterProps {
	children: ReactNode;
	className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
	return (
		<div
			className={cn(
				"flex flex-shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-4",
				className,
			)}
		>
			{children}
		</div>
	);
}
