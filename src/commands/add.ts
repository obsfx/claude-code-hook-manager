import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { HookEvent, HookKind } from "../lib/hooks.js";
import {
  getFileExtension,
  getPromptTemplate,
  getScriptTemplate,
  getPromptCompatibility,
} from "../lib/hooks.js";
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
  content: string | null,
): void {
  if (kind === "prompt") {
    const compat = getPromptCompatibility(event);

    if (compat === "incompatible") {
      console.error(
        `Prompt hooks are not supported for "${event}". This event is side-effect only and does not inject context into Claude. Use a script hook instead.`,
      );
      process.exit(1);
    }

    if (compat === "json") {
      console.log(
        `Note: Prompt content for ${event} will be auto-wrapped in JSON for compatibility.`,
      );
    }
  }

  const hooksDir = getHooksDir(project);
  const settingsPath = getSettingsPath(project);
  const metadataPath = getMetadataPath(project);

  const metadata = readMetadata(metadataPath);
  const existing = findHookEntry(metadata, event, name);
  if (existing !== undefined) {
    console.error(`Hook "${name}" already exists for event "${event}".`);
    process.exit(1);
  }

  const eventDir = join(hooksDir, event);
  if (!existsSync(eventDir)) {
    mkdirSync(eventDir, { recursive: true });
  }

  const ext = getFileExtension(kind);
  const fileName = `${name}${ext}`;
  const filePath = join(eventDir, fileName);
  const relativePath = `${event}/${fileName}`;

  if (content !== null) {
    writeFileSync(filePath, content, "utf8");
  } else if (kind === "prompt") {
    writeFileSync(filePath, getPromptTemplate(name, event), "utf8");
    openInEditor(filePath);
  } else {
    writeFileSync(filePath, getScriptTemplate(name, event), "utf8");
    openInEditor(filePath);
  }

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

  const settings = readSettings(settingsPath);
  const updatedSettings = addHookToSettings(settings, event, relativePath, matcher);
  writeSettings(settingsPath, updatedSettings);

  console.log(`Hook "${name}" added for ${event} (${kind}).`);
  console.log(`File: ${filePath}`);
}
