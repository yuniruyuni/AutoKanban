import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?:
		| "default"
		| "outline"
		| "ghost"
		| "destructive"
		| "warning"
		| "accent";
	size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant = "default", size = "md", ...props }, ref) => {
		return (
			<button
				ref={ref}
				className={cn(
					"inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
					"disabled:pointer-events-none disabled:opacity-50",
					{
						"bg-accent text-white hover:bg-accent/90":
							variant === "default" || variant === "accent",
						"border border-border bg-secondary text-primary-foreground hover:bg-hover":
							variant === "outline",
						"hover:bg-hover": variant === "ghost",
						"bg-destructive text-white hover:bg-destructive/90":
							variant === "destructive",
						"bg-warning text-white hover:bg-warning/90": variant === "warning",
					},
					{
						"h-8 px-3 text-sm": size === "sm",
						"px-4 py-2.5 text-sm": size === "md",
						"h-12 px-6 text-base": size === "lg",
					},
					className,
				)}
				{...props}
			/>
		);
	},
);

Button.displayName = "Button";

export { Button };
