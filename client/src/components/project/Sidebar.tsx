import { Cpu, FileText, Folder, Server, Settings, Wrench } from "lucide-react";
import { useState } from "react";
import { paths } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { NavGroup, NavItem } from "./NavItem";

interface SidebarProps {
	className?: string;
}

export function Sidebar({ className }: SidebarProps) {
	const [isSettingsExpanded, setIsSettingsExpanded] = useState(true);

	return (
		<aside
			className={cn(
				"flex flex-col w-[260px] min-w-[260px] h-full bg-secondary gap-6 py-6 px-4",
				"border-r border-border",
				className,
			)}
		>
			{/* Logo */}
			<div className="flex items-center gap-3 px-2">
				<div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent">
					<span className="text-white font-bold text-base">A</span>
				</div>
				<span className="text-lg font-semibold text-primary-foreground">
					Auto Kanban
				</span>
			</div>

			{/* Navigation */}
			<nav className="flex flex-col gap-1">
				<NavItem
					icon={<Folder className="h-[18px] w-[18px]" />}
					label="Projects"
					href={paths.home()}
				/>
				<NavGroup
					icon={<Settings className="h-[18px] w-[18px]" />}
					label="Settings"
					isExpanded={isSettingsExpanded}
					onToggle={() => setIsSettingsExpanded(!isSettingsExpanded)}
				>
					<NavItem
						icon={<Server className="h-4 w-4" />}
						label="MCP Server"
						href={paths.mcpServer()}
						size="sm"
					/>
					<NavItem
						icon={<Cpu className="h-4 w-4" />}
						label="Agent"
						href={paths.agent()}
						size="sm"
					/>
					<NavItem
						icon={<Wrench className="h-4 w-4" />}
						label="Tools"
						href={paths.tools()}
						size="sm"
					/>
					<NavItem
						icon={<FileText className="h-4 w-4" />}
						label="Task Templates"
						href={paths.taskTemplates()}
						size="sm"
					/>
				</NavGroup>
			</nav>
		</aside>
	);
}
