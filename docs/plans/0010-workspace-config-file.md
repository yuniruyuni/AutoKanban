# WorkspaceConfig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate workspace scripts (prepare/server/cleanup) from DB columns to `auto-kanban.json` file, add Workspace tab to Task Details UI

**Architecture:** New `WorkspaceConfig` model + file-based repository reads JSONC config from worktree root. DB script columns and MCP script-update tools are removed. Client gets a new "Workspace" tab for running prepare/cleanup scripts with unified log viewer.

**Tech Stack:** JSONC parsing via `jsonc-parser`, Bun file I/O, existing `LogCollector` + SSE infrastructure for log streaming

**ADR:** `docs/adr/0010-workspace-config-file.md`

---

### Task 1: Install `jsonc-parser` dependency

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: Install jsonc-parser**

```bash
cd server && bun add jsonc-parser
```

- [ ] **Step 2: Verify installation**

```bash
cd server && bun run -e "import { parse } from 'jsonc-parser'; console.log(typeof parse)"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/bun.lock
git commit -m "chore: add jsonc-parser dependency for auto-kanban.json support"
```

---

### Task 2: Create WorkspaceConfig model

**Files:**
- Create: `server/src/models/workspace-config.ts`
- Test: `server/src/models/workspace-config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/models/workspace-config.test.ts
import { describe, expect, test } from "bun:test";
import { WorkspaceConfig } from "./workspace-config";

describe("WorkspaceConfig", () => {
  test("empty() returns all null fields", () => {
    const config = WorkspaceConfig.empty();
    expect(config.prepare).toBeNull();
    expect(config.server).toBeNull();
    expect(config.cleanup).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && bun test src/models/workspace-config.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// server/src/models/workspace-config.ts
export interface WorkspaceConfig {
  prepare: string | null;
  server: string | null;
  cleanup: string | null;
}

export namespace WorkspaceConfig {
  export function empty(): WorkspaceConfig {
    return { prepare: null, server: null, cleanup: null };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && bun test src/models/workspace-config.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/models/workspace-config.ts server/src/models/workspace-config.test.ts
git commit -m "feat: add WorkspaceConfig model"
```

---

### Task 3: Create WorkspaceConfigRepository

**Files:**
- Create: `server/src/repositories/workspace-config/repository.ts`
- Create: `server/src/repositories/workspace-config/file/index.ts`
- Create: `server/src/repositories/workspace-config/index.ts`
- Test: `server/src/repositories/workspace-config/file/index.test.ts`

- [ ] **Step 1: Write the repository interface**

```typescript
// server/src/repositories/workspace-config/repository.ts
import type { WorkspaceConfig } from "../../models/workspace-config";

export interface IWorkspaceConfigRepository {
  load(workingDir: string): Promise<WorkspaceConfig>;
}
```

- [ ] **Step 2: Write failing test**

