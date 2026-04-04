import type { AgentSetting } from "../../models/agent-setting";
import type { DbReadCtx, DbWriteCtx } from "../common";

export interface AgentSettingRepository {
	get(ctx: DbReadCtx, spec: AgentSetting.Spec): Promise<AgentSetting | null>;
	upsert(ctx: DbWriteCtx, setting: AgentSetting): Promise<void>;
}
