import type { AppRouter } from "@auto-kanban/server";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient() {
	return trpc.createClient({
		links: [
			httpBatchLink({
				url: "/trpc",
			}),
		],
	});
}
