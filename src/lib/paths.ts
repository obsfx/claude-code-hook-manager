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
