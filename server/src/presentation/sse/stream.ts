import type { Hono } from "hono";
import type { Context as HonoContext } from "hono";
import { streamSSE } from "hono/streaming";
import type { Context } from "../../usecases/context";
import type { Usecase } from "../../usecases/runner";

export interface SSEEvent {
	type: string;
	data: unknown;
}

export interface SSEDeltaResult<TState> {
	events: SSEEvent[];
	state: TState;
}

export interface SSEStreamDef<TParams, TState> {
	snapshot: (params: TParams) => Usecase<SSEDeltaResult<TState>>;
	delta: (params: TParams, state: TState) => Usecase<SSEDeltaResult<TState>>;
	interval?: number;
}

export function registerSSERoute<TParams, TState>(
	app: Hono,
	path: string,
	ctx: Context,
	extractParams: (c: HonoContext) => TParams,
	def: SSEStreamDef<TParams, TState>,
): void {
	const interval = def.interval ?? 500;

	app.get(path, async (c) => {
		const params = extractParams(c);

		return streamSSE(c, async (stream) => {
			const controller = new AbortController();
			stream.onAbort(() => controller.abort());

			// Snapshot
			const snap = await def.snapshot(params).run(ctx);
			if (!snap.ok) return;
			let state = snap.value.state;
			for (const event of snap.value.events) {
				await stream.writeSSE({
					event: event.type,
					data: JSON.stringify(event.data),
				});
			}

			// Delta loop
			while (!controller.signal.aborted) {
				await sleep(interval, controller.signal);
				if (controller.signal.aborted) break;

				const delta = await def.delta(params, state).run(ctx);
				if (!delta.ok) continue;
				state = delta.value.state;

				for (const event of delta.value.events) {
					await stream.writeSSE({
						event: event.type,
						data: JSON.stringify(event.data),
					});
				}
			}
		});
	});
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
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