```typescript
// server/src/repositories/workspace-config/file/index.test.ts
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceConfigRepository } from ".";

describe("WorkspaceConfigRepository", () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  async function setup(content?: string): Promise<string> {
    tempDir = await mkdtemp(join(tmpdir(), "ws-config-test-"));
    if (content !== undefined) {
      await writeFile(join(tempDir, "auto-kanban.json"), content);
    }
    return tempDir;
  }

  test("loads valid auto-kanban.json", async () => {
    const dir = await setup(JSON.stringify({
      prepare: "bun install",
      server: "bun run dev",
      cleanup: "rm -rf node_modules",
    }));
    const repo = new WorkspaceConfigRepository();
    const config = await repo.load(dir);
    expect(config.prepare).toBe("bun install");
    expect(config.server).toBe("bun run dev");
    expect(config.cleanup).toBe("rm -rf node_modules");
  });

  test("returns empty config when file does not exist", async () => {
    const dir = await setup(); // no file
    const repo = new WorkspaceConfigRepository();
    const config = await repo.load(dir);
    expect(config.prepare).toBeNull();
    expect(config.server).toBeNull();
    expect(config.cleanup).toBeNull();
  });

  test("returns empty config on parse error", async () => {
    const dir = await setup("{ invalid json }}}");
    const repo = new WorkspaceConfigRepository();
    const config = await repo.load(dir);
    expect(config.prepare).toBeNull();
    expect(config.server).toBeNull();
    expect(config.cleanup).toBeNull();
  });

  test("parses JSONC with comments", async () => {
    const dir = await setup(`{
      // setup command
      "prepare": "npm install",
      /* dev server */
      "server": "npm start"
    }`);
    const repo = new WorkspaceConfigRepository();
    const config = await repo.load(dir);
    expect(config.prepare).toBe("npm install");
    expect(config.server).toBe("npm start");
    expect(config.cleanup).toBeNull();
  });

  test("handles partial config (only some fields)", async () => {
    const dir = await setup(JSON.stringify({ server: "bun run dev" }));
    const repo = new WorkspaceConfigRepository();
    const config = await repo.load(dir);
    expect(config.prepare).toBeNull();
    expect(config.server).toBe("bun run dev");
    expect(config.cleanup).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server && bun test src/repositories/workspace-config/file/index.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 4: Write implementation**

```typescript
// server/src/repositories/workspace-config/file/index.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "jsonc-parser";
import { WorkspaceConfig } from "../../../models/workspace-config";
import type { IWorkspaceConfigRepository } from "../repository";

const CONFIG_FILENAME = "auto-kanban.json";

export class WorkspaceConfigRepository implements IWorkspaceConfigRepository {
  async load(workingDir: string): Promise<WorkspaceConfig> {
    const filePath = join(workingDir, CONFIG_FILENAME);
    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      return WorkspaceConfig.empty();
    }

    try {
      const parsed = parse(content);
      if (typeof parsed !== "object" || parsed === null) {
        console.warn(`[WorkspaceConfig] Invalid format in ${filePath}`);
        return WorkspaceConfig.empty();
      }
      return {
        prepare: typeof parsed.prepare === "string" ? parsed.prepare : null,
        server: typeof parsed.server === "string" ? parsed.server : null,
        cleanup: typeof parsed.cleanup === "string" ? parsed.cleanup : null,
      };
    } catch {
      console.warn(`[WorkspaceConfig] Parse error in ${filePath}`);
      return WorkspaceConfig.empty();
    }
  }
}
```

```typescript
// server/src/repositories/workspace-config/index.ts
export { WorkspaceConfigRepository } from "./file";
export type { IWorkspaceConfigRepository } from "./repository";
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd server && bun test src/repositories/workspace-config/file/index.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add server/src/repositories/workspace-config/
git commit -m "feat: add WorkspaceConfigRepository with JSONC file loading"
```

---

### Task 4: Register WorkspaceConfigRepository in Context

**Files:**
- Modify: `server/src/types/repository.ts`
- Modify: `server/src/types/context.ts`
- Modify: `server/src/context.ts`

- [ ] **Step 1: Add interface export to types/repository.ts**

Add to the bottom of the "External System Repositories" re-exports section in `server/src/types/repository.ts`:

```typescript
export type { IWorkspaceConfigRepository } from "../repositories/workspace-config/repository";
```

- [ ] **Step 2: Add to Repos interface in types/context.ts**

Add `workspaceConfig` to the `Repos` interface in `server/src/types/context.ts`, in the "External System Repositories" section:

```typescript
workspaceConfig: IWorkspaceConfigRepository;
```

Also add the import:

```typescript
import type { IWorkspaceConfigRepository } from "./repository";
```

- [ ] **Step 3: Instantiate and register in context.ts**

In `server/src/context.ts`, add import:

```typescript
import { WorkspaceConfigRepository } from "./repositories/workspace-config";
```

In the `createContext` function, add instantiation and registration:

```typescript
const workspaceConfigRepo = new WorkspaceConfigRepository();
```

Add to the returned `repos` object:

```typescript
workspaceConfig: workspaceConfigRepo,
```

- [ ] **Step 4: Run type check**

```bash
bun run check:type
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/types/repository.ts server/src/types/context.ts server/src/context.ts
git commit -m "feat: register WorkspaceConfigRepository in DI context"
```

---

### Task 5: Create JSON Schema and MCP resource

**Files:**
- Create: `server/src/schemas/auto-kanban.schema.json`
- Modify: `server/src/mcp/index.ts`

- [ ] **Step 1: Create JSON Schema file**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "auto-kanban.json",
  "description": "AutoKanban workspace configuration file",
  "type": "object",
  "properties": {
    "prepare": {
      "type": "string",
      "description": "Command to run after worktree creation, before agent execution"
    },
    "server": {
      "type": "string",
      "description": "Command to start the development server"
    },
    "cleanup": {
      "type": "string",
      "description": "Command to run before worktree deletion on session end"
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 2: Add resources capability and handler to MCP server**

In `server/src/mcp/index.ts`, add imports:

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
```

