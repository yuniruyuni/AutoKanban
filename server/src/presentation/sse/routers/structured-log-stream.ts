import {
	type StructuredLogParams,
	type StructuredLogState,
	getStructuredLogDelta,
	getStructuredLogSnapshot,
} from "../../../usecases/execution/get-structured-log-delta";
import { sseRoute } from "../stream";

export const structuredLogStreamRoute = sseRoute<
	StructuredLogParams,
	StructuredLogState
>(
	"/structured-logs/:executionProcessId",
	(c) => ({ executionProcessId: c.req.param("executionProcessId") }),
	{
		snapshot: (params) => getStructuredLogSnapshot(params),
		delta: (params, state) => getStructuredLogDelta(params, state),
		interval: 500,
	},
);
