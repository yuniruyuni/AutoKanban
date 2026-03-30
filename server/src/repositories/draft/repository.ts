import type { Draft } from "../../models/common";
import type { ServiceCtx } from "../common";

export interface DraftRepository {
	save(ctx: ServiceCtx, sessionId: string, text: string): void;
	get(ctx: ServiceCtx, sessionId: string): Draft | undefined;
	delete(ctx: ServiceCtx, sessionId: string): boolean;
	clear(ctx: ServiceCtx): void;
}
