import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Branch {
	name: string;
	isCurrent: boolean;
}

interface BranchComboboxProps {
	branches: Branch[];
	value: string;
	onChange: (value: string) => void;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
}

export function BranchCombobox({
	branches,
	value,
	onChange,
	label,
	placeholder = "Search branches...",
	disabled,
}: BranchComboboxProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState(value);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		setSearch(value);
	}, [value]);

	const filtered = useMemo(() => {
		const query = search.toLowerCase();
		return branches.filter((b) => b.name.toLowerCase().includes(query));
	}, [branches, search]);

	const handleSelect = (name: string) => {
		onChange(name);
		setSearch(name);
		setIsOpen(false);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(e.target.value);
		onChange(e.target.value);
		setIsOpen(true);
	};

	const handleFocus = () => {
		setIsOpen(true);
	};

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				inputRef.current &&
				!inputRef.current.contains(e.target as Node) &&
				listRef.current &&
				!listRef.current.contains(e.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const inputId = "branch-combobox-input";

	return (
		<div className="relative flex flex-col gap-2">
			{label && (
				<label
					htmlFor={inputId}
					className="text-sm font-medium text-primary-foreground"
				>
					{label}
				</label>
			)}
			<input
				id={inputId}
				ref={inputRef}
				type="text"
				value={search}
				onChange={handleInputChange}
				onFocus={handleFocus}
				placeholder={placeholder}
				disabled={disabled}
				className={cn(
					"flex h-10 w-full rounded-md border border-border bg-primary px-3.5 py-2 text-sm text-primary-foreground",
					"placeholder:text-muted",
					"focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-0",
					"disabled:cursor-not-allowed disabled:opacity-50",
				)}
			/>
			{isOpen && filtered.length > 0 && (
				<ul
					ref={listRef}
					className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-primary shadow-lg"
				>
					{filtered.map((branch) => (
						<li key={branch.name}>
							<button
								type="button"
								onClick={() => handleSelect(branch.name)}
								className={cn(
									"flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-foreground hover:bg-secondary",
									branch.name === value && "bg-secondary font-medium",
								)}
							>
								{branch.isCurrent && (
									<span className="text-xs text-accent">●</span>
								)}
								<span>{branch.name}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
