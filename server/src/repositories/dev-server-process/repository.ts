import type { Cursor, Page } from "../../models/common";
import type { DevServerProcess } from "../../models/dev-server-process";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface DevServerProcessRepository {
	get(
		ctx: DbReadCtx,
		spec: DevServerProcess.Spec,
	): Promise<DevServerProcess | null>;
	list(
		ctx: DbReadCtx,
		spec: DevServerProcess.Spec,
		cursor: Cursor<DevServerProcess.SortKey>,
	): Promise<Page<DevServerProcess>>;
	upsert(ctx: DbWriteCtx, process: DevServerProcess): Promise<void>;
	delete(ctx: DbWriteCtx, spec: DevServerProcess.Spec): Promise<number>;
}
