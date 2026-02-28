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

  const filePath = join(hooksDir, entry.file);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }

  const updatedMetadata = removeHookEntry(metadata, event, name);
  writeMetadata(metadataPath, updatedMetadata);

  const settings = readSettings(settingsPath);
  const updatedSettings = removeHookFromSettings(settings, event, entry.file);
  writeSettings(settingsPath, updatedSettings);

  console.log(`Hook "${name}" removed from ${event}.`);
}
