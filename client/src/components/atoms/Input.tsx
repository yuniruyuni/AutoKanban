import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, label, error, id, ...props }, ref) => {
		const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

		return (
			<div className="flex flex-col gap-2">
				{label && (
					<label
						htmlFor={inputId}
						className="text-sm font-medium text-primary-foreground"
					>
						{label}
					</label>
				)}
				<input
					ref={ref}
					id={inputId}
					className={cn(
						"flex h-10 w-full rounded-md border border-border bg-primary px-3.5 py-2 text-sm text-primary-foreground",
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

Input.displayName = "Input";

export { Input };
