/**
 * Plain-fetch tRPC HTTP client for non-batch single requests.
 *
 * Wire format (non-batch, no transformer):
 *   Query  : GET  /trpc/<proc>?input=<JSON>
 *   Mutate : POST /trpc/<proc>  body=<JSON>
 *   Response: { "result": { "data": <value> } }
 */

const DEFAULT_TIMEOUT_MS = 10_000;

function envTimeoutMs(): number | undefined {
	const raw = process.env.AUTO_KANBAN_TRPC_TIMEOUT_MS;
	if (!raw) return undefined;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

export interface TrpcHttpClientOptions {
	requestTimeoutMs?: number;
}

export class TrpcHttpClient {
	private readonly requestTimeoutMs: number;

	constructor(
		private baseUrl: string,
		options: TrpcHttpClientOptions = {},
	) {
		this.requestTimeoutMs =
			options.requestTimeoutMs ?? envTimeoutMs() ?? DEFAULT_TIMEOUT_MS;
	}

	private async fetchWithTimeout(
		kind: "query" | "mutation",
		endpoint: string,
		input: string | URL,
		init?: RequestInit,
	): Promise<Response> {
		try {
			return await fetch(input, {
				...init,
				signal: AbortSignal.timeout(this.requestTimeoutMs),
			});
		} catch (err) {
			if (err instanceof Error && err.name === "TimeoutError") {
				throw new Error(
					`tRPC ${kind} ${endpoint} timed out after ${this.requestTimeoutMs / 1000}s`,
				);
			}
			throw err;
		}
	}

	async query<T>(endpoint: string, input?: unknown): Promise<T> {
		const url = new URL(`${this.baseUrl}/trpc/${endpoint}`);
		if (input !== undefined) {
			url.searchParams.set("input", JSON.stringify(input));
		}
		const res = await this.fetchWithTimeout("query", endpoint, url);
		if (!res.ok) {
			throw new Error(
				`tRPC query ${endpoint} failed: ${res.status} ${res.statusText}`,
			);
		}
		const data = (await res.json()) as {
			error?: { message?: string };
			result: { data: T };
		};
		if (data.error)
			throw new Error(data.error.message ?? JSON.stringify(data.error));
		return data.result.data;
	}

	async mutation<T>(endpoint: string, input: unknown): Promise<T> {
		const res = await this.fetchWithTimeout(
			"mutation",
			endpoint,
			`${this.baseUrl}/trpc/${endpoint}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(input),
			},
		);
		if (!res.ok) {
			throw new Error(
				`tRPC mutation ${endpoint} failed: ${res.status} ${res.statusText}`,
			);
		}
		const data = (await res.json()) as {
			error?: { message?: string };
			result: { data: T };
		};
		if (data.error)
			throw new Error(data.error.message ?? JSON.stringify(data.error));
		return data.result.data;
	}
}