Update capabilities to include `resources`:

```typescript
{
  capabilities: { tools: {}, resources: {} },
  instructions: "...", // updated in Task 8
}
```

After `await registerMcpTools(server, client);`, add resource handlers:

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "auto-kanban://schema",
      name: "auto-kanban.json schema",
      description:
        "JSON Schema for auto-kanban.json workspace configuration file",
      mimeType: "application/schema+json",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === "auto-kanban://schema") {
    const schemaPath = join(import.meta.dir, "../schemas/auto-kanban.schema.json");
    const schema = readFileSync(schemaPath, "utf-8");
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/schema+json",
          text: schema,
        },
      ],
    };
  }
  throw new Error(`Unknown resource: ${request.params.uri}`);
});
```

- [ ] **Step 3: Run type check**

```bash
bun run check:type
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/schemas/auto-kanban.schema.json server/src/mcp/index.ts
git commit -m "feat: add JSON Schema for auto-kanban.json and MCP resource"
```

---

### Task 6: Remove script columns from DB and Project model

**Files:**
- Modify: `server/schema.sql`
- Modify: `server/src/models/project.ts`
- Modify: `server/src/repositories/project/postgres/common.ts`
- Modify: `server/src/repositories/project/postgres/upsert.ts`

- [ ] **Step 1: Remove script columns from schema.sql**

In `server/schema.sql`, remove these three lines from the `projects` table:

```sql
  setup_script TEXT,
  cleanup_script TEXT,
  dev_server_script TEXT,
