import {
	getLogStreamDelta,
	getLogStreamSnapshot,
} from "../../../usecases/execution/get-log-stream-delta";
import { sseRoute } from "../stream";

export const logStreamRoute = sseRoute("/logs/:executionProcessId", {
	snapshot: (params) => getLogStreamSnapshot(params),
	delta: (params, state) => getLogStreamDelta(params, state),
	interval: 200,
});
