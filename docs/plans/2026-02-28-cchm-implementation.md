# cchm Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-platform CLI tool (`cchm`) that manages Claude Code hooks by reading/writing `~/.claude/settings.json` and storing hook content files in `~/.claude/hooks/`.

**Architecture:** Commander.js CLI with subcommands per hook event. Hook content stored as flat files (.md/.sh), metadata in `.cchm.json` sidecar, settings.json updated atomically. cchm itself acts as the runner via `cchm run <path>`.

**Tech Stack:** TypeScript, Bun (dev), Node.js (publish), commander.js, ESLint (strict), Prettier

---

### Task 1: Initialize project with bun

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Initialize package.json**

Run: `bun init`

Then update `package.json` to:

```json
{
  "name": "claude-code-hook-manager",
  "version": "0.1.0",
  "description": "CLI tool to manage Claude Code hooks",
  "type": "module",
  "bin": {
    "cchm": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "bun run src/index.ts",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/"
  },
  "keywords": ["claude", "hooks", "cli"],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Install dependencies**

Run: `bun add commander`
Run: `bun add -d typescript @types/node`

**Step 4: Create .gitignore**

```
node_modules/
dist/
*.tgz
```

**Step 5: Commit**

```bash
git add package.json tsconfig.json bun.lock .gitignore
git commit -m "Initialize project with bun, typescript, commander"
```

---

### Task 2: Set up strict ESLint + Prettier

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`

**Step 1: Install ESLint and Prettier deps**

Run: `bun add -d eslint @eslint/js typescript-eslint prettier eslint-config-prettier`

**Step 2: Create eslint.config.js (flat config)**

Use flat config format (ESLint v9+). Rules to enforce:
- `no-ternary: "error"` -- ban ternary operations
- `no-nested-ternary: "error"` -- redundant but explicit
- `@typescript-eslint/no-explicit-any: "error"` -- no any types
- `@typescript-eslint/explicit-function-return-type: "error"` -- explicit returns
- `@typescript-eslint/strict-boolean-expressions: "error"` -- no truthy/falsy shortcuts
- `eqeqeq: ["error", "always"]` -- strict equality
- `no-var: "error"` -- const/let only
- `prefer-const: "error"` -- const when possible
- `no-console: "off"` -- CLI needs console
- `curly: ["error", "all"]` -- always use braces

```js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-ternary": "error",
      "no-nested-ternary": "error",
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      curly: ["error", "all"],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "eslint.config.js"],
  }
);
```

**Step 3: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

**Step 4: Create a minimal src/index.ts to verify linting works**

```typescript
console.log("cchm");
```

**Step 5: Verify lint and format work**

Run: `bun run lint`
Run: `bun run format:check`

**Step 6: Commit**

```bash
git add eslint.config.js .prettierrc src/index.ts
git commit -m "Add strict eslint and prettier configuration"
```

---

### Task 3: Core lib - paths.ts and hooks.ts (constants)

**Files:**
- Create: `src/lib/paths.ts`
- Create: `src/lib/hooks.ts`

**Step 1: Create src/lib/hooks.ts**

Contains the list of valid hook events and kind types:

```typescript
export const HOOK_EVENTS = [
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "PermissionRequest",
  "ConfigChange",
  "PreCompact",
  "SessionEnd",
  "TeammateIdle",
  "TaskCompleted",
  "WorktreeCreate",
  "WorktreeRemove",
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number];

export type HookKind = "prompt" | "script";

export function isValidHookEvent(value: string): value is HookEvent {
  return HOOK_EVENTS.includes(value as HookEvent);
}

export function getFileExtension(kind: HookKind): string {
  if (kind === "prompt") {
    return ".md";
  }
  return ".sh";
}

export function getPromptTemplate(name: string, event: HookEvent): string {
  return `# ${name}\n\n<!-- This prompt will be injected into Claude Code on ${event} -->\n\n`;
}

