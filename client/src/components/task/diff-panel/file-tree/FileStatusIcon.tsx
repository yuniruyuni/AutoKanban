import { FileCode, FileEdit, FilePlus, MoveRight, Trash2 } from "lucide-react";

export function FileStatusIcon({ status }: { status?: string }) {
	switch (status) {
		case "added":
			return <FilePlus className="h-3.5 w-3.5 flex-shrink-0 text-[#22C55E]" />;
		case "deleted":
			return <Trash2 className="h-3.5 w-3.5 flex-shrink-0 text-[#EF4444]" />;
		case "modified":
			return <FileEdit className="h-3.5 w-3.5 flex-shrink-0 text-[#F59E0B]" />;
		case "renamed":
			return <MoveRight className="h-3.5 w-3.5 flex-shrink-0 text-[#E87B35]" />;
		default:
			return <FileCode className="h-3.5 w-3.5 flex-shrink-0 text-[#E87B35]" />;
	}
}
