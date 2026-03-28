import { useEffect } from "react";
import { useSnapshot } from "valtio";
import type { ProjectWithStats } from "@/store";
import { uiActions, uiStore } from "@/store";

interface ProjectKeyboardNavOptions {
	projects: ProjectWithStats[];
	onSelect: (projectId: string) => void;
}

function shouldIgnoreKeypress(e: KeyboardEvent): boolean {
	const tag = (e.target as HTMLElement)?.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if ((e.target as HTMLElement)?.isContentEditable) return true;
	if (document.body.style.overflow === "hidden") return true;
	return false;
}

export function useProjectKeyboardNav({
	projects,
	onSelect,
}: ProjectKeyboardNavOptions) {
	const { focusedProjectId } = useSnapshot(uiStore);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.defaultPrevented) return;
			if (shouldIgnoreKeypress(e)) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			if (e.key === "?") {
				uiActions.toggleShortcutHelp();
				return;
			}

			if (e.key !== "j" && e.key !== "k" && e.key !== "Enter") return;
			if (projects.length === 0) return;

			if (e.key === "Enter") {
				if (focusedProjectId) {
					onSelect(focusedProjectId);
				}
				return;
			}

			// j/k navigation
			const currentIndex = focusedProjectId
				? projects.findIndex((p) => p.id === focusedProjectId)
				: -1;

			let nextIndex: number;
			if (e.key === "j") {
				nextIndex = currentIndex < projects.length - 1 ? currentIndex + 1 : currentIndex;
			} else {
				nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
			}

			const nextProject = projects[nextIndex];
			uiActions.focusProject(nextProject.id);

			requestAnimationFrame(() => {
				const el = document.querySelector(
					`[data-project-id="${nextProject.id}"]`,
				);
				el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
			});
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [projects, focusedProjectId, onSelect]);

	// Clear focus when unmounting (leaving the page)
	useEffect(() => {
		return () => uiActions.focusProject(null);
	}, []);
}