export function getScriptTemplate(name: string, event: HookEvent): string {
  return `#!/usr/bin/env bash\n# ${name} - runs on ${event}\n# stdin receives hook input JSON\n# exit 0 = success, exit 2 = block with error\n\nset -euo pipefail\n\n`;
}
```

**Step 2: Create src/lib/paths.ts**

Cross-platform path resolution:

```typescript
import { homedir } from "os";
import { join, resolve } from "path";

const CLAUDE_DIR = ".claude";
const HOOKS_DIR = "hooks";
const METADATA_FILE = ".cchm.json";
const SETTINGS_FILE = "settings.json";

export function getGlobalClaudeDir(): string {
  return join(homedir(), CLAUDE_DIR);
}

export function getGlobalHooksDir(): string {
  return join(getGlobalClaudeDir(), HOOKS_DIR);
}

export function getGlobalSettingsPath(): string {
  return join(getGlobalClaudeDir(), SETTINGS_FILE);
}

export function getGlobalMetadataPath(): string {
  return join(getGlobalHooksDir(), METADATA_FILE);
}

export function getProjectClaudeDir(): string {
  return join(process.cwd(), CLAUDE_DIR);
}

export function getProjectHooksDir(): string {
  return join(getProjectClaudeDir(), HOOKS_DIR);
}

export function getProjectSettingsPath(): string {
  return join(getProjectClaudeDir(), SETTINGS_FILE);
}

export function getProjectMetadataPath(): string {
  return join(getProjectHooksDir(), METADATA_FILE);
}

export function getHooksDir(project: boolean): string {
  if (project) {
    return getProjectHooksDir();
  }
  return getGlobalHooksDir();
}

export function getSettingsPath(project: boolean): string {
  if (project) {
    return getProjectSettingsPath();
  }
  return getGlobalSettingsPath();
}

export function getMetadataPath(project: boolean): string {
  if (project) {
    return getProjectMetadataPath();
  }
  return getGlobalMetadataPath();
}

export function resolveHookFilePath(hooksDir: string, relativePath: string): string {
  return resolve(hooksDir, relativePath);
}
```

**Step 3: Run lint**

Run: `bun run lint`

**Step 4: Commit**

```bash
git add src/lib/paths.ts src/lib/hooks.ts
git commit -m "Add path resolution and hook constants"
```

---

### Task 4: Core lib - metadata.ts

**Files:**
- Create: `src/lib/metadata.ts`

**Step 1: Create src/lib/metadata.ts**

Handles reading/writing the `.cchm.json` sidecar file:

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { HookEvent, HookKind } from "./hooks.js";

export interface HookEntry {
  name: string;
  event: HookEvent;
  kind: HookKind;
  matcher: string | null;
  file: string;
  createdAt: string;
}

export interface MetadataFile {
  hooks: HookEntry[];
}

export function readMetadata(metadataPath: string): MetadataFile {
  if (!existsSync(metadataPath)) {
    return { hooks: [] };
  }
  const content = readFileSync(metadataPath, "utf8");
  return JSON.parse(content) as MetadataFile;
}

export function writeMetadata(metadataPath: string, metadata: MetadataFile): void {
  const dir = dirname(metadataPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
}

export function findHookEntry(
  metadata: MetadataFile,
  event: HookEvent,
  name: string,
): HookEntry | undefined {
  return metadata.hooks.find((h) => h.event === event && h.name === name);
}

export function addHookEntry(metadata: MetadataFile, entry: HookEntry): MetadataFile {
  return { hooks: [...metadata.hooks, entry] };
}

export function removeHookEntry(
  metadata: MetadataFile,
  event: HookEvent,
  name: string,
): MetadataFile {
  return {
    hooks: metadata.hooks.filter((h) => !(h.event === event && h.name === name)),
  };
}
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/lib/metadata.ts
git commit -m "Add metadata sidecar read/write"
```

---

### Task 5: Core lib - settings.ts

**Files:**
- Create: `src/lib/settings.ts`

**Step 1: Create src/lib/settings.ts**

Handles reading/writing/merging hooks into Claude Code's `settings.json`. Must preserve all existing keys and only touch the `hooks` section. Must not clobber hooks not managed by cchm.

