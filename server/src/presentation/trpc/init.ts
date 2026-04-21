// @specre 01KPPZWHXQDZ4R12Y7P3D9HGYA
import { initTRPC } from "@trpc/server";
import type { Context } from "../../usecases/runner";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
