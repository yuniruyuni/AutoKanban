import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
	extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, label, error, id, ...props }, ref) => {
		const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

		return (
			<div className="flex flex-col gap-2">
				{label && (
					<label
						htmlFor={textareaId}
						className="text-sm font-medium text-primary-foreground"
					>
						{label}
					</label>
				)}
				<textarea
					ref={ref}
					id={textareaId}
					className={cn(
						"flex min-h-[80px] w-full rounded-md border border-border bg-primary px-3.5 py-3 text-sm text-primary-foreground",
						"placeholder:text-muted",
						"focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-0",
						"disabled:cursor-not-allowed disabled:opacity-50",
						error && "border-destructive focus:ring-destructive",
						className,
					)}
					{...props}
				/>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>
		);
	},
);

Textarea.displayName = "Textarea";

export { Textarea };
