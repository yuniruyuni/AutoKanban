import { Check, Copy, Settings } from "lucide-react";
import { useState } from "react";
import { SidebarLayout } from "@/components/project/SidebarLayout";
import { useServerInfo, useSupportedAgents } from "@/hooks/useMcpConfig";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc";

// Agent configuration metadata
const AGENT_META: Record<
	string,
	{ letter: string; bgColor: string; configAction: "inject" | "manual" }
> = {
	"claude-code": { letter: "CC", bgColor: "#6B4FBB", configAction: "inject" },
	"gemini-cli": { letter: "G", bgColor: "#4285F4", configAction: "manual" },
};

export function MCPServerPage() {
	const [copied, setCopied] = useState(false);
	const [injected, setInjected] = useState<Record<string, boolean>>({});
	const { port, isRunning, mcpCommand } = useServerInfo();
	const { agents } = useSupportedAgents();
	const injectSelf = trpc.mcpConfig.injectSelf.useMutation();

	const argsJson = mcpCommand ? JSON.stringify(mcpCommand.args) : '["--mcp"]';
	const commandStr = mcpCommand?.command ?? "auto-kanban";

	const mcpConfig = `{
  "mcpServers": {
    "auto_kanban": {
      "command": ${JSON.stringify(commandStr)},
      "args": ${argsJson}
    }
  }
}`;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(mcpConfig);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleInject = async (agentId: string) => {
		try {
			await injectSelf.mutateAsync({ agentId });
			setInjected((prev) => ({ ...prev, [agentId]: true }));
			setTimeout(
				() => setInjected((prev) => ({ ...prev, [agentId]: false })),
				3000,
			);
		} catch {
			// Handle error silently
		}
	};

	// All agents including manually-listed ones
	const allAgents = [
		...agents.map((a) => ({
			id: a.agentId,
			name: a.displayName,
			configPath: a.configPath,
		})),
	];

	return (
		<SidebarLayout>
			<div className="flex flex-col gap-8 py-8 px-10">
				{/* Header */}
				<div className="flex flex-col gap-1">
					<h1 className="text-[28px] font-bold text-primary-foreground">
						MCP Server
					</h1>
					<p className="text-sm text-secondary-foreground">
						Connect Auto Kanban to your coding agents via MCP protocol
					</p>
				</div>

				{/* Sections */}
				<div className="flex flex-col gap-4">
					{/* Server Status */}
					<div className="flex items-center gap-3 border border-border rounded-lg py-4 px-5">
						<div
							className={cn(
								"h-2.5 w-2.5 rounded-full shrink-0",
								isRunning ? "bg-success" : "bg-muted",
							)}
						/>
						<div className="flex flex-col gap-0.5">
							<p className="text-sm font-semibold text-primary-foreground">
								{isRunning ? "Server Running" : "Server Not Detected"}
							</p>
							<p className="text-xs text-muted">
								{isRunning
									? `Port ${port}`
									: "Start the Auto Kanban server first"}
							</p>
						</div>
					</div>

					{/* Coding Agent Integration */}
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<div className="flex flex-col gap-1">
								<h2 className="text-base font-semibold text-primary-foreground">
									Coding Agent Integration
								</h2>
								<p className="text-[13px] text-secondary-foreground">
									Connect Auto Kanban MCP server to your coding agents
								</p>
							</div>
						</div>

						<div className="rounded-lg border border-border bg-primary overflow-hidden">
							{allAgents.map((agent, index) => {
								const meta = AGENT_META[agent.id];
								const isInjected = injected[agent.id];
								const hasInjectAction = meta?.configAction === "inject";

								return (
									<div
										key={agent.id}
										className={cn(
											"flex items-center justify-between py-4 px-5",
											index < allAgents.length - 1 && "border-b border-border",
										)}
									>
										<div className="flex items-center gap-3">
											<div
												className="flex h-10 w-10 items-center justify-center rounded-md text-white text-sm font-bold shrink-0"
												style={{ backgroundColor: meta?.bgColor ?? "#6B7280" }}
											>
												{meta?.letter ?? agent.name.charAt(0)}
											</div>
											<div className="flex flex-col gap-0.5">
												<p className="text-sm font-semibold text-primary-foreground">
													{agent.name}
												</p>
												<div className="flex items-center gap-1.5">
													<div
														className={cn(
															"h-2 w-2 rounded-sm shrink-0",
															isInjected ? "bg-success" : "bg-muted",
														)}
													/>
													<p
														className={cn(
															"text-xs",
															isInjected ? "text-success" : "text-muted",
														)}
													>
														{isInjected ? "Connected" : "Not configured"}
													</p>
												</div>
											</div>
										</div>

										<div className="flex items-center gap-2">
											{hasInjectAction ? (
												<button
													type="button"
													onClick={() => handleInject(agent.id)}
													disabled={injectSelf.isPending}
													className="flex items-center gap-1.5 rounded bg-hover px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover/80 transition-colors disabled:opacity-50"
												>
													<Settings className="h-3.5 w-3.5 text-secondary-foreground" />
													Configure
												</button>
											) : (
												<button
													type="button"
													onClick={() => handleInject(agent.id)}
													disabled={injectSelf.isPending}
													className="flex items-center justify-center rounded-md bg-accent text-white px-4 py-2.5 text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
												>
													Setup
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>

						{/* MCP Server Information */}
						<div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary p-5">
							<p className="text-[13px] font-semibold text-muted">
								MCP Server Information
							</p>

							<div className="flex items-center gap-3">
								<pre className="flex-1 bg-[#F6F8FA] border border-border rounded-md p-4 overflow-x-auto text-xs font-mono text-[#24292F] whitespace-pre">
									{mcpConfig}
								</pre>
								<button
									type="button"
									onClick={handleCopy}
									className="flex items-center gap-1.5 self-start rounded-md bg-hover px-3.5 py-2.5 text-[13px] font-medium text-secondary-foreground hover:bg-hover/80 transition-colors shrink-0"
								>
									{copied ? (
										<>
											<Check className="h-4 w-4 text-success" />
											Copied
										</>
									) : (
										<>
											<Copy className="h-4 w-4" />
											Copy
										</>
									)}
								</button>
							</div>

							<p className="text-xs text-muted">
								Add this command to your coding agent&apos;s MCP configuration
								file.
							</p>
						</div>
					</div>
				</div>
			</div>
		</SidebarLayout>
	);
}
