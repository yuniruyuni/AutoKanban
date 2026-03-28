import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavItemProps {
	icon: ReactNode;
	label: string;
	href: string;
	className?: string;
	size?: "default" | "sm";
}

export function NavItem({
	icon,
	label,
	href,
	className,
	size = "default",
}: NavItemProps) {
	const location = useLocation();
	const isActive =
		location.pathname === href || location.pathname.startsWith(`${href}/`);

	return (
		<Link
			to={href}
			className={cn(
				"flex items-center rounded-md font-medium transition-colors w-full",
				size === "sm"
					? "gap-2.5 px-3 py-2 text-[13px]"
					: "gap-3 px-3 py-2.5 text-sm",
				isActive ? "bg-hover text-accent" : "text-primary-foreground hover:bg-hover",
				className,
			)}
		>
			<span
				className={cn(
					isActive ? "text-accent" : "text-secondary-foreground",
					"flex items-center",
				)}
			>
				{icon}
			</span>
			<span>{label}</span>
		</Link>
	);
}

interface NavGroupProps {
	icon: ReactNode;
	label: string;
	isExpanded: boolean;
	onToggle: () => void;
	children: ReactNode;
	className?: string;
}

export function NavGroup({
	icon,
	label,
	isExpanded,
	onToggle,
	children,
	className,
}: NavGroupProps) {
	return (
		<div className={cn("space-y-0.5", className)}>
			<button
				type="button"
				onClick={onToggle}
				className={cn(
					"flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors w-full",
					"text-primary-foreground hover:bg-hover",
				)}
			>
				<div className="flex items-center gap-3">
					<span className="text-secondary-foreground flex items-center">{icon}</span>
					<span>{label}</span>
				</div>
				<ChevronDown
					className={cn(
						"h-4 w-4 text-muted transition-transform",
						!isExpanded && "-rotate-90",
					)}
				/>
			</button>
			{isExpanded && <div className="ml-[30px] space-y-0.5">{children}</div>}
		</div>
	);
}
