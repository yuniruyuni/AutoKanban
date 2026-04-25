import {
	Code,
	FileCode,
	FolderOpen,
	Globe,
	type LucideIcon,
	MousePointer2,
	Terminal,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { DialogFooter } from "@/components/atoms/Dialog";
import { cn } from "@/lib/utils";

// Available icons for tools
const AVAILABLE_ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
	{ value: "mouse-pointer-2", label: "Cursor", Icon: MousePointer2 },
	{ value: "code", label: "Code", Icon: Code },
	{ value: "terminal", label: "Terminal", Icon: Terminal },
	{ value: "folder-open", label: "Folder", Icon: FolderOpen },
	{ value: "file-code", label: "File Code", Icon: FileCode },
	{ value: "globe", label: "Globe", Icon: Globe },
	{ value: "wrench", label: "Wrench", Icon: Wrench },
];

// Available colors for icon background
const AVAILABLE_COLORS: { value: string; label: string }[] = [
	{ value: "#3B82F6", label: "Blue" },
	{ value: "#10B981", label: "Green" },
	{ value: "#6B7280", label: "Gray" },
	{ value: "#F59E0B", label: "Amber" },
	{ value: "#8B5CF6", label: "Purple" },
	{ value: "#EF4444", label: "Red" },
];

type CommandMode = "argv" | "shell";

interface ToolFormSubmit {
	name: string;
	icon: string;
	iconColor: string;
	command: string;
	argv: string[] | null;
}

interface ToolFormInitial {
	name: string;
	icon: string;
	iconColor: string;
	command: string;
	argv: readonly string[] | null;
}

interface ToolFormProps {
	initialValues?: ToolFormInitial;
	onSubmit: (data: ToolFormSubmit) => Promise<void>;
	onCancel: () => void;
	isSubmitting?: boolean;
}

function pickInitialMode(initial: ToolFormInitial | undefined): CommandMode {
	if (!initial) return "argv";
	if (initial.argv && initial.argv.length > 0) return "argv";
	if (initial.command) return "shell";
	return "argv";
}

function argvToText(argv: readonly string[] | null): string {
	return argv ? argv.join("\n") : "";
}

