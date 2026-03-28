/**
 * Diff Parser
 *
 * Pure functions for parsing and transforming git diff output.
 * No React dependency — independently testable.
 */

import type { GitDiff } from "@/hooks/useGit";

// -- Tree structure for file browser --

export interface TreeNode {
	name: string;
	path: string;
	children: Map<string, TreeNode>;
	isFile: boolean;
}

export function buildFileTree(diffs: GitDiff[]): TreeNode {
	const root: TreeNode = {
		name: "",
		path: "",
		children: new Map(),
		isFile: false,
	};

	for (const diff of diffs) {
		const parts = diff.filePath.split("/");
		let current = root;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			const isFile = i === parts.length - 1;
			const path = parts.slice(0, i + 1).join("/");

			if (!current.children.has(part)) {
				current.children.set(part, {
					name: part,
					path,
					children: new Map(),
					isFile,
				});
			}
			current = current.children.get(part) ?? current;
		}
	}

	return root;
}

// -- Diff line parsing --

export interface DiffLine {
	type: "context" | "addition" | "deletion" | "hunk";
	content: string;
	oldLineNum?: number;
	newLineNum?: number;
}

export function parseDiffLines(rawDiff: string): DiffLine[] {
	const lines = rawDiff.split("\n");
	const result: DiffLine[] = [];
	let oldLineNum = 0;
	let newLineNum = 0;

	for (const line of lines) {
		if (
			line.startsWith("diff ") ||
			line.startsWith("index ") ||
			line.startsWith("---") ||
			line.startsWith("+++")
		) {
			continue;
		}

		if (line.startsWith("@@")) {
			const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)/);
			if (match) {
				oldLineNum = parseInt(match[1], 10) - 1;
				newLineNum = parseInt(match[2], 10) - 1;
			}
			result.push({ type: "hunk", content: line });
			continue;
		}

		if (line.startsWith("+")) {
			newLineNum++;
			result.push({ type: "addition", content: line, newLineNum });
		} else if (line.startsWith("-")) {
			oldLineNum++;
			result.push({ type: "deletion", content: line, oldLineNum });
		} else {
			oldLineNum++;
			newLineNum++;
			result.push({ type: "context", content: line, oldLineNum, newLineNum });
		}
	}

	return result;
}

// -- Side-by-side pairing --

export interface SideBySidePair {
	left: DiffLine | null;
	right: DiffLine | null;
}

export function pairSideBySide(lines: DiffLine[]): SideBySidePair[] {
	const pairs: SideBySidePair[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.type === "hunk") {
			pairs.push({ left: line, right: line });
			i++;
			continue;
		}

		if (line.type === "context") {
			pairs.push({ left: line, right: line });
			i++;
			continue;
		}

		// Collect consecutive deletions and additions
		const deletions: DiffLine[] = [];
		const additions: DiffLine[] = [];

		while (i < lines.length && lines[i].type === "deletion") {
			deletions.push(lines[i]);
			i++;
		}
		while (i < lines.length && lines[i].type === "addition") {
			additions.push(lines[i]);
			i++;
		}

		const maxLen = Math.max(deletions.length, additions.length);
		for (let j = 0; j < maxLen; j++) {
			pairs.push({
				left: j < deletions.length ? deletions[j] : null,
				right: j < additions.length ? additions[j] : null,
			});
		}
	}

	return pairs;
}

// -- Whitespace helpers --

export function isWhitespaceOnlyChange(line: string): boolean {
	// A line starting with + or - where the content (after the prefix) is only whitespace changes
	const content = line.substring(1);
	return content.trim().length === 0 || content === "";
}

export function filterWhitespaceHunks(rawDiff: string): string {
	const lines = rawDiff.split("\n");
	const result: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Pass through metadata lines
		if (
			line.startsWith("diff ") ||
			line.startsWith("index ") ||
			line.startsWith("---") ||
			line.startsWith("+++")
		) {
			result.push(line);
			i++;
			continue;
		}

		// For hunk headers, collect the entire hunk and check if all changes are whitespace-only
		if (line.startsWith("@@")) {
			const hunkLines: string[] = [line];
			i++;

			while (
				i < lines.length &&
				!lines[i].startsWith("@@") &&
				!lines[i].startsWith("diff ")
			) {
				hunkLines.push(lines[i]);
				i++;
			}

			// Check if all +/- lines in this hunk are whitespace-only
			const changedLines = hunkLines.filter(
				(l) => l.startsWith("+") || l.startsWith("-"),
			);
			const allWhitespace =
				changedLines.length > 0 && changedLines.every(isWhitespaceOnlyChange);

			if (!allWhitespace) {
				// Keep this hunk, but filter out individual whitespace-only change pairs
				for (const hl of hunkLines) {
					result.push(hl);
				}
			}
			continue;
		}

		result.push(line);
		i++;
	}

	return result.join("\n");
}
