import { sseRouter } from "../stream";
import { logStreamRoute } from "./log-stream";
import { structuredLogStreamRoute } from "./structured-log-stream";

export const sseRoutes = sseRouter(logStreamRoute, structuredLogStreamRoute);
