import type { Context as HonoContext, MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ParamKeys } from "hono/types";
import type { SSEDeltaResult } from "../../models/sse";
import type { Context } from "../../usecases/context";
import type { Usecase } from "../../usecases/runner";

export type { SSEDeltaResult, SSEEvent } from "../../models/sse";

export type PathParams<Path extends string> = {
	[K in ParamKeys<Path>]: string;
};

function extractPathParams<TPath extends string>(
	path: TPath,
	c: HonoContext,
): PathParams<TPath> {
	const params: Record<string, string> = {};
	for (const segment of path.split("/")) {
		if (!segment.startsWith(":")) continue;
		const name = segment.slice(1);
		const value = c.req.param(name);
		if (value === undefined) {
			throw new Error(
				`sseRoute: missing path param "${name}" on route "${path}"`,
			);
		}
		params[name] = value;
	}
	return params as PathParams<TPath>;
}

export interface SSEStreamDef<TParams, TState> {
	snapshot: (params: TParams) => Usecase<SSEDeltaResult<TState>>;
	delta: (params: TParams, state: TState) => Usecase<SSEDeltaResult<TState>>;
	interval?: number;
}

export interface SSERoute {
	mount(app: Hono, ctx: Context): void;
}

export const STREAM_ERROR_THRESHOLD = 3;
export const MAX_BACKOFF_MS = 5000;

export function computeDeltaInterval(
	baseInterval: number,
	consecutiveFailures: number,
): number {
	if (consecutiveFailures <= 0) return baseInterval;
	return Math.min(baseInterval * 2 ** consecutiveFailures, MAX_BACKOFF_MS);
}

export interface SSEWriter {
	writeSSE(event: { event: string; data: string }): Promise<void>;
}

export interface DeltaLoopOptions<TParams, TState> {
	ctx: Context;
	path: string;
	params: TParams;
	initialState: TState;
	delta: (params: TParams, state: TState) => Usecase<SSEDeltaResult<TState>>;
	baseInterval: number;
	signal: AbortSignal;
	writer: SSEWriter;
	failureThreshold?: number;
}

export async function runDeltaLoop<TParams, TState>(
	opts: DeltaLoopOptions<TParams, TState>,
): Promise<void> {
	const threshold = opts.failureThreshold ?? STREAM_ERROR_THRESHOLD;
	let state = opts.initialState;
	let consecutiveFailures = 0;

	while (!opts.signal.aborted) {
		const wait = computeDeltaInterval(opts.baseInterval, consecutiveFailures);
		await sleep(wait, opts.signal);
		if (opts.signal.aborted) break;

		const delta = await opts.delta(opts.params, state).run(opts.ctx);
		if (!delta.ok) {
			consecutiveFailures += 1;
			opts.ctx.logger.error("[sse] delta failed", {
				path: opts.path,
				params: opts.params,
				code: delta.error.code,
				message: delta.error.message,
				consecutiveFailures,
			});
			if (consecutiveFailures >= threshold) {
				await opts.writer.writeSSE({
					event: "stream-error",
					data: JSON.stringify({
						code: delta.error.code,
						message: delta.error.message,
						consecutiveFailures,
					}),
				});
			}
			continue;
		}
		consecutiveFailures = 0;
		state = delta.value.state;

		for (const event of delta.value.events) {
			await opts.writer.writeSSE({
				event: event.type,
				data: JSON.stringify(event.data),
			});
		}
	}
}

/**
 * Define a single SSE route. Path params are inferred from the literal path.
 */
export function sseRoute<TPath extends string, TState>(
	path: TPath,
	def: SSEStreamDef<PathParams<TPath>, TState>,
): SSERoute {
	return {
		mount(app, ctx) {
			const interval = def.interval ?? 500;

			app.get(path, async (c) => {
				const params = extractPathParams(path, c);

				return streamSSE(c, async (stream) => {
					const controller = new AbortController();
					stream.onAbort(() => controller.abort());

					const snap = await def.snapshot(params).run(ctx);
					if (!snap.ok) {
						ctx.logger.error("[sse] snapshot failed", {
							path,
							params,
							code: snap.error.code,
							message: snap.error.message,
						});
						await stream.writeSSE({
							event: "stream-error",
							data: JSON.stringify({
								code: snap.error.code,
								message: snap.error.message,
								phase: "snapshot",
							}),
						});
						return;
					}
					const initialState = snap.value.state;
					for (const event of snap.value.events) {
						await stream.writeSSE({
							event: event.type,
							data: JSON.stringify(event.data),
						});
					}

					await runDeltaLoop({
						ctx,
						path,
						params,
						initialState,
						delta: def.delta,
						baseInterval: interval,
						signal: controller.signal,
						writer: stream,
					});
				});
			});
		},
	};
}

/**
 * Aggregate multiple SSE routes.
 */
export function sseRouter(...routes: SSERoute[]): SSERoute {
	return {
		mount(app, ctx) {
			for (const route of routes) {
				route.mount(app, ctx);
			}
		},
	};
}

/**
 * Create a Hono middleware for SSE routes.
 * Mount with: app.use("/sse/*", sseServer({ routes, ctx }))
 */
export function sseServer(options: {
	routes: SSERoute;
	ctx: Context;
}): MiddlewareHandler {
	const app = new Hono().basePath("/sse");
	options.routes.mount(app, options.ctx);
	return async (c, next) => {
		const res = await app.fetch(c.req.raw);
		if (res.status !== 404) return res;
		await next();
	};
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
	if (signal.aborted) return Promise.resolve();
	return new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}
