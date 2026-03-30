import type { Draft } from "../../../models/common";
import type { ServiceCtx } from "../../../types/db-capability";
import type { DraftRepository as DraftRepositoryDef } from "../repository";

export class DraftRepository implements DraftRepositoryDef {
	private drafts = new Map<string, Draft>();

	save(_ctx: ServiceCtx, sessionId: string, text: string): void {
		this.drafts.set(sessionId, { sessionId, text, savedAt: new Date() });
	}

	get(_ctx: ServiceCtx, sessionId: string): Draft | undefined {
		return this.drafts.get(sessionId);
	}

	delete(_ctx: ServiceCtx, sessionId: string): boolean {
		return this.drafts.delete(sessionId);
	}

	clear(_ctx: ServiceCtx): void {
		this.drafts.clear();
	}
}

export const draftRepository = new DraftRepository();
