// @specre 01KPNSJ3RP8WYFHMFQ4QW3MGQZ
/**
 * Parse ANSI escape codes in text and return an array of styled spans.
 * Supports standard 8-color and bright color codes (SGR 30-37, 40-47, 90-97, 100-107),
 * bold, dim, italic, underline, and reset.
 */

export interface AnsiSpan {
	text: string;
	style: React.CSSProperties;
}

const COLOR_MAP: Record<number, string> = {
	30: "#1e1e1e", // black
	31: "#f87171", // red
	32: "#4ade80", // green
	33: "#facc15", // yellow
	34: "#60a5fa", // blue
	35: "#c084fc", // magenta
	36: "#22d3ee", // cyan
	37: "#e5e5e5", // white
	90: "#6b7280", // bright black (gray)
	91: "#fca5a5", // bright red
	92: "#86efac", // bright green
	93: "#fde68a", // bright yellow
	94: "#93c5fd", // bright blue
	95: "#d8b4fe", // bright magenta
	96: "#67e8f9", // bright cyan
	97: "#ffffff", // bright white
};

const BG_COLOR_MAP: Record<number, string> = {
	40: "#1e1e1e",
	41: "#f87171",
	42: "#4ade80",
	43: "#facc15",
	44: "#60a5fa",
	45: "#c084fc",
	46: "#22d3ee",
	47: "#e5e5e5",
	100: "#6b7280",
	101: "#fca5a5",
	102: "#86efac",
	103: "#fde68a",
	104: "#93c5fd",
	105: "#d8b4fe",
	106: "#67e8f9",
	107: "#ffffff",
};

// Matches ANSI SGR escape sequences: ESC[ ... m
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence requires control char
const ANSI_RE = /\x1b\[([0-9;]*)m/g;

export function ansiToSpans(text: string): AnsiSpan[] {
	const spans: AnsiSpan[] = [];
	let style: React.CSSProperties = {};
	let lastIndex = 0;

	for (const match of text.matchAll(ANSI_RE)) {
		// Push text before this escape code
		if (match.index > lastIndex) {
			const segment = text.slice(lastIndex, match.index);
			if (segment) spans.push({ text: segment, style: { ...style } });
		}
		lastIndex = match.index + match[0].length;

		// Parse SGR codes
		const codes = match[1] ? match[1].split(";").map(Number) : [0];

		for (const code of codes) {
			if (code === 0) {
				style = {};
			} else if (code === 1) {
				style.fontWeight = "bold";
			} else if (code === 2) {
				style.opacity = 0.7;
			} else if (code === 3) {
				style.fontStyle = "italic";
			} else if (code === 4) {
				style.textDecoration = "underline";
			} else if (COLOR_MAP[code]) {
				style.color = COLOR_MAP[code];
			} else if (BG_COLOR_MAP[code]) {
				style.backgroundColor = BG_COLOR_MAP[code];
			}
		}
	}

	// Push remaining text
	if (lastIndex < text.length) {
		const segment = text.slice(lastIndex);
		if (segment) spans.push({ text: segment, style: { ...style } });
	}

	return spans;
}

/** Strip all ANSI escape sequences from text */
export function stripAnsi(text: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence requires control char
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}
