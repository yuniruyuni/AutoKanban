import { useCallback, useEffect, useRef, useState } from "react";

interface UseResizablePanelOptions {
	mode: "ratio" | "pixels";
	initial: number;
	min: number;
	max: number;
}

interface UseResizablePanelResult {
	containerRef: React.RefObject<HTMLDivElement | null>;
	value: number;
	isDragging: boolean;
	handleMouseDown: (e: React.MouseEvent) => void;
}

export function useResizablePanel(
	options: UseResizablePanelOptions,
): UseResizablePanelResult {
	const { mode, initial, min, max } = options;
	const [value, setValue] = useState(initial);
	const [isDragging, setIsDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setIsDragging(true);
			if (mode === "ratio") {
				document.body.style.cursor = "col-resize";
				document.body.style.userSelect = "none";
			}
		},
		[mode],
	);

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!containerRef.current) return;
			const containerRect = containerRef.current.getBoundingClientRect();

			if (mode === "ratio") {
				const newRatio = (e.clientX - containerRect.left) / containerRect.width;
				setValue(Math.max(min, Math.min(max, newRatio)));
			} else {
				const newWidth = e.clientX - containerRect.left;
				setValue(Math.max(min, Math.min(max, newWidth)));
			}
		};

		const handleMouseUp = () => {
			setIsDragging(false);
			if (mode === "ratio") {
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
			}
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, mode, min, max]);

	return { containerRef, value, isDragging, handleMouseDown };
}
