// @specre 01KPNTBSGA7XMKDE21TYM00R7Y
import { Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { SidebarLayout } from "@/components/project/SidebarLayout";
import { paths } from "@/lib/paths";
import { cn } from "@/lib/utils";

interface AgentConfig {
	id: string;
	name: string;
	letter: string;
	bgColor: string;
	variantCount: number;
}

function AgentCard({ id, name, letter, bgColor, variantCount }: AgentConfig) {
	return (
		<div className="flex items-center justify-between py-4 px-5 border-b border-border last:border-b-0">
			<div className="flex items-center gap-3">
				<div
					className="flex items-center justify-center w-10 h-10 rounded-md text-white text-sm font-bold shrink-0"
					style={{ backgroundColor: bgColor }}
				>
					{letter}
				</div>
				<div className="flex flex-col gap-0.5">
					<h3 className="text-[15px] font-semibold text-primary-foreground">
						{name}
					</h3>
					<p className="text-[13px] text-muted">
						{variantCount > 0
							? `${variantCount} variant${variantCount !== 1 ? "s" : ""} configured`
							: "No variants configured"}
					</p>
				</div>
			</div>
			<Link
				to={paths.agentDetail(id)}
				className={cn(
					"flex items-center gap-1.5 rounded-md bg-secondary border border-border px-4 py-2 text-[13px] font-medium text-primary-foreground",
					"hover:bg-hover transition-colors",
				)}
			>
				<Settings className="h-3.5 w-3.5 text-secondary-foreground" />
				Configure
			</Link>
		</div>
	);
}

const AGENTS: AgentConfig[] = [
	{
		id: "claude-code",
		name: "Claude Code",
		letter: "CC",
		bgColor: "#E87B35",
		variantCount: 4,
	},
	{
		id: "gemini-cli",
		name: "Gemini CLI",
		letter: "G",
		bgColor: "#4285F4",
		variantCount: 0,
	},
];

export function AgentPage() {
	return (
		<SidebarLayout>
			<div className="flex flex-col gap-8 py-8 px-10">
				{/* Header */}
				<div className="flex flex-col gap-1">
					<h1 className="text-[28px] font-bold text-primary-foreground">
						Agent
					</h1>
					<p className="text-sm text-secondary-foreground">
						Configure how Auto Kanban sends requests to coding agents
					</p>
				</div>

				{/* Agents List */}
				<div className="flex flex-col gap-4">
					<h2 className="text-base font-semibold text-primary-foreground">
						Available Agents
					</h2>
					<div className="rounded-lg border border-border bg-primary overflow-hidden">
						{AGENTS.map((agent) => (
							<AgentCard key={agent.id} {...agent} />
						))}
					</div>
				</div>
			</div>
		</SidebarLayout>
	);
}
