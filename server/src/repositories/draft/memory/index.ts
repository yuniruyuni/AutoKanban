import type { Draft } from "../../../models/common";
import type { IDraftRepository } from "../repository";

export class DraftRepository implements IDraftRepository {
	private drafts = new Map<string, Draft>();

	save(sessionId: string, text: string): void {
		this.drafts.set(sessionId, { sessionId, text, savedAt: new Date() });
	}

	get(sessionId: string): Draft | undefined {
		return this.drafts.get(sessionId);
	}

	delete(sessionId: string): boolean {
		return this.drafts.delete(sessionId);
	}

	clear(): void {
		this.drafts.clear();
	}
}

export const draftRepository = new DraftRepository();
