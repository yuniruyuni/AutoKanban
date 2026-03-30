import { DraftPullRequest } from "../../../models/draft-pull-request";
import type { ServiceCtx } from "../../common";
import type { DraftPullRequestRepository as DraftPullRequestRepositoryDef } from "../repository";

export class DraftPullRequestRepository
	implements DraftPullRequestRepositoryDef
{
	private drafts = new Map<string, DraftPullRequest>();

	private key(workspaceId: string, projectId: string): string {
		return `${workspaceId}:${projectId}`;
	}

	create(
		_ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
	): DraftPullRequest {
		const draft = DraftPullRequest.create({ workspaceId, projectId });
		this.drafts.set(this.key(workspaceId, projectId), draft);
		return draft;
	}

	get(
		_ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
	): DraftPullRequest | undefined {
		return this.drafts.get(this.key(workspaceId, projectId));
	}

	appendLog(
		_ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
		log: string,
	): void {
		const draft = this.drafts.get(this.key(workspaceId, projectId));
		if (!draft) return;
		draft.logs += log;
		draft.updatedAt = new Date();
	}

	complete(
		_ctx: ServiceCtx,
		workspaceId: string,
		projectId: string,
		title: string,
		body: string,
	): void {
		const draft = this.drafts.get(this.key(workspaceId, projectId));
		if (!draft) return;
		draft.status = "completed";
		draft.title = title;
		draft.body = body;
		draft.updatedAt = new Date();
	}

	fail(_ctx: ServiceCtx, workspaceId: string, projectId: string): void {
		const draft = this.drafts.get(this.key(workspaceId, projectId));
		if (!draft) return;
		draft.status = "failed";
		draft.updatedAt = new Date();
	}

	delete(_ctx: ServiceCtx, workspaceId: string, projectId: string): boolean {
		return this.drafts.delete(this.key(workspaceId, projectId));
	}
}

export const draftPullRequestRepository = new DraftPullRequestRepository();
