// @specre 01KPNSJ3QRGJ28TH90269FY74A
import { fail } from "../../models/common";
import { Session } from "../../models/session";
import { usecase } from "../runner";

export const saveDraft = (sessionId: string, text: string) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId,
				});
			}
			return { session };
		},

		post: (ctx) => {
			ctx.repos.draft.save(sessionId, text);
			return { success: true };
		},
	});

export const getDraft = (sessionId: string) =>
	usecase({
		read: async (ctx) => {
			const session = await ctx.repos.session.get(Session.ById(sessionId));
			if (!session) {
				return fail("NOT_FOUND", "Session not found", {
					sessionId,
				});
			}

			return { session };
		},

		post: (ctx) => {
			const draft = ctx.repos.draft.get(sessionId);
			return {
				text: draft?.text ?? "",
				savedAt: draft?.savedAt?.toISOString() ?? null,
			};
		},
	});