```

- [ ] **Step 2: Remove script fields from Project interface and factory**

In `server/src/models/project.ts`, remove from the `Project` interface (lines 31-33):

```typescript
setupScript: string | null;
cleanupScript: string | null;
devServerScript: string | null;
```

Remove from the `Project.create` factory params type:

```typescript
setupScript?: string | null;
cleanupScript?: string | null;
devServerScript?: string | null;
```

Remove from the factory return object:

```typescript
setupScript: params.setupScript ?? null,
cleanupScript: params.cleanupScript ?? null,
devServerScript: params.devServerScript ?? null,
```

- [ ] **Step 3: Update ProjectRow and rowToProject in common.ts**

In `server/src/repositories/project/postgres/common.ts`, remove from `ProjectRow`:

```typescript
setup_script: string | null;
cleanup_script: string | null;
dev_server_script: string | null;
```

Remove from `rowToProject`:

```typescript
setupScript: row.setup_script,
cleanupScript: row.cleanup_script,
devServerScript: row.dev_server_script,
```

- [ ] **Step 4: Update upsert.ts**

Replace the entire query in `server/src/repositories/project/postgres/upsert.ts`:

```typescript
export async function upsert(db: PgDatabase, project: Project): Promise<void> {
  await db.queryRun({
    query: `INSERT INTO projects (id, name, description, repo_path, branch, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           repo_path = excluded.repo_path,
           branch = excluded.branch,
           updated_at = excluded.updated_at`,
    params: [
      project.id,
      project.name,
      project.description,
      project.repoPath,
      project.branch,
      dateToSQL(project.createdAt),
      dateToSQL(project.updatedAt),
    ],
  });
}
```

- [ ] **Step 5: Run type check to find remaining references**

```bash
bun run check:type
```

Expected: Type errors in files referencing `setupScript`, `cleanupScript`, `devServerScript` — these are fixed in subsequent tasks.

- [ ] **Step 6: Commit (with --no-verify since type errors remain)**

Do NOT commit yet — continue to Task 7 to fix all references first.

---

### Task 7: Remove script references from server code

**Files:**
- Modify: `server/src/usecases/project/update-project.ts`
- Modify: `server/src/usecases/project/create-project.ts`
- Modify: `server/src/presentation/routers/project.ts`
- Modify: `server/src/mcp/tools.ts`
- Modify: `server/src/mcp/index.ts`

- [ ] **Step 1: Clean up update-project.ts**

Remove `setupScript`, `cleanupScript`, `devServerScript` from `UpdateProjectInput` and the `process` step spread-merge:

```typescript
// server/src/usecases/project/update-project.ts
import { fail } from "../../models/common";
import { Project } from "../../models/project";
import { usecase } from "../runner";

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  description?: string | null;
}

export const updateProject = (input: UpdateProjectInput) =>
  usecase({
    read: async (ctx) => {
      const project = await ctx.repos.project.get(
        Project.ById(input.projectId),
      );
      if (!project) {
        return fail("NOT_FOUND", "Project not found", {
          projectId: input.projectId,
        });
      }
      return { project };
    },

    process: (_ctx, { project }) => {
      const updated = {
        ...project,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        updatedAt: new Date(),
      };
      return { project: updated };
    },

    write: async (ctx, { project }) => {
      await ctx.repos.project.upsert(project);
      return project;
    },
  });
```

- [ ] **Step 2: Clean up create-project.ts**

Remove script fields from `CreateProjectInput` and `Project.create()` call. Also remove the `devServerScript` condition check for templates:

```typescript
// server/src/usecases/project/create-project.ts
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  repoPath: string;
  branch?: string;
}
```

In the `process` step:

```typescript
process: () => {
  const project = Project.create({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    repoPath: input.repoPath,
    branch: input.branch || "main",
  });
  return { project };
},
```

In the `write` step, remove the `devServerScript` template condition. Replace:

```typescript
if (
  tmpl.condition === "no_dev_server" &&
  project.devServerScript !== null
) {
  continue;
}
```

With:

```typescript
if (tmpl.condition === "no_dev_server") {
  continue;
}
```

Note: The `no_dev_server` template condition can no longer be evaluated at project creation time since the script config is now in the worktree. For now, skip these templates unconditionally. This condition will be revisited when workspace session startup reads `auto-kanban.json`.

- [ ] **Step 3: Clean up project router**

In `server/src/presentation/routers/project.ts`, remove script fields from `create` and `update` input schemas:

For `create`:

```typescript
.input(
  z.object({
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    repoPath: z.string().min(1),
    branch: z.string().optional(),
  }),
)
```

For `update`:

```typescript
.input(
  z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
  }),
)
```

- [ ] **Step 4: Remove MCP script-update tools**

In `server/src/mcp/tools.ts`, delete the three tool definitions: `update_setup_script`, `update_cleanup_script`, `update_dev_server_script` (the objects with those `name` values in the tools array).

- [ ] **Step 5: Update MCP instructions**

In `server/src/mcp/index.ts`, replace the `instructions` string:

```typescript
instructions:
  "A task and project management server. If you need to create or update tickets or tasks then use these tools. Most of them absolutely require that you pass the `project_id` of the project that you are currently working on. You can get project ids by using `list_projects`. Call `list_tasks` to fetch the `task_ids` of all the tasks in a project. TOOLS: 'list_projects', 'list_tasks', 'create_task', 'start_workspace_session', 'get_task', 'update_task', 'delete_task'. Make sure to pass `project_id` or `task_id` where required. You can use list tools to get the available ids. WORKSPACE CONFIG: Project workspace settings are managed via `auto-kanban.json` (JSONC format) at the worktree root. Fields: `prepare` (setup command), `server` (dev server command), `cleanup` (teardown command). Schema available via MCP resource `auto-kanban://schema`.",