```typescript
import { readFileSync, writeFileSync, existsSync } from "fs";
import type { HookEvent } from "./hooks.js";

interface HookHandler {
  type: string;
  command: string;
  timeout?: number;
  async?: boolean;
}

interface HookMatcherGroup {
  matcher?: string;
  hooks: HookHandler[];
}

interface SettingsHooks {
  [event: string]: HookMatcherGroup[];
}

interface SettingsFile {
  hooks?: SettingsHooks;
  [key: string]: unknown;
}

export function readSettings(settingsPath: string): SettingsFile {
  if (!existsSync(settingsPath)) {
    return {};
  }
  const content = readFileSync(settingsPath, "utf8");
  return JSON.parse(content) as SettingsFile;
}

export function writeSettings(settingsPath: string, settings: SettingsFile): void {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

function buildCommand(relativePath: string): string {
  return `cchm run ${relativePath}`;
}

function isCchmHook(handler: HookHandler): boolean {
  return handler.command.startsWith("cchm run ");
}

export function addHookToSettings(
  settings: SettingsFile,
  event: HookEvent,
  relativePath: string,
  matcher: string | null,
): SettingsFile {
  const hooks = settings.hooks ?? {};
  const eventGroups = hooks[event] ?? [];
  const command = buildCommand(relativePath);

  const newHandler: HookHandler = {
    type: "command",
    command,
  };

  // Find existing group with same matcher (or no matcher)
  const matcherStr = matcher ?? undefined;
  const existingGroupIndex = eventGroups.findIndex((g) => g.matcher === matcherStr);

  let updatedGroups: HookMatcherGroup[];
  if (existingGroupIndex >= 0) {
    // Add handler to existing group
    updatedGroups = eventGroups.map((g, i) => {
      if (i === existingGroupIndex) {
        return { ...g, hooks: [...g.hooks, newHandler] };
      }
      return g;
    });
  } else {
    // Create new matcher group
    const newGroup: HookMatcherGroup = {
      hooks: [newHandler],
    };
    if (matcher !== null) {
      newGroup.matcher = matcher;
    }
    updatedGroups = [...eventGroups, newGroup];
  }

  return {
    ...settings,
    hooks: {
      ...hooks,
      [event]: updatedGroups,
    },
  };
}

export function removeHookFromSettings(
  settings: SettingsFile,
  event: HookEvent,
  relativePath: string,
): SettingsFile {
  const hooks = settings.hooks;
  if (hooks === undefined) {
    return settings;
  }

  const eventGroups = hooks[event];
  if (eventGroups === undefined) {
    return settings;
  }

  const command = buildCommand(relativePath);

  // Remove the handler with matching command from all groups
  const updatedGroups = eventGroups
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((h) => h.command !== command),
    }))
    .filter((group) => group.hooks.length > 0);

  const updatedHooks = { ...hooks };
  if (updatedGroups.length === 0) {
    delete updatedHooks[event];
  } else {
    updatedHooks[event] = updatedGroups;
  }

  // Remove hooks key entirely if empty
  if (Object.keys(updatedHooks).length === 0) {
    const { hooks: _removed, ...rest } = settings;
    return rest;
  }

  return {
    ...settings,
    hooks: updatedHooks,
  };
}
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/lib/settings.ts
git commit -m "Add settings.json read/write/merge"
```

---

### Task 6: Core lib - editor.ts

**Files:**
- Create: `src/lib/editor.ts`

**Step 1: Create src/lib/editor.ts**

Cross-platform $EDITOR support:

```typescript
import { execSync } from "child_process";
import { platform } from "os";

function getDefaultEditor(): string {
  if (platform() === "win32") {
    return "notepad";
  }
  return "vi";
}

function getEditor(): string {
  const editor = process.env["EDITOR"] ?? process.env["VISUAL"];
  if (editor !== undefined && editor !== "") {
    return editor;
  }
  return getDefaultEditor();
}

export function openInEditor(filePath: string): void {
  const editor = getEditor();
  execSync(`${editor} "${filePath}"`, {
    stdio: "inherit",
  });
}
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/lib/editor.ts
git commit -m "Add cross-platform editor support"
```

