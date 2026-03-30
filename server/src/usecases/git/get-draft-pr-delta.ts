import type { DraftPullRequest } from "../../models/draft-pull-request";
import type { SSEDeltaResult } from "../../models/sse";
import { usecase } from "../runner";

// ============================================
// Params & State
// ============================================

export interface DraftPrParams {
	workspaceId: string;
	projectId: string;
}

export interface DraftPrState {
	logOffset: number;
	lastStatus: DraftPullRequest.Status | null;
}

// ============================================
// Snapshot usecase
// ============================================

export const getDraftPrSnapshot = (params: DraftPrParams) =>
	usecase({
		post: (ctx): SSEDeltaResult<DraftPrState> => {
			const draft = ctx.repos.draftPullRequest.get(
				params.workspaceId,
				params.projectId,
			);
			if (!draft) {
				return {
					events: [],
					state: { logOffset: 0, lastStatus: null },
				};
			}

			const events = [
				{
					type: "snapshot",
					data: {
						status: draft.status,
						title: draft.title,
						body: draft.body,
						logs: draft.logs,
					},
				},
			];

			return {
				events,
				state: { logOffset: draft.logs.length, lastStatus: draft.status },
			};
		},
	});

// ============================================
// Delta usecase
// ============================================

export const getDraftPrDelta = (params: DraftPrParams, state: DraftPrState) =>
	usecase({
		post: (ctx): SSEDeltaResult<DraftPrState> => {
			const draft = ctx.repos.draftPullRequest.get(
				params.workspaceId,
				params.projectId,
			);
			if (!draft) {
				return { events: [], state };
			}

			const events = [];

			// New log data
			if (draft.logs.length > state.logOffset) {
				events.push({
					type: "log",
					data: { data: draft.logs.slice(state.logOffset) },
				});
			}

			// Status change
			if (draft.status !== state.lastStatus) {
				events.push({
					type: "status_changed",
					data: {
						status: draft.status,
						title: draft.title,
						body: draft.body,
					},
				});
			}

			return {
				events,
				state: { logOffset: draft.logs.length, lastStatus: draft.status },
			};
		},
	});
