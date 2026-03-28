import { Play, Square } from "lucide-react";
import { useState } from "react";
import { LogViewer } from "@/components/chat/LogViewer";
import type { UseDevServerPreviewResult } from "@/hooks/useDevServerPreview";
import type { LogEntry } from "@/hooks/useLogStream";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
	preview: UseDevServerPreviewResult;
	logs: LogEntry[];
	isStreaming: boolean;
}

export function PreviewPanel({
	preview,
	logs,
	isStreaming,
}: PreviewPanelProps) {
	const { urls, canStart, isRunning, start, stop, status } = preview;
	const [activeSubTab, setActiveSubTab] = useState("logs");

	// Build sub-tabs: each URL + Logs
	const subTabs: { id: string; label: string }[] = [];
	for (let i = 0; i < urls.length; i++) {
		let label: string;
		try {
			label = new URL(urls[i].url).host;
		} catch {
			label = `Preview ${i + 1}`;
		}
		subTabs.push({ id: `url-${i}`, label });
	}
	subTabs.push({ id: "logs", label: "Logs" });

	// If not started yet, show start UI
	if (!isRunning && urls.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				{canStart ? (
					<>
						<p className="text-sm text-[#A1A1AA]">
							{status === "error"
								? "Failed to start preview server"
								: "Preview server is not running"}
						</p>
						<button
							type="button"
							onClick={start}
							className="flex items-center gap-2 rounded-md bg-[#0A0A0B] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
						>
							<Play className="h-4 w-4" />
							Start Preview Server
						</button>
					</>
				) : (
					<p className="text-sm text-[#A1A1AA]">
						No dev server script configured for this project
					</p>
				)}
			</div>
		);
	}

	// If starting/searching but no URLs yet, show waiting state with logs
	if (isRunning && urls.length === 0) {
		return (
			<div className="flex h-full flex-col">
				<SubTabBar
					tabs={[{ id: "logs", label: "Logs" }]}
					activeTab="logs"
					onChange={() => {}}
					isRunning={isRunning}
					onStop={stop}
				/>
				<div className="flex-1 overflow-auto p-4">
					<LogViewer logs={logs} isStreaming={isStreaming} className="h-full" />
				</div>
			</div>
		);
	}

	// Ensure activeSubTab is valid
	const resolvedTab = subTabs.find((t) => t.id === activeSubTab)
		? activeSubTab
		: (subTabs[0]?.id ?? "logs");

	return (
		<div className="flex h-full flex-col">
			<SubTabBar
				tabs={subTabs}
				activeTab={resolvedTab}
				onChange={setActiveSubTab}
				isRunning={isRunning}
				onStop={stop}
			/>
			<div className="flex-1 overflow-hidden">
				{resolvedTab === "logs" ? (
					<div className="h-full overflow-auto p-4">
						<LogViewer
							logs={logs}
							isStreaming={isStreaming}
							className="h-full"
						/>
					</div>
				) : resolvedTab.startsWith("url-") ? (
					<PreviewIframe
						url={urls[Number(resolvedTab.split("-")[1])]?.url ?? ""}
					/>
				) : null}
			</div>
		</div>
	);
}

function SubTabBar({
	tabs,
	activeTab,
	onChange,
	isRunning,
	onStop,
}: {
	tabs: { id: string; label: string }[];
	activeTab: string;
	onChange: (id: string) => void;
	isRunning: boolean;
	onStop: () => void;
}) {
	return (
		<div className="flex items-center border-b border-[#E4E4E7] bg-white">
			<div className="flex flex-1">
				{tabs.map((tab) => (
					<button
						type="button"
						key={tab.id}
						onClick={() => onChange(tab.id)}
						className={cn(
							"px-3 py-2 text-xs transition-colors",
							activeTab === tab.id
								? "font-semibold text-[#0A0A0B] border-b-2 border-[#0A0A0B] -mb-px"
								: "font-medium text-[#A1A1AA] hover:text-[#71717A]",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>
			{isRunning && (
				<button
					type="button"
					onClick={onStop}
					className="mr-2 flex h-6 items-center gap-1 rounded px-2 text-xs text-[#A1A1AA] transition-colors hover:bg-red-50 hover:text-red-600"
					title="Stop preview server"
				>
					<Square className="h-3 w-3" />
					Stop
				</button>
			)}
		</div>
	);
}

function PreviewIframe({ url }: { url: string }) {
	const [isLoading, setIsLoading] = useState(true);

	return (
		<div className="relative h-full w-full">
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center bg-[#F5F5F5]">
					<div className="text-sm text-[#A1A1AA]">Loading preview...</div>
				</div>
			)}
			<iframe
				src={url}
				title={`Preview ${url}`}
				sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
				referrerPolicy="no-referrer"
				className="h-full w-full border-0"
				onLoad={() => setIsLoading(false)}
			/>
		</div>
	);
}
