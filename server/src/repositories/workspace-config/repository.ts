import type { WorkspaceConfig } from "../../models/workspace-config";
import type { ServiceCtx } from "../../types/db-capability";

export interface WorkspaceConfigRepository {
	load(ctx: ServiceCtx, workingDir: string): Promise<WorkspaceConfig>;
}
