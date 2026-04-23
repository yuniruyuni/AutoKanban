import { trpcServer as rawTrpcServer } from "@hono/trpc-server";
import type { AnyRouter, inferRouterContext } from "@trpc/server";
import type {
	FetchCreateContextFnOptions,
	FetchHandlerRequestOptions,
} from "@trpc/server/adapters/fetch";
import type { Context as HonoContext, MiddlewareHandler } from "hono";

type TypedTrpcServerOptions<R extends AnyRouter> = Omit<
	FetchHandlerRequestOptions<R>,
	"req" | "endpoint" | "createContext"
> &
	Partial<Pick<FetchHandlerRequestOptions<R>, "endpoint">> & {
		createContext?: (
			opts: FetchCreateContextFnOptions,
			c: HonoContext,
		) => inferRouterContext<R> | Promise<inferRouterContext<R>>;
	};

// @hono/trpc-server types createContext's return as Record<string, unknown>
// instead of forwarding the router's context generic; this wrapper restores
// the typing so callers can return their real context type directly.
export function trpcServer<R extends AnyRouter>(
	options: TypedTrpcServerOptions<R>,
): MiddlewareHandler {
	return rawTrpcServer(options as Parameters<typeof rawTrpcServer>[0]);
}
