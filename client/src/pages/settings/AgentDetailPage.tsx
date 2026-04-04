import { ArrowLeft, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/atoms/Button";
import { Toggle } from "@/components/atoms/Toggle";
import { SidebarLayout } from "@/components/project/SidebarLayout";
import { useAgentSetting } from "@/hooks/useAgentSetting";
import { useVariantMutations, useVariants } from "@/hooks/useVariants";
import { paths } from "@/lib/paths";
import { cn } from "@/lib/utils";

interface VariantData {
	id: string;
	executor: string;
	name: string;
	permissionMode: string;
	model: string | null;
	appendPrompt: string | null;
}

function variantDescription(v: VariantData): string {
	const parts: string[] = [];
	parts.push(`permission_mode: ${v.permissionMode}`);
	if (v.model) parts.push(`model: ${v.model}`);
	return parts.join(", ");
}

interface VariantCardProps {
	variant: VariantData;
	isSelected: boolean;
	onEdit: () => void;
}

function VariantCard({ variant, isSelected, onEdit }: VariantCardProps) {
	return (
		<button
			type="button"
			onClick={onEdit}
			className={cn(
				"flex items-center justify-between py-4 px-5 rounded-lg bg-primary text-left w-full transition-colors hover:bg-hover/30",
				isSelected ? "border-2 border-accent" : "border border-border",
			)}
		>
			<div className="flex flex-col gap-1">
				<span className="font-mono text-[15px] font-semibold text-primary-foreground block">
					{variant.name}
				</span>
				<span className="font-mono text-xs text-muted block">
					{variantDescription(variant)}
				</span>
			</div>
			<Pencil className="h-4 w-4 text-secondary-foreground shrink-0" />
		</button>
	);
}

const AGENT_INFO: Record<
	string,
	{ name: string; description: string; defaultCommand: string }
> = {
	"claude-code": {
		name: "Claude Code",
		description: "Configure Claude Code agent settings",
		defaultCommand: "claude",
	},
	"gemini-cli": {
		name: "Gemini CLI",
		description: "Configure Gemini CLI agent settings",
		defaultCommand: "gemini",
	},
};

function permissionModeFromForm(form: {
	dangerouslySkipPermissions: boolean;
	plan: boolean;
	approvals: boolean;
}): string {
	if (form.dangerouslySkipPermissions) return "bypassPermissions";
	if (form.plan) return "plan";
	if (form.approvals) return "acceptEdits";
	return "default";
}

function formFromPermissionMode(mode: string) {
	return {
		dangerouslySkipPermissions: mode === "bypassPermissions",
		plan: mode === "plan",
		approvals: mode === "acceptEdits",
	};
}

export function AgentDetailPage() {
	const { agentId } = useParams<{ agentId: string }>();
	const [isPanelOpen, setIsPanelOpen] = useState(false);
	const [editingVariant, setEditingVariant] = useState<VariantData | null>(
		null,
	);
	const [isCreating, setIsCreating] = useState(false);

	const executor = agentId ?? "claude-code";
	const {
		command: savedCommand,
		defaultCommand,
		isAvailable,
		isLoading: isCommandLoading,
		updateCommand: saveCommand,
		isUpdating: isCommandSaving,
	} = useAgentSetting(executor);
	const [commandInput, setCommandInput] = useState<string | null>(null);
	const { variants, isLoading } = useVariants(executor);
	const {
		createVariant,
		updateVariant,
		deleteVariant,
		isCreating: isSaving,
		isUpdating,
		isDeleting,
	} = useVariantMutations();

	// Form state
	const [formState, setFormState] = useState({
		name: "",
		dangerouslySkipPermissions: false,
		plan: false,
		model: "",
		approvals: false,
		appendPrompt: "",
	});

	const agentInfo = agentId ? AGENT_INFO[agentId] : null;

	const handleEditVariant = (variant: VariantData) => {
		setEditingVariant(variant);
		setIsCreating(false);
		const modeFlags = formFromPermissionMode(variant.permissionMode);
		setFormState({
			name: variant.name,
			...modeFlags,
			model: variant.model ?? "",
			appendPrompt: variant.appendPrompt ?? "",
		});
		setIsPanelOpen(true);
	};

	const handleNewVariant = () => {
		setEditingVariant(null);
		setIsCreating(true);
		setFormState({
			name: "",
			dangerouslySkipPermissions: false,
			plan: false,
			model: "",
			approvals: false,
			appendPrompt: "",
		});
		setIsPanelOpen(true);
	};

	const handleClosePanel = () => {
		setIsPanelOpen(false);
		setEditingVariant(null);
		setIsCreating(false);
	};

	const handleSave = async () => {
		const permissionMode = permissionModeFromForm(formState);
		const model = formState.model || null;
		const appendPrompt = formState.appendPrompt || null;

		if (isCreating) {
			await createVariant({
				executor,
				name: formState.name,
				permissionMode,
				model,
				appendPrompt,
			});
		} else if (editingVariant) {
			await updateVariant({
				variantId: editingVariant.id,
				name: formState.name,
				permissionMode,
				model,
				appendPrompt,
			});
		}
		handleClosePanel();
	};

	const handleDelete = async () => {
		if (editingVariant) {
			await deleteVariant({ variantId: editingVariant.id });
			handleClosePanel();
		}
	};

	if (!agentInfo) {
		return (
			<SidebarLayout>
				<div className="py-8 px-10">
					<p className="text-muted">Agent not found</p>
				</div>
			</SidebarLayout>
		);
	}

	return (
		<SidebarLayout>
			<div className="relative h-full">
				{/* Overlay when panel is open */}
				{isPanelOpen && (
					// biome-ignore lint/a11y/noStaticElementInteractions: overlay dismisses panel on click
					<div
						role="presentation"
						className="absolute inset-0 bg-black/30 z-30"
						onClick={handleClosePanel}
						onKeyDown={(e) => {
							if (e.key === "Escape") handleClosePanel();
						}}
					/>
				)}

				<div className="flex flex-col gap-8 py-8 px-10">
					{/* Header */}
					<div className="flex flex-col gap-1">
						<h1 className="text-[28px] font-bold text-primary-foreground">
							{agentInfo.name}
						</h1>
						<p className="text-sm text-secondary-foreground">
							{agentInfo.description}
						</p>
						<Link
							to={paths.agent()}
							className="inline-flex items-center gap-2 text-sm font-medium text-secondary-foreground hover:text-primary-foreground pt-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to Agent
						</Link>
					</div>

					{/* Command Section */}
					<div className="flex flex-col gap-4">
						<h2 className="text-base font-semibold text-primary-foreground">
							Command
						</h2>
						<div className="flex items-end gap-3">
							<div className="flex flex-col gap-2 flex-1">
								<div className="flex items-center gap-2">
									<div
										className={cn(
											"h-2.5 w-2.5 rounded-full shrink-0",
											isCommandLoading
												? "bg-muted"
												: isAvailable
													? "bg-green-500"
													: "bg-red-500",
										)}
									/>
									<span className="text-xs text-muted">
										{isCommandLoading
											? "Checking..."
											: isAvailable
												? "Available"
												: "Not found"}
									</span>
								</div>
								<input
									type="text"
									value={commandInput ?? savedCommand ?? ""}
									onChange={(e) => setCommandInput(e.target.value)}
									placeholder={defaultCommand ?? agentInfo?.defaultCommand ?? ""}
									className="w-full px-3.5 py-3 border border-border rounded-md font-mono text-sm text-primary-foreground bg-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
								/>
							</div>
							<Button
								onClick={async () => {
									const value = commandInput ?? savedCommand ?? "";
									if (value) {
										await saveCommand(value);
										setCommandInput(null);
									}
								}}
								disabled={
									isCommandSaving ||
									(commandInput ?? savedCommand ?? "") === "" ||
									(commandInput === null && savedCommand !== null) ||
									commandInput === savedCommand
								}
							>
								{isCommandSaving ? "Saving..." : "Save"}
							</Button>
						</div>
					</div>

					{/* Variants Section */}
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between">
							<h2 className="text-base font-semibold text-primary-foreground">
								Configuration Variants
							</h2>
							<button
								type="button"
								onClick={handleNewVariant}
								className="flex items-center gap-1.5 rounded bg-hover px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-hover/80 transition-colors"
							>
								<Plus className="h-3.5 w-3.5" />
								Add Variant
							</button>
						</div>

						{isLoading ? (
							<p className="text-sm text-muted">Loading variants...</p>
						) : variants.length === 0 ? (
							<p className="text-sm text-muted">
								No variants configured. Click "Add Variant" to create one.
							</p>
						) : (
							<div className="grid grid-cols-2 gap-4">
								{variants.map((variant) => (
									<VariantCard
										key={variant.id}
										variant={variant}
										isSelected={editingVariant?.id === variant.id}
										onEdit={() => handleEditVariant(variant)}
									/>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Slide Panel */}
				{isPanelOpen && (
					<div className="absolute top-0 right-0 h-full w-[440px] bg-primary border-l border-border z-40 flex flex-col shadow-xl">
						{/* Panel Header */}
						<div className="flex items-center justify-between py-6 px-7 border-b border-border">
							<div className="flex flex-col gap-1.5">
								<h2 className="text-xl font-semibold text-primary-foreground">
									{isCreating ? "New Variant" : "Edit Variant"}
								</h2>
								{editingVariant && (
									<p className="text-sm font-semibold font-mono text-accent">
										{editingVariant.name}
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={handleClosePanel}
								className="flex items-center justify-center h-9 w-9 rounded-md bg-hover text-secondary-foreground hover:text-primary-foreground transition-colors"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						{/* Panel Body */}
						<div className="flex-1 overflow-y-auto p-7 flex flex-col gap-6">
							{/* Variant Name */}
							<div className="flex flex-col gap-2">
								<label
									htmlFor="variant-name"
									className="text-sm font-semibold text-primary-foreground"
								>
									Variant Name
								</label>
								<input
									id="variant-name"
									type="text"
									value={formState.name}
									onChange={(e) =>
										setFormState({ ...formState, name: e.target.value })
									}
									className="w-full px-3.5 py-3 border border-border rounded-md font-mono text-sm text-primary-foreground bg-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
								/>
							</div>

							{/* dangerously_skip_permissions */}
							<div className="flex items-start justify-between gap-4">
								<div className="flex flex-col gap-1 flex-1">
									<span className="text-sm font-semibold text-primary-foreground">
										dangerously_skip_permissions
									</span>
									<p className="text-[13px] text-muted">
										Skip permission prompts when running commands. Use with
										caution.
									</p>
								</div>
								<Toggle
									checked={formState.dangerouslySkipPermissions}
									onChange={(checked) =>
										setFormState({
											...formState,
											dangerouslySkipPermissions: checked,
										})
									}
								/>
							</div>

							{/* plan */}
							<div className="flex items-start justify-between gap-4">
								<div className="flex flex-col gap-1 flex-1">
									<span className="text-sm font-semibold text-primary-foreground">
										plan
									</span>
									<p className="text-[13px] text-muted">
										Enable plan mode for careful step-by-step planning before
										execution.
									</p>
								</div>
								<Toggle
									checked={formState.plan}
									onChange={(checked) =>
										setFormState({ ...formState, plan: checked })
									}
								/>
							</div>

							{/* model */}
							<div className="flex flex-col gap-2">
								<label
									htmlFor="variant-model"
									className="text-sm font-semibold text-primary-foreground"
								>
									model
								</label>
								<p className="text-[13px] text-muted">
									Override the default model for this variant.
								</p>
								<div className="relative">
									<select
										id="variant-model"
										value={formState.model}
										onChange={(e) =>
											setFormState({ ...formState, model: e.target.value })
										}
										className="w-full appearance-none px-3.5 py-3 border border-border rounded-md text-sm text-secondary-foreground bg-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
									>
										<option value="">default</option>
										<option value="sonnet">sonnet</option>
										<option value="opus">opus</option>
										<option value="haiku">haiku</option>
									</select>
									<ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-secondary-foreground pointer-events-none" />
								</div>
							</div>

							{/* approvals */}
							<div className="flex items-start justify-between gap-4">
								<div className="flex flex-col gap-1 flex-1">
									<span className="text-sm font-semibold text-primary-foreground">
										approvals
									</span>
									<p className="text-[13px] text-muted">
										Require approval before executing commands.
									</p>
								</div>
								<Toggle
									checked={formState.approvals}
									onChange={(checked) =>
										setFormState({ ...formState, approvals: checked })
									}
								/>
							</div>

							{/* Divider */}
							<div className="h-px bg-border" />

							<h3 className="text-base font-semibold text-primary-foreground">
								Advanced Settings
							</h3>

							{/* append_prompt */}
							<div className="flex flex-col gap-2">
								<label
									htmlFor="variant-append-prompt"
									className="text-sm font-semibold text-primary-foreground"
								>
									append_prompt
								</label>
								<p className="text-[13px] text-muted">
									Extra text appended to the prompt.
								</p>
								<textarea
									id="variant-append-prompt"
									value={formState.appendPrompt}
									onChange={(e) =>
										setFormState({ ...formState, appendPrompt: e.target.value })
									}
									placeholder="Enter additional prompt text..."
									className="w-full h-20 px-3.5 py-3 border border-border rounded-md text-sm text-primary-foreground bg-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0 resize-none"
								/>
							</div>
						</div>

						{/* Panel Footer */}
						<div className="flex items-center justify-between py-5 px-7 border-t border-border">
							<div>
								{editingVariant && (
									<button
										type="button"
										onClick={handleDelete}
										disabled={isDeleting}
										className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
									>
										<Trash2 className="h-4 w-4" />
										{isDeleting ? "Deleting..." : "Delete"}
									</button>
								)}
							</div>
							<div className="flex gap-3">
								<Button variant="outline" onClick={handleClosePanel}>
									Cancel
								</Button>
								<Button
									onClick={handleSave}
									disabled={!formState.name || isSaving || isUpdating}
								>
									{isSaving || isUpdating ? "Saving..." : "Save Changes"}
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>
		</SidebarLayout>
	);
}
