#!/usr/bin/env node
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Command } from "commander";
import { HOOK_EVENTS } from "./lib/hooks.js";
import { addHook } from "./commands/add.js";
import { removeHook } from "./commands/remove.js";
import { listHooks } from "./commands/list.js";
import { editHook } from "./commands/edit.js";
import { runHook } from "./commands/run.js";
import { quickstart } from "./commands/quickstart.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
  version: string;
};

const program = new Command();

// @feedback: we should gather version from package.json
// @agent-response: Reading version from package.json via import.meta.url-relative path
program.name("cchm").description("Claude Code Hook Manager").version(pkg.version);

program
  .command("list")
  .description("List all hooks across all events")
  .option("--project", "Target project-level settings", false)
  .action((opts: { project: boolean }) => {
    listHooks(null, opts.project);
  });

program
  .command("run <path>")
  .description("Run a hook file (internal)")
  .action((path: string) => {
    runHook(path);
  });

program
  .command("quickstart")
  .description("Show usage guide for AI agents")
  .action(() => {
    quickstart();
  });

for (const event of HOOK_EVENTS) {
  const eventCmd = program.command(event).description(`Manage ${event} hooks`);

  eventCmd
    .command("list")
    .description(`List hooks for ${event}`)
    .option("--project", "Target project-level settings", false)
    .action((opts: { project: boolean }) => {
      listHooks(event, opts.project);
    });

  const addCmd = eventCmd.command("add").description(`Add a hook to ${event}`);

  addCmd
    .command("prompt <name>")
    .description("Add a prompt hook (.md file)")
    .option("--matcher <regex>", "Regex matcher for this hook")
    .option("--content <text>", "Write content directly (skips $EDITOR)")
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { matcher?: string; content?: string; project: boolean }) => {
      addHook(event, "prompt", name, opts.matcher ?? null, opts.project, opts.content ?? null);
    });

  addCmd
    .command("script <name>")
    .description("Add a script hook (.sh file)")
    .option("--matcher <regex>", "Regex matcher for this hook")
    .option("--content <text>", "Write content directly (skips $EDITOR)")
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { matcher?: string; content?: string; project: boolean }) => {
      addHook(event, "script", name, opts.matcher ?? null, opts.project, opts.content ?? null);
    });

  eventCmd
    .command("remove <name>")
    .description(`Remove a hook from ${event}`)
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { project: boolean }) => {
      removeHook(event, name, opts.project);
    });

  eventCmd
    .command("edit <name>")
    .description(`Edit a hook for ${event}`)
    .option("--project", "Target project-level settings", false)
    .action((name: string, opts: { project: boolean }) => {
      editHook(event, name, opts.project);
    });
}

program.parse();
