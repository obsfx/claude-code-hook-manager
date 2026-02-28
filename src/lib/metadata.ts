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
