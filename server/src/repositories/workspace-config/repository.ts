import type { WorkspaceConfig } from "../../models/workspace-config";
import type { ServiceCtx } from "../common";

export interface WorkspaceConfigRepository {
	load(ctx: ServiceCtx, workingDir: string): Promise<WorkspaceConfig>;
}
