import {
	getStructuredLogDelta,
	getStructuredLogSnapshot,
} from "../../../usecases/execution/get-structured-log-delta";
import { sseRoute } from "../stream";

export const structuredLogStreamRoute = sseRoute(
	"/structured-logs/:executionProcessId",
	{
		snapshot: (params) => getStructuredLogSnapshot(params),
		delta: (params, state) => getStructuredLogDelta(params, state),
		interval: 500,
	},
);