---

### Task 7: Command - run.ts

**Files:**
- Create: `src/commands/run.ts`

**Step 1: Create src/commands/run.ts**

The runner command. This is what settings.json hook entries call: `cchm run <path>`.

```typescript
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { extname } from "path";
import { platform } from "os";
import { resolveHookFilePath, getGlobalHooksDir } from "../lib/paths.js";

function getShell(): string {
  if (platform() === "win32") {
    return "powershell.exe";
  }
  return "bash";
}

export function runHook(relativePath: string): void {
  const hooksDir = getGlobalHooksDir();
  const absolutePath = resolveHookFilePath(hooksDir, relativePath);
  const ext = extname(relativePath).toLowerCase();

  if (ext === ".md") {
    const content = readFileSync(absolutePath, "utf8");
    process.stdout.write(content);
    return;
  }

  if (ext === ".sh") {
    const shell = getShell();
    execSync(`${shell} "${absolutePath}"`, {
      stdio: "inherit",
      cwd: process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd(),
    });
    return;
  }

  console.error(`Unknown file extension: ${ext}`);
  process.exit(1);
}
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/commands/run.ts
git commit -m "Add run command for hook execution"
```

---

### Task 8: Command - add.ts

**Files:**
- Create: `src/commands/add.ts`

**Step 1: Create src/commands/add.ts**

The add command. Creates hook file, opens editor, registers in metadata and settings.

```typescript
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { HookEvent, HookKind } from "../lib/hooks.js";
import { getFileExtension, getPromptTemplate, getScriptTemplate } from "../lib/hooks.js";
import { getHooksDir, getSettingsPath, getMetadataPath } from "../lib/paths.js";
import { readMetadata, writeMetadata, findHookEntry, addHookEntry } from "../lib/metadata.js";
import { readSettings, writeSettings, addHookToSettings } from "../lib/settings.js";
import { openInEditor } from "../lib/editor.js";

export function addHook(
  event: HookEvent,
  kind: HookKind,
  name: string,
  matcher: string | null,
  project: boolean,
): void {
  const hooksDir = getHooksDir(project);
  const settingsPath = getSettingsPath(project);
  const metadataPath = getMetadataPath(hooksDir);

  // Check uniqueness
  const metadata = readMetadata(metadataPath);
  const existing = findHookEntry(metadata, event, name);
  if (existing !== undefined) {
    console.error(`Hook "${name}" already exists for event "${event}".`);
    process.exit(1);
  }

  // Create directory
  const eventDir = join(hooksDir, event);
  if (!existsSync(eventDir)) {
    mkdirSync(eventDir, { recursive: true });
  }

  // Create file with template
  const ext = getFileExtension(kind);
  const fileName = `${name}${ext}`;
  const filePath = join(eventDir, fileName);
  const relativePath = `${event}/${fileName}`;

  if (kind === "prompt") {
    writeFileSync(filePath, getPromptTemplate(name, event), "utf8");
  } else {
    writeFileSync(filePath, getScriptTemplate(name, event), "utf8");
  }

  // Open in editor
  openInEditor(filePath);

  // Register in metadata
  const entry = {
    name,
    event,
    kind,
    matcher,
    file: relativePath,
    createdAt: new Date().toISOString(),
  };
  const updatedMetadata = addHookEntry(metadata, entry);
  writeMetadata(metadataPath, updatedMetadata);

  // Register in settings.json
  const settings = readSettings(settingsPath);
  const updatedSettings = addHookToSettings(settings, event, relativePath, matcher);
  writeSettings(settingsPath, updatedSettings);

  console.log(`Hook "${name}" added for ${event} (${kind}).`);
  console.log(`File: ${filePath}`);
}
```

