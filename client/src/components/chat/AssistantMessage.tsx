import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TextContent } from "./types";

interface AssistantMessageProps {
	content: TextContent;
}

export function AssistantMessage({ content }: AssistantMessageProps) {
	return (
		<div className="flex gap-3">
			<div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent">
				<span className="text-sm font-bold text-white">C</span>
			</div>
			<div className="flex-1 rounded-lg bg-secondary px-4 py-3">
				<div className="prose prose-sm max-w-none text-primary-foreground prose-headings:text-primary-foreground prose-headings:font-semibold prose-p:my-2 prose-pre:bg-secondary prose-pre:text-primary-foreground prose-code:text-accent prose-code:bg-hover prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>
						{content.text}
					</ReactMarkdown>
				</div>
			</div>
		</div>
	);
}