```

- [ ] **Step 6: Run type check and tests**

```bash
bun run check:type && bun run check:test
```

Expected: PASS (aside from any test files that reference removed script fields — fix those inline)

- [ ] **Step 7: Commit**

```bash
git add server/schema.sql server/src/models/project.ts server/src/repositories/project/postgres/ server/src/usecases/project/ server/src/presentation/routers/project.ts server/src/mcp/
git commit -m "refactor: remove script columns from DB/Project model and MCP tools"
```

---

### Task 8: Update devServer startup to use WorkspaceConfig

**Files:**
- Modify: `server/src/usecases/dev-server/start-dev-server.ts`

- [ ] **Step 1: Update start-dev-server.ts**

Replace the project script check with WorkspaceConfig loading. Change the `read` step:

Remove:

```typescript
if (!project.devServerScript) {
  return fail("INVALID_STATE", "Project has no dev server script");
}
```

Add after `worktreePath` is resolved:

```typescript
const config = await ctx.repos.workspaceConfig.load(worktreePath);
if (!config.server) {
  return fail("INVALID_STATE", "No server script in auto-kanban.json");
}
```

Add `serverCommand: config.server` to the return object (alongside `project`, `session`, etc.).

In the `post` step, change:

```typescript
command: data.project.devServerScript as string,
```

to:

```typescript
command: data.serverCommand,
```

- [ ] **Step 2: Run tests**

```bash
bun run check:type && bun run check:test
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/usecases/dev-server/start-dev-server.ts
git commit -m "refactor: devServer startup reads server command from auto-kanban.json"
```

---

### Task 9: Create run-prepare and run-cleanup usecases

**Files:**
- Create: `server/src/usecases/workspace/run-workspace-script.ts`
- Test: `server/src/usecases/workspace/run-workspace-script.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// server/src/usecases/workspace/run-workspace-script.test.ts
import { describe, expect, test } from "bun:test";
import { WorkspaceConfig } from "../../models/workspace-config";
import { runWorkspaceScript } from "./run-workspace-script";

