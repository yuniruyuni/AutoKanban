import { useLocation, useNavigate, useParams } from "react-router-dom";
import { paths } from "@/lib/paths";

/**
 * Hook for URL-based task navigation.
 * The URL is the single source of truth for navigation state.
 */
export function useTaskNavigation() {
	const { projectId, taskId } = useParams<{
		projectId: string;
		taskId: string;
	}>();
	const navigate = useNavigate();
	const location = useLocation();

	const isFullscreen = location.pathname.endsWith("/fullscreen");
	const isPanelOpen = !!taskId && !isFullscreen;

	return {
		/** Current project ID from URL */
		projectId,

		/** Current task ID from URL (if any) */
		taskId,

		/** Whether we're in fullscreen task view */
		isFullscreen,

		/** Whether the side panel should be open */
		isPanelOpen,

		/** Navigate to task detail (side panel) */
		openTask: (id: string) => {
			if (projectId) {
				navigate(paths.task(projectId, id));
			}
		},

		/** Navigate to fullscreen task view */
		openFullscreen: (id?: string) => {
			const tid = id ?? taskId;
			if (projectId && tid) {
				navigate(paths.taskFullscreen(projectId, tid));
			}
		},

		/** Close the side panel (back to kanban) */
		closePanel: () => {
			if (projectId) {
				navigate(paths.project(projectId));
			}
		},

		/** Exit fullscreen (back to side panel) */
		exitFullscreen: () => {
			if (projectId && taskId) {
				navigate(paths.task(projectId, taskId));
			}
		},

		/** Navigate to projects list */
		goToProjects: () => {
			navigate(paths.home());
		},

		/** Navigate to a specific project */
		goToProject: (id: string) => {
			navigate(paths.project(id));
		},
	};
}
