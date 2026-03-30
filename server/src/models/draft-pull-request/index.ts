export interface DraftPullRequest {
	workspaceId: string;
	projectId: string;
	status: DraftPullRequest.Status;
	title: string | null;
	body: string | null;
	logs: string;
	createdAt: Date;
	updatedAt: Date;
}

export namespace DraftPullRequest {
	export type Status = "generating" | "completed" | "failed";

	export function create(params: {
		workspaceId: string;
		projectId: string;
	}): DraftPullRequest {
		const now = new Date();
		return {
			workspaceId: params.workspaceId,
			projectId: params.projectId,
			status: "generating",
			title: null,
			body: null,
			logs: "",
			createdAt: now,
			updatedAt: now,
		};
	}
}
