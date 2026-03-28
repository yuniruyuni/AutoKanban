/**
 * Plain-fetch tRPC HTTP client for non-batch single requests.
 *
 * Wire format (non-batch, no transformer):
 *   Query  : GET  /trpc/<proc>?input=<JSON>
 *   Mutate : POST /trpc/<proc>  body=<JSON>
 *   Response: { "result": { "data": <value> } }
 */
export class TrpcHttpClient {
	constructor(private baseUrl: string) {}

	async query<T>(endpoint: string, input?: unknown): Promise<T> {
		const url = new URL(`${this.baseUrl}/trpc/${endpoint}`);
		if (input !== undefined) {
			url.searchParams.set("input", JSON.stringify(input));
		}
		const res = await fetch(url);
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
		const res = await fetch(`${this.baseUrl}/trpc/${endpoint}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		});
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
