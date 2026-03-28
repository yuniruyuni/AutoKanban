import { HelpCircle, icons, type LucideIcon } from "lucide-react";

interface DynamicIconProps {
	name: string;
	className?: string;
	style?: React.CSSProperties;
}

export function DynamicIcon({ name, className, style }: DynamicIconProps) {
	// Convert icon name to PascalCase (e.g., "code" -> "Code", "file-code" -> "FileCode")
	const iconName = name
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("") as keyof typeof icons;

	const IconComponent: LucideIcon | undefined = icons[iconName];

	if (!IconComponent) {
		// Fallback to a default icon if not found
		return <HelpCircle className={className} style={style} />;
	}

	return <IconComponent className={className} style={style} />;
}