describe("runWorkspaceScript", () => {
  test("fails when task not found", async () => {
    const result = await runWorkspaceScript({
      taskId: "non-existent",
      scriptType: "prepare",
    }).run({
      now: new Date(),
      logger: { child: () => ({}) } as any,
      repos: {
        task: { get: async () => null },
      } as any,
      logStreamer: {} as any,
    });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && bun test src/usecases/workspace/run-workspace-script.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// server/src/usecases/workspace/run-workspace-script.ts
import { fail } from "../../models/common";
import { ExecutionProcess } from "../../models/execution-process";
import { Project } from "../../models/project";
import { Session } from "../../models/session";
import { Task } from "../../models/task";
import { Workspace } from "../../models/workspace";
import { usecase } from "../runner";

export type WorkspaceScriptType = "prepare" | "cleanup";

export interface RunWorkspaceScriptInput {
  taskId: string;
  scriptType: WorkspaceScriptType;
}

const RUN_REASON_MAP = {
  prepare: "setupscript",
  cleanup: "cleanupscript",
} as const;

export const runWorkspaceScript = (input: RunWorkspaceScriptInput) =>
  usecase({
    read: async (ctx) => {
      const task = await ctx.repos.task.get(Task.ById(input.taskId));
      if (!task) {
        return fail("NOT_FOUND", "Task not found", { taskId: input.taskId });
      }

      const project = await ctx.repos.project.get(
        Project.ById(task.projectId),
      );
      if (!project) {
        return fail("NOT_FOUND", "Project not found", {
          projectId: task.projectId,
        });
      }

      const workspace = await ctx.repos.workspace.get(
        Workspace.ByTaskIdActive(input.taskId),
      );
      if (!workspace) {
        return fail("NOT_FOUND", "No active workspace for task");
      }

      if (!workspace.worktreePath) {
        return fail("INVALID_STATE", "Workspace has no worktree path");
      }

      const worktreePath = ctx.repos.worktree.getWorktreePath(
        workspace.id,
        project.name,
      );

      const config = await ctx.repos.workspaceConfig.load(worktreePath);
      const command = config[input.scriptType];
      if (!command) {
        return fail(
          "INVALID_STATE",
          `No ${input.scriptType} script in auto-kanban.json`,
        );
      }

      // Check for already running workspace scripts in this session
      const sessionPage = await ctx.repos.session.list(
        Session.ByWorkspaceId(workspace.id),
        { limit: 1, sort: { keys: ["createdAt", "id"], order: "desc" } },
      );
      if (sessionPage.items.length === 0) {
        return fail("NOT_FOUND", "No session found for workspace");
      }
      const session = sessionPage.items[0];

      const runningSetup = await ctx.repos.executionProcess.list(
        ExecutionProcess.BySessionId(session.id)
          .and(ExecutionProcess.ByRunReason("setupscript"))
          .and(ExecutionProcess.ByStatus("running")),
        { limit: 1, sort: ExecutionProcess.defaultSort },
      );
      const runningCleanup = await ctx.repos.executionProcess.list(
        ExecutionProcess.BySessionId(session.id)
          .and(ExecutionProcess.ByRunReason("cleanupscript"))
          .and(ExecutionProcess.ByStatus("running")),
        { limit: 1, sort: ExecutionProcess.defaultSort },
      );
      if (
        runningSetup.items.length > 0 ||
        runningCleanup.items.length > 0
      ) {
        return fail(
          "INVALID_STATE",
          "Another workspace script is already running",
        );
      }

      return { session, worktreePath, command };
    },

    process: (_ctx, data) => {
      const ep = ExecutionProcess.create({
        sessionId: data.session.id,
        runReason: RUN_REASON_MAP[input.scriptType],
      });
      return { ...data, executionProcess: ep };
    },

    write: async (ctx, data) => {
      await ctx.repos.executionProcess.upsert(data.executionProcess);
      return data;
    },

    post: (ctx, data) => {
      ctx.repos.devServer.start({
        processId: data.executionProcess.id,
        command: data.command,
        workingDir: data.worktreePath,
      });
      return data;
    },

    result: (data) => ({
      executionProcessId: data.executionProcess.id,
    }),
  });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && bun test src/usecases/workspace/run-workspace-script.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/usecases/workspace/
git commit -m "feat: add runWorkspaceScript usecase for prepare/cleanup execution"
```

---

### Task 10: Add tRPC endpoints for prepare/cleanup

**Files:**
- Modify: `server/src/presentation/routers/execution.ts`
- Modify: `server/src/presentation/routers/index.ts` (if workspace router is separate)

- [ ] **Step 1: Add endpoints to execution router**

In `server/src/presentation/routers/execution.ts`, add import:

```typescript
import { runWorkspaceScript } from "../../usecases/workspace/run-workspace-script";
```

Add two new procedures to the `executionRouter`:

```typescript
runPrepare: publicProcedure
  .input(z.object({ taskId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) =>
    handleResult(
      await runWorkspaceScript({
        taskId: input.taskId,
        scriptType: "prepare",
      }).run(ctx),
    ),
  ),

runCleanup: publicProcedure
  .input(z.object({ taskId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) =>
    handleResult(
      await runWorkspaceScript({
        taskId: input.taskId,
        scriptType: "cleanup",
      }).run(ctx),
    ),
  ),
```

- [ ] **Step 2: Run type check**

```bash
bun run check:type
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add server/src/presentation/routers/execution.ts
git commit -m "feat: add execution.runPrepare and execution.runCleanup tRPC endpoints"
```

---

### Task 11: Remove script fields from client code

**Files:**
- Modify: `client/src/store/project.ts`
- Modify: `client/src/lib/mappers.ts`
- Modify: `client/src/hooks/useProjects.ts`

- [ ] **Step 1: Remove from store/project.ts**

Remove these lines from the `Project` interface:

```typescript
setupScript: string | null;
cleanupScript: string | null;
devServerScript: string | null;
```

- [ ] **Step 2: Remove from mappers.ts**

In `mapProject`, remove `setupScript`, `cleanupScript`, `devServerScript` from both the input type annotation and the return object.

In `mapProjectWithStats`, the same fields are removed via spread from `mapProject`.

- [ ] **Step 3: Remove from hooks/useProjects.ts**

Remove script fields from `CreateProjectInput` and `UpdateProjectInput` interfaces.

- [ ] **Step 4: Fix remaining client references**

Run type check to find any remaining references:

```bash
cd client && bunx tsc --noEmit
```

Fix any files that still reference the removed fields (e.g., `ProjectForm.tsx` `devScript` prop, `ProjectsPage.tsx` edit handler).

In `ProjectForm.tsx`: Remove the `devScript` field/state/input entirely.

In `ProjectsPage.tsx`: Remove `devServerScript` from the `handleEditSubmit` handler.

- [ ] **Step 5: Run full checks**

```bash
bun run check:type && bun run check:lint
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/store/project.ts client/src/lib/mappers.ts client/src/hooks/useProjects.ts client/src/components/ client/src/pages/
git commit -m "refactor: remove script fields from client code"
```

---

### Task 12: Add Workspace tab to TaskDetailFullscreen

**Files:**
- Create: `client/src/components/task/WorkspacePanel.tsx`
- Create: `client/src/hooks/useWorkspaceScript.ts`
- Modify: `client/src/components/task/TaskDetailFullscreen.tsx`

- [ ] **Step 1: Create useWorkspaceScript hook**

```typescript
// client/src/hooks/useWorkspaceScript.ts
import { useState } from "react";
import { useLogStream } from "@/hooks/useLogStream";
import { trpc } from "@/trpc";

export function useWorkspaceScript(taskId: string) {
  const [executionProcessId, setExecutionProcessId] = useState<string | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [lastScriptType, setLastScriptType] = useState<
    "prepare" | "cleanup" | null
  >(null);

  const { logs, isStreaming } = useLogStream({
    executionProcessId: executionProcessId ?? undefined,
  });

  const runPrepare = trpc.execution.runPrepare.useMutation({
    onSuccess: (data) => {
      setExecutionProcessId(data.executionProcessId);
      setIsRunning(true);
      setLastScriptType("prepare");
    },
  });

  const runCleanup = trpc.execution.runCleanup.useMutation({
    onSuccess: (data) => {
      setExecutionProcessId(data.executionProcessId);
      setIsRunning(true);
      setLastScriptType("cleanup");
    },
  });

  // Detect completion from log stream
  if (isRunning && !isStreaming && executionProcessId && logs.length > 0) {
    setIsRunning(false);
  }

  return {
    logs,
    isStreaming,
    isRunning: isRunning || runPrepare.isPending || runCleanup.isPending,
    lastScriptType,
    runPrepare: () => runPrepare.mutate({ taskId }),
    runCleanup: () => runCleanup.mutate({ taskId }),
    error: runPrepare.error || runCleanup.error,
  };
}
```

- [ ] **Step 2: Create WorkspacePanel component**

```typescript
// client/src/components/task/WorkspacePanel.tsx
import { LogViewer } from "@/components/chat/LogViewer";
import { useWorkspaceScript } from "@/hooks/useWorkspaceScript";
import { cn } from "@/lib/utils";

interface WorkspacePanelProps {
  taskId: string;
}

export function WorkspacePanel({ taskId }: WorkspacePanelProps) {
  const {
    logs,
    isStreaming,
    isRunning,
    lastScriptType,
    runPrepare,
    runCleanup,
  } = useWorkspaceScript(taskId);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Action bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runPrepare}
          disabled={isRunning}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
            isRunning
              ? "cursor-not-allowed bg-[#E87B35]/50"
              : "bg-[#E87B35] hover:bg-[#F5924D]",
          )}
        >
          Prepare
        </button>
        <button
          type="button"
          onClick={runCleanup}
          disabled={isRunning}
          className={cn(
            "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
            isRunning
              ? "cursor-not-allowed border-[#E4E4E7] text-[#A1A1AA]"
              : "border-[#E4E4E7] text-[#71717A] hover:bg-[#F5F5F5]",
          )}
        >
          Cleanup
        </button>
        {lastScriptType && (
          <span
            className={cn(
              "rounded px-2 py-1 text-xs font-semibold",
              isRunning
                ? "bg-[#E87B35] text-white"
                : "bg-[#22C55E] text-white",
            )}
          >
            {isRunning ? "Running..." : "Completed"}
          </span>
        )}
        <div className="flex-1" />
        <span className="font-mono text-xs text-[#A1A1AA]">
          auto-kanban.json
        </span>
      </div>

      {/* Unified log viewer */}
      <div className="min-h-0 flex-1">
        {logs.length > 0 || isStreaming ? (
          <LogViewer logs={logs} isStreaming={isStreaming} className="h-full" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-md bg-[#1A1A2E]">
            <span className="font-mono text-sm text-[#52525B]">
              Click Prepare or Cleanup to run a workspace script
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add Workspace tab to TaskDetailFullscreen**

In `client/src/components/task/TaskDetailFullscreen.tsx`, update the `TABS` array:

```typescript
const TABS = [
  { id: "description", label: "Description" },
  { id: "changes", label: "Changes" },
  { id: "preview", label: "Preview" },
  { id: "workspace", label: "Workspace" },
];
```

Add import:

```typescript
import { WorkspacePanel } from "@/components/task/WorkspacePanel";
```

In the right panel's tab content rendering (find where `activeTab === "preview"` is checked), add:

```typescript
{activeTab === "workspace" && <WorkspacePanel taskId={taskId} />}
```

- [ ] **Step 4: Run checks**

```bash
bun run check:type && bun run check:lint
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useWorkspaceScript.ts client/src/components/task/WorkspacePanel.tsx client/src/components/task/TaskDetailFullscreen.tsx
git commit -m "feat: add Workspace tab with prepare/cleanup execution UI"
```

---

### Task 13: Run full test suite and fix issues

**Files:**
- Various test files that may reference removed script fields

- [ ] **Step 1: Run all checks**

```bash
bun run check:lint && bun run check:type && bun run check:test && bun run check:arch
```

- [ ] **Step 2: Fix any failing tests**

Common fixes needed:
- Test helpers that create projects with script fields — remove those fields
- Integration tests that assert on script columns — update assertions
- Mock contexts that include/exclude `workspaceConfig` repo — add to mocks

- [ ] **Step 3: Run checks again**

```bash
bun run check:lint && bun run check:type && bun run check:test && bun run check:arch
```

Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: update tests for workspace config migration"
```
