export { FAIL_BRAND, type Fail, fail, isFail, type Unfail } from "./fail";
export { generateId } from "./id";
export type { Cursor, Page, Sort } from "./pagination";
export type { PendingPermission } from "./permission";
export {
	and,
	type Comp,
	type CompMethods,
	defineSpecs,
	isCompLogical,
	not,
	or,
	type SpecsOf,
} from "./spec";
