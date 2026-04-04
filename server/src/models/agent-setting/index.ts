import { type Comp, defineSpecs, type SpecsOf } from "../common";

// ============================================
// AgentSetting Entity
// ============================================

export interface AgentSetting {
	agentId: string;
	command: string;
	createdAt: Date;
	updatedAt: Date;
}

// ============================================
// AgentSetting Namespace
// ============================================

export namespace AgentSetting {
	// Specs
	const _specs = defineSpecs({
		ById: (agentId: string) => ({ agentId }),
	});
	export const ById = _specs.ById;

	export type Spec = Comp<SpecsOf<typeof _specs>>;

	// Factory
	export function create(params: {
		agentId: string;
		command: string;
	}): AgentSetting {
		const now = new Date();
		return {
			agentId: params.agentId,
			command: params.command,
			createdAt: now,
			updatedAt: now,
		};
	}
}
