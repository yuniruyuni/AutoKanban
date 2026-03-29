/**
 * Bun does not run postinstall scripts for optional native dependencies.
 * embedded-postgres relies on symlinks defined in pg-symlinks.json.
 * This script creates them manually after `bun install`.
 */
import { existsSync, readFileSync, symlinkSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

function getPlatformPackage() {
	const p = platform();
	const a = arch();
	const platformMap = { darwin: "darwin", linux: "linux" };
	const archMap = { arm64: "arm64", x64: "x64" };
	const os = platformMap[p];
	const cpu = archMap[a];
	if (!os || !cpu) return null;
	return `@embedded-postgres/${os}-${cpu}`;
}

const pkg = getPlatformPackage();
if (!pkg) process.exit(0);

// Find the package in node_modules (handles both flat and .bun hoisted layouts)
const candidates = [resolve("node_modules", pkg)];

// Also search in .bun cache
import { readdirSync } from "node:fs";

try {
	const bunDir = resolve("node_modules", ".bun");
	for (const entry of readdirSync(bunDir)) {
		if (entry.includes("embedded-postgres") && entry.includes(arch())) {
			const candidate = join(bunDir, entry, "node_modules", pkg);
			candidates.push(candidate);
		}
	}
} catch {}

// Search parent node_modules too (monorepo)
try {
	const parentBunDir = resolve("..", "node_modules", ".bun");
	for (const entry of readdirSync(parentBunDir)) {
		if (entry.includes("embedded-postgres") && entry.includes(arch())) {
			const candidate = join(parentBunDir, entry, "node_modules", pkg);
			candidates.push(candidate);
		}
	}
} catch {}

let pkgDir = null;
for (const c of candidates) {
	if (existsSync(join(c, "native", "pg-symlinks.json"))) {
		pkgDir = c;
		break;
	}
}

if (!pkgDir) {
	// Not installed yet or unsupported platform — skip silently
	process.exit(0);
}

const symlinksFile = join(pkgDir, "native", "pg-symlinks.json");
const symlinks = JSON.parse(readFileSync(symlinksFile, "utf-8"));

let created = 0;
for (const { source, target } of symlinks) {
	const absSource = join(pkgDir, source);
	const absTarget = join(pkgDir, target);
	if (existsSync(absTarget)) continue;
	try {
		const dir = dirname(absTarget);
		const relSource = relative(dir, absSource);
		symlinkSync(relSource, absTarget);
		created++;
	} catch {}
}

if (created > 0) {
	console.log(`hydrate-pg-symlinks: created ${created} symlinks for ${pkg}`);
}
