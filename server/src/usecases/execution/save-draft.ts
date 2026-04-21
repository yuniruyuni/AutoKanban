// @specre 01KPNSJ3QRGJ28TH90269FY74A
import { fail } from "../../models/common";
import { Session } from "../../models/session";
import { usecase } from "../runner";

export interface SaveDraftInput {
	sessionId: string;
	text: string;
}

export const saveDraft = (input: SaveDraftInput) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}
			return { session };
		},

		post: (ctx) => {
			ctx.repos.draft.save(input.sessionId, input.text);
			return { success: true };
		},
	});

export interface GetDraftInput {
	sessionId: string;
}

export const getDraft = (input: GetDraftInput) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(
				Session.ById(input.sessionId),
			);
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId: input.sessionId,
				});
			}

			return { session };
		},

		post: (ctx) => {
			const draft = ctx.repos.draft.get(input.sessionId);
			return {
				text: draft?.text ?? "",
				savedAt: draft?.savedAt?.toISOString() ?? null,
			};
		},
	});
