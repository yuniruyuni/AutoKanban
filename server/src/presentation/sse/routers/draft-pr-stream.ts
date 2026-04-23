import {
	getDraftPrDelta,
	getDraftPrSnapshot,
} from "../../../usecases/git/get-draft-pr-delta";
import { sseRoute } from "../stream";

export const draftPrStreamRoute = sseRoute(
	"/draft-pr/:workspaceId/:projectId",
	{
		snapshot: (params) => getDraftPrSnapshot(params),
		delta: (params, state) => getDraftPrDelta(params, state),
		interval: 500,
	},
);
