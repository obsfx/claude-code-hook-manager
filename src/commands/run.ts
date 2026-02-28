import { readFileSync } from "fs";
import { execSync } from "child_process";
import { extname } from "path";
import { platform } from "os";
import { resolveHookFilePath, getGlobalHooksDir } from "../lib/paths.js";
import { isValidHookEvent, getPromptCompatibility, wrapPromptAsJson } from "../lib/hooks.js";
import type { HookEvent } from "../lib/hooks.js";

function getShell(): string {
  if (platform() === "win32") {
    return "powershell.exe";
  }
  return "bash";
}

function extractEvent(relativePath: string): HookEvent | null {
  const segment = relativePath.split("/")[0];
  if (isValidHookEvent(segment)) {
    return segment;
  }
  return null;
}

function runPrompt(relativePath: string, absolutePath: string): void {
  const event = extractEvent(relativePath);
  const content = readFileSync(absolutePath, "utf8");

  if (event === null) {
    process.stdout.write(content);
    return;
  }

  const compat = getPromptCompatibility(event);

  if (compat === "incompatible") {
    console.error(
      `Prompt hooks are not supported for "${event}". This event is side-effect only. Use a script hook instead.`,
    );
    process.exit(1);
  }

  if (compat === "json") {
    process.stdout.write(wrapPromptAsJson(event, content));
    return;
  }

  process.stdout.write(content);
}

function runScript(absolutePath: string): void {
  const shell = getShell();
  try {
    execSync(`${shell} "${absolutePath}"`, {
      stdio: "inherit",
      cwd: process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd(),
    });
  } catch (err: unknown) {
    const code = (err as { status?: number }).status ?? 1;
    process.exit(code);
  }
}

export function runHook(relativePath: string): void {
  const hooksDir = getGlobalHooksDir();
  const absolutePath = resolveHookFilePath(hooksDir, relativePath);
  const ext = extname(relativePath).toLowerCase();

  // @feedback: turn this into switch statement
  // end extract if bodies into utils functions
  // @agent-response: Extracted runPrompt() and runScript() utils, converted to switch
  switch (ext) {
    case ".md":
      runPrompt(relativePath, absolutePath);
      return;
    case ".sh":
      runScript(absolutePath);
      return;
    default:
      console.error(`Unknown file extension: ${ext}`);
      process.exit(1);
  }
}
