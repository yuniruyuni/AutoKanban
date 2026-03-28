import { useEffect } from "react";
import { useSnapshot } from "valtio";
import { uiActions, uiStore } from "@/store";
import { useTaskNavigation } from "./useTaskNavigation";

/**
 * Escape key navigation:
 * - Shortcut help open → close help
 * - Fullscreen → exit to side panel
 * - Side panel → close to kanban board
 *
 * Skipped when a dialog is open or focus is in a text input.
 */
export function useEscapeNavigation() {
	const {
		isFullscreen,
		isPanelOpen,
		exitFullscreen,
		closePanel,
		goToProjects,
	} = useTaskNavigation();
	const { isShortcutHelpOpen } = useSnapshot(uiStore);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;

			// Don't interfere with inputs or textareas
			const tag = (e.target as HTMLElement)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if ((e.target as HTMLElement)?.isContentEditable) return;

			// Don't interfere with open dialogs (Dialog sets body overflow hidden)
			if (document.body.style.overflow === "hidden") return;

			// Close shortcut help first if open
			if (isShortcutHelpOpen) {
				uiActions.closeShortcutHelp();
				return;
			}

			if (isFullscreen) {
				exitFullscreen();
			} else if (isPanelOpen) {
				closePanel();
			} else {
				goToProjects();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		isFullscreen,
		isPanelOpen,
		exitFullscreen,
		closePanel,
		goToProjects,
		isShortcutHelpOpen,
	]);
}
