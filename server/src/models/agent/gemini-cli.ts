import type { CodingAgent } from "./agent";
import { PlainTextLogParser } from "./plain-text-parser";

export const geminiCliAgent: CodingAgent = {
	id: "gemini-cli",
	displayName: "Gemini CLI",
	defaultCommand: "gemini",
	installHint: "npm install -g @google/gemini-cli",
	capabilities: ["oneShot", "streamJsonLogs"],
	defaultVariants: [
		{
			executor: "gemini-cli",
			name: "DEFAULT",
			permissionMode: "bypassPermissions",
		},
	],
	createParser: () => new PlainTextLogParser("gemini-cli"),
};
