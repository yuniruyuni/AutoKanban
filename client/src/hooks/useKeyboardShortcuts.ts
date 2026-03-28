import { useEffect } from "react";
import type { Task } from "@/store";
import { uiActions } from "@/store";
import { KANBAN_COLUMNS } from "@/lib/constants";

interface KeyboardShortcutsOptions {
	taskId: string | undefined;
	isFullscreen: boolean;
	isPanelOpen: boolean;
	openFullscreen: (id?: string) => void;
	openTask: (id: string) => void;
	tasks: Task[];
}

function shouldIgnoreKeypress(e: KeyboardEvent): boolean {
	const tag = (e.target as HTMLElement)?.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
	if ((e.target as HTMLElement)?.isContentEditable) return true;
	if (document.body.style.overflow === "hidden") return true;
	return false;
}

/**
 * Build a flat task list ordered by KANBAN_COLUMNS, then by array order within each column.
 */
function buildOrderedTaskList(tasks: Task[]): Task[] {
	const result: Task[] = [];
	for (const status of KANBAN_COLUMNS) {
		for (const task of tasks) {
			if (task.status === status) {
				result.push(task);
			}
		}
	}
	return result;
}

export function useKeyboardShortcuts({
	taskId,
	isFullscreen,
	isPanelOpen,
	openFullscreen,
	openTask,
	tasks,
}: KeyboardShortcutsOptions) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.defaultPrevented) return;

			if (shouldIgnoreKeypress(e)) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;

			switch (e.key) {
				case "c":
					if (!isPanelOpen && !isFullscreen) {
						e.preventDefault();
						uiActions.openCreateTask();
					}
					break;

				case "?":
					uiActions.toggleShortcutHelp();
					break;

				case "Enter":
					if (isPanelOpen && !isFullscreen && taskId) {
						e.preventDefault();
						openFullscreen(taskId);
					}
					break;

				case "j":
				case "k":
				case "h":
				case "l": {
					// In fullscreen mode, these keys are handled by TaskDetailFullscreen
					if (isFullscreen) break;

					const ordered = buildOrderedTaskList(tasks);
					if (ordered.length === 0) break;

					// No active task: select the first task
					if (!taskId || (!isPanelOpen && !isFullscreen)) {
						openTask(ordered[0].id);
						requestAnimationFrame(() => {
							const el = document.querySelector(
								`[data-task-id="${ordered[0].id}"]`,
							);
							el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
						});
						break;
					}

					const currentIndex = ordered.findIndex(
						(t) => t.id === taskId,
					);
					if (currentIndex === -1) {
						openTask(ordered[0].id);
						break;
					}

					let nextIndex: number | null = null;

					if (e.key === "j" || e.key === "k") {
						// j/k: move within lane, wrap to next/prev lane at boundaries
						const currentStatus = ordered[currentIndex].status;
						const colIdx = KANBAN_COLUMNS.indexOf(currentStatus);
						const laneTaskIds = ordered
							.map((t, i) => ({ t, i }))
							.filter(({ t }) => t.status === currentStatus);
						const lanePos = laneTaskIds.findIndex(
							({ i }) => i === currentIndex,
						);

						if (e.key === "j") {
							if (lanePos < laneTaskIds.length - 1) {
								nextIndex = laneTaskIds[lanePos + 1].i;
							} else {
								// Wrap to the first task in the next non-empty lane
								for (let c = colIdx + 1; c < KANBAN_COLUMNS.length; c++) {
									const lane = ordered.filter(
										(t) => t.status === KANBAN_COLUMNS[c],
									);
									if (lane.length > 0) {
										nextIndex = ordered.indexOf(lane[0]);
										break;
									}
								}
							}
						} else {
							if (lanePos > 0) {
								nextIndex = laneTaskIds[lanePos - 1].i;
							} else {
								// Wrap to the last task in the previous non-empty lane
								for (let c = colIdx - 1; c >= 0; c--) {
									const lane = ordered.filter(
										(t) => t.status === KANBAN_COLUMNS[c],
									);
									if (lane.length > 0) {
										nextIndex = ordered.indexOf(lane[lane.length - 1]);
										break;
									}
								}
							}
						}
					} else {
						// h/l: move across lanes
						const currentStatus = ordered[currentIndex].status;
						const colIdx = KANBAN_COLUMNS.indexOf(currentStatus);
						const targetColIdx =
							e.key === "l" ? colIdx + 1 : colIdx - 1;
						if (
							targetColIdx < 0 ||
							targetColIdx >= KANBAN_COLUMNS.length
						)
							break;
						const targetStatus = KANBAN_COLUMNS[targetColIdx];
						const laneTasks = ordered.filter(
							(t) => t.status === targetStatus,
						);
						if (laneTasks.length > 0) {
							// Pick the first task in the target lane
							nextIndex = ordered.indexOf(laneTasks[0]);
						}
					}

					if (nextIndex !== null) {
						const nextTask = ordered[nextIndex];
						if (isFullscreen) {
							openFullscreen(nextTask.id);
						} else {
							openTask(nextTask.id);
						}
						// Scroll the active card into view
						requestAnimationFrame(() => {
							const el = document.querySelector(
								`[data-task-id="${nextTask.id}"]`,
							);
							el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
						});
					}
					break;
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [taskId, isFullscreen, isPanelOpen, openFullscreen, openTask, tasks]);
}
