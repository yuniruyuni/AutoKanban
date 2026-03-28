import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	label?: string;
	error?: string;
	options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
	({ className, label, error, options, id, ...props }, ref) => {
		const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

		return (
			<div className="flex flex-col gap-2">
				{label && (
					<label
						htmlFor={selectId}
						className="text-sm font-medium text-primary-foreground"
					>
						{label}
					</label>
				)}
				<select
					ref={ref}
					id={selectId}
					className={cn(
						"flex h-10 w-full rounded-md border border-border bg-primary px-3 py-2 text-sm text-primary-foreground",
						"focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-0",
						"disabled:cursor-not-allowed disabled:opacity-50",
						error && "border-destructive focus:ring-destructive",
						className,
					)}
					{...props}
				>
					{options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>
		);
	},
);

Select.displayName = "Select";

export { Select };
