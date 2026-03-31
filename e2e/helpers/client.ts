import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../server/src/presentation/trpc/routers";

export function createTestClient(port: number) {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: `http://127.0.0.1:${port}/trpc`,
			}),
		],
	});
}

export type TestClient = ReturnType<typeof createTestClient>;
