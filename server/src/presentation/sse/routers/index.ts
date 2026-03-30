import { sseRouter } from "../stream";
import { draftPrStreamRoute } from "./draft-pr-stream";
import { logStreamRoute } from "./log-stream";
import { structuredLogStreamRoute } from "./structured-log-stream";

export const sseRoutes = sseRouter(
	logStreamRoute,
	structuredLogStreamRoute,
	draftPrStreamRoute,
);