Note: `getMetadataPath` in paths.ts takes a boolean, but add.ts calls it with hooksDir. Fix: call `getMetadataPath(project)` instead. The implementing engineer should use `getMetadataPath(project)` from paths.ts.

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/commands/add.ts
git commit -m "Add add command for creating hooks"
```

---

### Task 9: Command - remove.ts

**Files:**
- Create: `src/commands/remove.ts`

**Step 1: Create src/commands/remove.ts**

```typescript
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import type { HookEvent } from "../lib/hooks.js";
import { getHooksDir, getSettingsPath, getMetadataPath } from "../lib/paths.js";
import { readMetadata, writeMetadata, findHookEntry, removeHookEntry } from "../lib/metadata.js";
import { readSettings, writeSettings, removeHookFromSettings } from "../lib/settings.js";

export function removeHook(event: HookEvent, name: string, project: boolean): void {
  const hooksDir = getHooksDir(project);
  const settingsPath = getSettingsPath(project);
  const metadataPath = getMetadataPath(project);

  const metadata = readMetadata(metadataPath);
  const entry = findHookEntry(metadata, event, name);
  if (entry === undefined) {
    console.error(`Hook "${name}" not found for event "${event}".`);
    process.exit(1);
  }

  // Delete file
  const filePath = join(hooksDir, entry.file);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }

  // Remove from metadata
  const updatedMetadata = removeHookEntry(metadata, event, name);
  writeMetadata(metadataPath, updatedMetadata);

  // Remove from settings.json
  const settings = readSettings(settingsPath);
  const updatedSettings = removeHookFromSettings(settings, event, entry.file);
  writeSettings(settingsPath, updatedSettings);

  console.log(`Hook "${name}" removed from ${event}.`);
}
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/commands/remove.ts
git commit -m "Add remove command for deleting hooks"
```

---

### Task 10: Command - list.ts

**Files:**
- Create: `src/commands/list.ts`

**Step 1: Create src/commands/list.ts**

```typescript
import type { HookEvent } from "../lib/hooks.js";
import { getMetadataPath } from "../lib/paths.js";
import { readMetadata } from "../lib/metadata.js";

function padRight(str: string, len: number): string {
  if (str.length >= len) {
    return str;
  }
  return str + " ".repeat(len - str.length);
}

export function listHooks(event: HookEvent | null, project: boolean): void {
  const metadataPath = getMetadataPath(project);
  const metadata = readMetadata(metadataPath);

  let hooks = metadata.hooks;
  if (event !== null) {
    hooks = hooks.filter((h) => h.event === event);
  }

  if (hooks.length === 0) {
    if (event !== null) {
      console.log(`No hooks registered for ${event}.`);
    } else {
      console.log("No hooks registered.");
    }
    return;
  }

  // Table header
  console.log(
    `${padRight("NAME", 20)} ${padRight("EVENT", 20)} ${padRight("KIND", 8)} ${padRight("MATCHER", 15)} FILE`,
  );
  console.log("-".repeat(90));

  for (const hook of hooks) {
    const matcher = hook.matcher ?? "-";
    console.log(
      `${padRight(hook.name, 20)} ${padRight(hook.event, 20)} ${padRight(hook.kind, 8)} ${padRight(matcher, 15)} ${hook.file}`,
    );
  }
}
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/commands/list.ts
git commit -m "Add list command for displaying hooks"
```

---

### Task 11: Command - edit.ts

**Files:**
- Create: `src/commands/edit.ts`

**Step 1: Create src/commands/edit.ts**

```typescript
import { join } from "path";
import type { HookEvent } from "../lib/hooks.js";
import { getHooksDir, getMetadataPath } from "../lib/paths.js";
import { readMetadata, findHookEntry } from "../lib/metadata.js";
import { openInEditor } from "../lib/editor.js";

export function editHook(event: HookEvent, name: string, project: boolean): void {
  const hooksDir = getHooksDir(project);
  const metadataPath = getMetadataPath(project);

  const metadata = readMetadata(metadataPath);
  const entry = findHookEntry(metadata, event, name);
  if (entry === undefined) {
    console.error(`Hook "${name}" not found for event "${event}".`);
    process.exit(1);
  }

  const filePath = join(hooksDir, entry.file);
  openInEditor(filePath);
  console.log(`Hook "${name}" updated.`);
}
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Commit**

```bash
git add src/commands/edit.ts
git commit -m "Add edit command for modifying hooks"
```

---

