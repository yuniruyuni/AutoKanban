import { cn } from "@/lib/utils";

interface Tab {
	id: string;
	label: string;
}

interface TabBarProps {
	tabs: Tab[];
	activeTab: string;
	onChange: (tabId: string) => void;
	className?: string;
}

export function TabBar({ tabs, activeTab, onChange, className }: TabBarProps) {
	return (
		<div className={cn("flex border-b border-[#E4E4E7]", className)}>
			{tabs.map((tab) => (
				<button
					type="button"
					key={tab.id}
					onClick={() => onChange(tab.id)}
					className={cn(
						"px-5 py-3 text-sm transition-colors",
						activeTab === tab.id
							? "font-semibold text-[#E87B35] border-b-2 border-[#E87B35] -mb-px"
							: "font-medium text-[#A1A1AA] hover:text-[#71717A]",
					)}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
