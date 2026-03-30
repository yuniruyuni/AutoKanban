import type { Hono } from "hono";
import type { Context } from "../../../usecases/context";
import {
	type StructuredLogParams,
	type StructuredLogState,
	getStructuredLogDelta,
	getStructuredLogSnapshot,
} from "../../../usecases/execution/get-structured-log-delta";
import type { SSEStreamDef } from "../stream";
import { registerSSERoute } from "../stream";

const structuredLogStream: SSEStreamDef<
	StructuredLogParams,
	StructuredLogState
> = {
	snapshot: (params) => getStructuredLogSnapshot(params),
	delta: (params, state) => getStructuredLogDelta(params, state),
	interval: 500,
};

export function registerStructuredLogStreamRoute(
	app: Hono,
	ctx: Context,
): void {
	registerSSERoute(
		app,
		"/sse/structured-logs/:executionProcessId",
		ctx,
		(c) => ({ executionProcessId: c.req.param("executionProcessId") }),
		structuredLogStream,
	);
}
