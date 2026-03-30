import type { DraftPullRequest } from "../../models/draft-pull-request";
import type { ServiceCtx } from "../common";

export interface DraftPullRequestRepository {
	create(
		ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
	): DraftPullRequest;
	get(
		ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
	): DraftPullRequest | undefined;
	appendLog(
		ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
		log: string,
	): void;
	complete(
		ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
		title: string,
		body: string,
	): void;
	fail(ctx: ServiceCtx, workspaceId: string, projectId: string): void;
	delete(ctx: ServiceCtx, workspaceId: string, projectId: string): boolean;
}