### Task 12: CLI entry point - index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: Write the commander CLI setup in src/index.ts**

This is the main entry point. Register a subcommand for each valid hook event dynamically, plus `list` and `run` as top-level commands.

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { HOOK_EVENTS, isValidHookEvent } from "./lib/hooks.js";
import type { HookEvent } from "./lib/hooks.js";
import { addHook } from "./commands/add.js";
import { removeHook } from "./commands/remove.js";
import { listHooks } from "./commands/list.js";
import { editHook } from "./commands/edit.js";
import { runHook } from "./commands/run.js";

const program = new Command();

program
  .name("cchm")
  .description("Claude Code Hook Manager")
  .version("0.1.0");

// Global list command
program
  .command("list")
  .description("List all hooks across all events")
  .option("--project", "Target project-level settings", false)
  .action((opts: { project: boolean }) => {
    listHooks(null, opts.project);
  });

// Run command (internal, called by settings.json hooks)
program
  .command("run <path>")
  .description("Run a hook file (internal)")
  .action((path: string) => {
    runHook(path);
  });

// Register a subcommand for each hook event
for (const event of HOOK_EVENTS) {
  const eventCmd = program
    .command(event)
    .description(`Manage ${event} hooks`);

  // <Event> list
  eventCmd
    .command("list")
    .description(`List hooks for ${event}`)
    .option("--project", "Target project-level settings", false)
    .action((opts: { project: boolean }) => {
      listHooks(event, opts.project);
    });

  // <Event> add <prompt|script> <name>
  const addCmd = eventCmd
    .command("add")
    .description(`Add a hook to ${event}`);

  addCmd
    .command("prompt <name>")
    .description("Add a prompt hook (.md file)")
    .option("--matcher <regex>", "Regex matcher for this hook")
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { matcher?: string; project: boolean }) => {
      addHook(event, "prompt", name, opts.matcher ?? null, opts.project);
    });

  addCmd
    .command("script <name>")
    .description("Add a script hook (.sh file)")
    .option("--matcher <regex>", "Regex matcher for this hook")
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { matcher?: string; project: boolean }) => {
      addHook(event, "script", name, opts.matcher ?? null, opts.project);
    });

  // <Event> remove <name>
  eventCmd
    .command("remove <name>")
    .description(`Remove a hook from ${event}`)
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { project: boolean }) => {
      removeHook(event, name, opts.project);
    });

  // <Event> edit <name>
  eventCmd
    .command("edit <name>")
    .description(`Edit a hook for ${event}`)
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { project: boolean }) => {
      editHook(event, name, opts.project);
    });
}

program.parse();
```

**Step 2: Run lint**

Run: `bun run lint`

**Step 3: Verify CLI works with bun**

Run: `bun run src/index.ts -- --help`
Expected: Shows help text with all hook events as subcommands.

Run: `bun run src/index.ts -- list`
Expected: "No hooks registered."

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "Add CLI entry point with commander setup"
```

---

### Task 13: Build verification and npm link

**Step 1: Build with tsc**

Run: `bun run build`

Verify `dist/` directory is populated.

**Step 2: Add shebang to dist/index.js**

The tsc output won't have the shebang. Add a postbuild step or manually verify. Update `package.json` scripts:

```json
"build": "tsc && node -e \"const fs=require('fs');const f='dist/index.js';const c=fs.readFileSync(f,'utf8');if(!c.startsWith('#!')){fs.writeFileSync(f,'#!/usr/bin/env node\\n'+c)}\""
```

Or simpler: just keep the shebang comment in index.ts (tsc preserves it).

**Step 3: Test with npm link or bun link**

Run: `bun link`

Then test:
Run: `cchm --help`
Run: `cchm list`

**Step 4: Commit**

```bash
git add package.json
git commit -m "Finalize build setup"
```

---

### Task 14: Final lint pass and cleanup

**Step 1: Full lint**

Run: `bun run lint`

Fix any remaining issues.

**Step 2: Format all files**

Run: `bun run format`

**Step 3: Commit**

```bash
git add -A
git commit -m "Final lint and format pass"
```
