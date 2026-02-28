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
