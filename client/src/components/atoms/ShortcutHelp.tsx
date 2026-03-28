import { useSnapshot } from "valtio";
import { uiActions, uiStore } from "@/store";

interface ShortcutEntry {
	keys: string[];
	description: string;
}

interface ShortcutGroup {
	label: string;
	shortcuts: ShortcutEntry[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
	{
		label: "Navigation",
		shortcuts: [
			{ keys: ["Esc"], description: "Back (panel → kanban → projects)" },
			{ keys: ["Enter"], description: "Fullscreen (side panel)" },
			{ keys: ["J", "K"], description: "Next / previous item" },
			{ keys: ["H", "L"], description: "Move to previous / next lane" },
			{ keys: ["Enter"], description: "Open focused project" },
		],
	},
	{
		label: "Tasks",
		shortcuts: [{ keys: ["C"], description: "Create new task" }],
	},
	{
		label: "Approval",
		shortcuts: [
			{ keys: ["Y"], description: "Approve" },
			{ keys: ["N"], description: "Deny" },
		],
	},
	{
		label: "Other",
		shortcuts: [{ keys: ["?"], description: "Toggle this help" }],
	},
];

export function ShortcutHelp() {
	const { isShortcutHelpOpen } = useSnapshot(uiStore);

	if (!isShortcutHelpOpen) return null;

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: click-to-close overlay
		// biome-ignore lint/a11y/noStaticElementInteractions: click-to-close overlay
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={() => uiActions.closeShortcutHelp()}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation on content */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation on content */}
			<div
				className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="text-lg font-semibold text-foreground mb-4">
					Keyboard Shortcuts
				</h2>
				<div className="space-y-4">
					{SHORTCUT_GROUPS.map((group) => (
						<div key={group.label}>
							<h3 className="text-xs font-medium text-secondary-foreground uppercase tracking-wider mb-2">
								{group.label}
							</h3>
							<div className="space-y-1">
								{group.shortcuts.map((shortcut) => (
									<div
										key={shortcut.description}
										className="flex items-center justify-between py-1"
									>
										<span className="text-sm text-foreground">
											{shortcut.description}
										</span>
										<div className="flex gap-1">
											{shortcut.keys.map((key) => (
												<kbd
													key={key}
													className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded text-secondary-foreground"
												>
													{key}
												</kbd>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
