import type { AgentSetting } from "../../../models/agent-setting";
import type { DbReadCtx, DbWriteCtx } from "../../common";
import type { AgentSettingRepository as IAgentSettingRepository } from "../repository";
import { get } from "./get";
import { upsert } from "./upsert";

export class AgentSettingRepository implements IAgentSettingRepository {
	async get(
		ctx: DbReadCtx,
		spec: AgentSetting.Spec,
	): Promise<AgentSetting | null> {
		return get(ctx.db, spec);
	}

	async upsert(ctx: DbWriteCtx, setting: AgentSetting): Promise<void> {
		await upsert(ctx.db, setting);
	}
}
