import type React from "react";

/**
 * ANSI color code to CSS color mapping
 */
const ANSI_COLORS: Record<number, string> = {
	// Standard colors
	30: "#000000", // Black
	31: "#cc0000", // Red
	32: "#00cc00", // Green
	33: "#cccc00", // Yellow
	34: "#0000cc", // Blue
	35: "#cc00cc", // Magenta
	36: "#00cccc", // Cyan
	37: "#cccccc", // White
	// Bright colors
	90: "#666666", // Bright Black (Gray)
	91: "#ff0000", // Bright Red
	92: "#00ff00", // Bright Green
	93: "#ffff00", // Bright Yellow
	94: "#0000ff", // Bright Blue
	95: "#ff00ff", // Bright Magenta
	96: "#00ffff", // Bright Cyan
	97: "#ffffff", // Bright White
};

const ANSI_BG_COLORS: Record<number, string> = {
	40: "#000000", // Black
	41: "#cc0000", // Red
	42: "#00cc00", // Green
	43: "#cccc00", // Yellow
	44: "#0000cc", // Blue
	45: "#cc00cc", // Magenta
	46: "#00cccc", // Cyan
	47: "#cccccc", // White
	100: "#666666", // Bright Black
	101: "#ff0000", // Bright Red
	102: "#00ff00", // Bright Green
	103: "#ffff00", // Bright Yellow
	104: "#0000ff", // Bright Blue
	105: "#ff00ff", // Bright Magenta
	106: "#00ffff", // Bright Cyan
	107: "#ffffff", // Bright White
};

interface TextSpan {
	text: string;
	color?: string;
	bgColor?: string;
	bold?: boolean;
	dim?: boolean;
	italic?: boolean;
	underline?: boolean;
}

/**
 * Parse ANSI escape codes and return an array of styled text spans
 */
function parseAnsi(text: string): TextSpan[] {
	const spans: TextSpan[] = [];
	// Match ANSI escape sequences: ESC [ ... m
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequences require control characters
	const ansiRegex = /\x1b\[([0-9;]*)m/g;

	let lastIndex = 0;
	let currentStyle: Omit<TextSpan, "text"> = {};

	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop pattern
	while ((match = ansiRegex.exec(text)) !== null) {
		// Add text before this escape sequence
		if (match.index > lastIndex) {
			const textContent = text.slice(lastIndex, match.index);
			if (textContent) {
				spans.push({ text: textContent, ...currentStyle });
			}
		}

		// Parse the escape codes
		const codes = match[1].split(";").map(Number);
		for (const code of codes) {
			if (code === 0) {
				// Reset all
				currentStyle = {};
			} else if (code === 1) {
				currentStyle.bold = true;
			} else if (code === 2) {
				currentStyle.dim = true;
			} else if (code === 3) {
				currentStyle.italic = true;
			} else if (code === 4) {
				currentStyle.underline = true;
			} else if (code === 22) {
				currentStyle.bold = false;
				currentStyle.dim = false;
			} else if (code === 23) {
				currentStyle.italic = false;
			} else if (code === 24) {
				currentStyle.underline = false;
			} else if (code >= 30 && code <= 37) {
				currentStyle.color = ANSI_COLORS[code];
			} else if (code >= 90 && code <= 97) {
				currentStyle.color = ANSI_COLORS[code];
			} else if (code === 39) {
				// Default foreground color
				delete currentStyle.color;
			} else if (code >= 40 && code <= 47) {
				currentStyle.bgColor = ANSI_BG_COLORS[code];
			} else if (code >= 100 && code <= 107) {
				currentStyle.bgColor = ANSI_BG_COLORS[code];
			} else if (code === 49) {
				// Default background color
				delete currentStyle.bgColor;
			}
		}

		lastIndex = ansiRegex.lastIndex;
	}

	// Add remaining text
	if (lastIndex < text.length) {
		const textContent = text.slice(lastIndex);
		if (textContent) {
			spans.push({ text: textContent, ...currentStyle });
		}
	}

	return spans;
}

interface AnsiTextProps {
	text: string;
	className?: string;
	defaultColor?: string;
}

/**
 * Component that renders text with ANSI color codes as styled spans
 */
export function AnsiText({
	text,
	className,
	defaultColor = "#e5e5e5",
}: AnsiTextProps) {
	const spans = parseAnsi(text);

	if (spans.length === 0) {
		return <span className={className}>{text}</span>;
	}

	return (
		<span className={className}>
			{spans.map((span, index) => {
				const style: React.CSSProperties = {};
				if (span.color) {
					style.color = span.color;
				} else {
					style.color = defaultColor;
				}
				if (span.bgColor) {
					style.backgroundColor = span.bgColor;
				}
				if (span.bold) {
					style.fontWeight = "bold";
				}
				if (span.dim) {
					style.opacity = 0.5;
				}
				if (span.italic) {
					style.fontStyle = "italic";
				}
				if (span.underline) {
					style.textDecoration = "underline";
				}

				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: items have no stable unique identifier
					<span key={index} style={style}>
						{span.text}
					</span>
				);
			})}
		</span>
	);
}
