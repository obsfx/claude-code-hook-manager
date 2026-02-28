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
