import {
	getLogStreamDelta,
	getLogStreamSnapshot,
	type LogStreamParams,
	type LogStreamState,
} from "../../../usecases/execution/get-log-stream-delta";
import { sseRoute } from "../stream";

export const logStreamRoute = sseRoute<LogStreamParams, LogStreamState>(
	"/logs/:executionProcessId",
	(c) => ({ executionProcessId: c.req.param("executionProcessId") }),
	{
		snapshot: (params) => getLogStreamSnapshot(params),
		delta: (params, state) => getLogStreamDelta(params, state),
		interval: 200,
	},
);
