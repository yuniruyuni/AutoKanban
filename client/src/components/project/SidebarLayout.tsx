import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

interface SidebarLayoutProps {
	children: ReactNode;
	className?: string;
}

export function SidebarLayout({ children, className }: SidebarLayoutProps) {
	return (
		<div className="flex h-screen bg-primary">
			<Sidebar />
			<main className={cn("flex-1 overflow-auto", className)}>{children}</main>
		</div>
	);
}
