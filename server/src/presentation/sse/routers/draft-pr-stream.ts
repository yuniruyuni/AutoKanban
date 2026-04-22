import {
	type DraftPrParams,
	type DraftPrState,
	getDraftPrDelta,
	getDraftPrSnapshot,
} from "../../../usecases/git/get-draft-pr-delta";
import { sseRoute } from "../stream";

export const draftPrStreamRoute = sseRoute<DraftPrParams, DraftPrState>(
	"/draft-pr/:workspaceId/:projectId",
	(c) => ({
		workspaceId: c.req.param("workspaceId")!,
		projectId: c.req.param("projectId")!,
	}),
	{
		snapshot: (params) => getDraftPrSnapshot(params),
		delta: (params, state) => getDraftPrDelta(params, state),
		interval: 500,
	},
);