function textToArgv(text: string): string[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function ToolForm({
	initialValues,
	onSubmit,
	onCancel,
	isSubmitting,
}: ToolFormProps) {
	const [name, setName] = useState(initialValues?.name || "");
	const [icon, setIcon] = useState(initialValues?.icon || "code");
	const [iconColor, setIconColor] = useState(
		initialValues?.iconColor || "#3B82F6",
	);
	const [mode, setMode] = useState<CommandMode>(pickInitialMode(initialValues));
	const [argvText, setArgvText] = useState(
		argvToText(initialValues?.argv ?? null),
	);
	const [command, setCommand] = useState(initialValues?.command || "");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!name.trim()) {
			setError("Tool name is required");
			return;
		}

		if (mode === "argv") {
			const argv = textToArgv(argvText);
			if (argv.length === 0) {
				setError("Argv requires at least one entry (the executable)");
				return;
			}
			try {
				await onSubmit({
					name: name.trim(),
					icon,
					iconColor,
					command: "",
					argv,
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred");
			}
			return;
		}

		if (!command.trim()) {
			setError("Command is required");
			return;
		}

		try {
			await onSubmit({
				name: name.trim(),
				icon,
				iconColor,
				command: command.trim(),
				argv: null,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		}
	};

	const selectedIcon = AVAILABLE_ICONS.find((i) => i.value === icon);

	return (
		<form onSubmit={handleSubmit}>
			<div className="flex flex-col gap-5">
				{/* Tool Name */}
				<div className="flex flex-col gap-2">
					<label
						htmlFor="tool-name"
						className="text-[13px] font-semibold text-primary-foreground"
					>
						Tool Name
					</label>
					<input
						id="tool-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Cursor"
						className="flex w-full rounded-md border border-border bg-primary px-3.5 py-3 text-sm text-primary-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
					/>
				</div>

				{/* Icon */}
				<div className="flex flex-col gap-2">
					<span className="text-[13px] font-semibold text-primary-foreground">
						Icon
					</span>
					<div className="flex items-center gap-3">
						{/* Preview */}
						<div
							className="flex h-12 w-12 items-center justify-center rounded-md shrink-0"
							style={{ backgroundColor: iconColor }}
						>
							{selectedIcon && (
								<selectedIcon.Icon className="h-6 w-6 text-white" />
							)}
						</div>

						<div className="flex flex-col gap-1.5 flex-1">
							<p className="text-[13px] text-secondary-foreground">
								Choose an icon
							</p>
							{/* Icon grid */}
							<div className="flex gap-2">
								{AVAILABLE_ICONS.map((item) => (
									<button
										key={item.value}
										type="button"
										onClick={() => setIcon(item.value)}
										className={cn(
											"flex h-9 w-9 items-center justify-center rounded transition-all",
											icon === item.value
												? "bg-accent border-2 border-accent"
												: "bg-secondary border border-border hover:bg-hover",
										)}
										title={item.label}
									>
										<item.Icon
											className={cn(
												"h-[18px] w-[18px]",
												icon === item.value
													? "text-white"
													: "text-secondary-foreground",
											)}
										/>
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Icon Color */}
				<div className="flex flex-col gap-2">
					<span className="text-[13px] font-semibold text-primary-foreground">
						Icon Color
					</span>
					<div className="flex gap-2">
						{AVAILABLE_COLORS.map((color) => (
							<button
								key={color.value}
								type="button"
								onClick={() => setIconColor(color.value)}
								className={cn(
									"h-7 w-7 rounded-full transition-all",
									iconColor === color.value
										? "ring-2 ring-accent ring-offset-2"
										: "hover:scale-110",
								)}
								style={{ backgroundColor: color.value }}
								title={color.label}
							/>
						))}
					</div>
				</div>

				{/* Mode toggle */}
				<div className="flex flex-col gap-2">
					<span className="text-[13px] font-semibold text-primary-foreground">
						Command Form
					</span>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setMode("argv")}
							className={cn(
								"flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
								mode === "argv"
									? "border-accent bg-accent text-white"
									: "border-border bg-secondary text-secondary-foreground hover:bg-hover",
							)}
						>
							Argv (recommended)
						</button>
						<button
							type="button"
							onClick={() => setMode("shell")}
							className={cn(
								"flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
								mode === "shell"
									? "border-accent bg-accent text-white"
									: "border-border bg-secondary text-secondary-foreground hover:bg-hover",
							)}
						>
							Shell (legacy)
						</button>
					</div>
				</div>

				{/* Command body */}
				{mode === "argv" ? (
					<div className="flex flex-col gap-2">
						<label
							htmlFor="tool-argv"
							className="text-[13px] font-semibold text-primary-foreground"
						>
							Argv (one per line)
						</label>
						<textarea
							id="tool-argv"
							rows={5}
							value={argvText}
							onChange={(e) => setArgvText(e.target.value)}
							placeholder={"cursor\n{path}"}
							className="flex w-full rounded-md border border-border bg-primary px-3.5 py-3 font-mono text-sm text-primary-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
						/>
						<p className="text-xs text-muted">
							Each line is a separate argument passed directly to the OS — no
							shell. Use {"{path}"} for the project / worktree directory.
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<label
							htmlFor="tool-command"
							className="text-[13px] font-semibold text-primary-foreground"
						>
							Shell command
						</label>
						<input
							id="tool-command"
							type="text"
							value={command}
							onChange={(e) => setCommand(e.target.value)}
							placeholder="cursor {path}"
							className="flex w-full rounded-md border border-border bg-primary px-3.5 py-3 font-mono text-sm text-primary-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-0"
						/>
						<p className="text-xs text-muted">
							Run via <code>sh -c</code>. {"{path}"} is shell-escaped on
							substitution. Prefer Argv form for new tools.
						</p>
					</div>
				)}

				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>

			<DialogFooter className="-mx-6 -mb-1 mt-5 px-6">
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? "Saving..." : initialValues ? "Save" : "Add Tool"}
				</Button>
			</DialogFooter>
		</form>
	);
}
