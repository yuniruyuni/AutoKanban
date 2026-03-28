import { cn } from "@/lib/utils";

interface ToggleProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
	className?: string;
}

export function Toggle({
	checked,
	onChange,
	disabled = false,
	className,
}: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer rounded-full transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
				"disabled:cursor-not-allowed disabled:opacity-50",
				checked ? "bg-accent" : "bg-secondary border border-border",
				className,
			)}
		>
			<span
				className={cn(
					"pointer-events-none inline-block h-[20px] w-[20px] rounded-full bg-white shadow-sm transition-transform",
					checked ? "translate-x-[24px]" : "translate-x-[2px]",
					checked ? "" : "border border-border",
					"mt-[2px]",
				)}
			/>
		</button>
	);
}
