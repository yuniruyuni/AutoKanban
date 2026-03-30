import type { Hono } from "hono";
import type { Context } from "../../../usecases/context";
import {
	type LogStreamParams,
	type LogStreamState,
	getLogStreamDelta,
	getLogStreamSnapshot,
} from "../../../usecases/execution/get-log-stream-delta";
import type { SSEStreamDef } from "../stream";
import { registerSSERoute } from "../stream";

const logStream: SSEStreamDef<LogStreamParams, LogStreamState> = {
	snapshot: (params) => getLogStreamSnapshot(params),
	delta: (params, state) => getLogStreamDelta(params, state),
	interval: 200,
};

export function registerLogStreamRoute(app: Hono, ctx: Context): void {
	registerSSERoute(
		app,
		"/sse/logs/:executionProcessId",
		ctx,
		(c) => ({ executionProcessId: c.req.param("executionProcessId") }),
		logStream,
	);
}
