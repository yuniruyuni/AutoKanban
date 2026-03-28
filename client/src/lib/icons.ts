import {
	Code,
	FileCode,
	FolderOpen,
	Globe,
	type LucideIcon,
	Terminal,
	Wrench,
} from "lucide-react";

// Map of icon names to lucide-react components
const ICON_MAP: Record<string, LucideIcon> = {
	code: Code,
	terminal: Terminal,
	"folder-open": FolderOpen,
	"file-code": FileCode,
	globe: Globe,
	wrench: Wrench,
};

export function getIconComponent(iconName: string): LucideIcon | null {
	return ICON_MAP[iconName] || null;
}

export const AVAILABLE_ICON_NAMES = Object.keys(ICON_MAP);
