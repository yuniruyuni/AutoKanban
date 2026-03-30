import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "jsonc-parser";
import { WorkspaceConfig } from "../../../models/workspace-config";
import type { ServiceCtx } from "../../../types/db-capability";
import type { WorkspaceConfigRepository as WorkspaceConfigRepositoryDef } from "../repository";

const CONFIG_FILENAME = "auto-kanban.json";

export class WorkspaceConfigRepository implements WorkspaceConfigRepositoryDef {
	async load(_ctx: ServiceCtx, workingDir: string): Promise<WorkspaceConfig> {
		const filePath = join(workingDir, CONFIG_FILENAME);
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			return WorkspaceConfig.empty();
		}

		try {
			const parsed = parse(content);
			if (typeof parsed !== "object" || parsed === null) {
				console.warn(`[WorkspaceConfig] Invalid format in ${filePath}`);
				return WorkspaceConfig.empty();
			}
			return {
				prepare: typeof parsed.prepare === "string" ? parsed.prepare : null,
				server: typeof parsed.server === "string" ? parsed.server : null,
				cleanup: typeof parsed.cleanup === "string" ? parsed.cleanup : null,
			};
		} catch {
			console.warn(`[WorkspaceConfig] Parse error in ${filePath}`);
			return WorkspaceConfig.empty();
		}
	}
}
