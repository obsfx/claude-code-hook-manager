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
  [event: string]: HookMatcherGroup[] | undefined;
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

export function addHookToSettings(
  settings: SettingsFile,
  event: HookEvent,
  relativePath: string,
  matcher: string | null,
): SettingsFile {
  const hooks: SettingsHooks = settings.hooks ?? {};
  const eventGroups: HookMatcherGroup[] = hooks[event] ?? [];
  const command = buildCommand(relativePath);

  const newHandler: HookHandler = {
    type: "command",
    command,
  };

  const matcherStr = matcher ?? undefined;
  const existingGroupIndex = eventGroups.findIndex((g) => g.matcher === matcherStr);

  let updatedGroups: HookMatcherGroup[];
  if (existingGroupIndex >= 0) {
    updatedGroups = eventGroups.map((g, i) => {
      if (i === existingGroupIndex) {
        return { ...g, hooks: [...g.hooks, newHandler] };
      }
      return g;
    });
  } else {
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

  const updatedGroups = eventGroups
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((h) => h.command !== command),
    }))
    .filter((group) => group.hooks.length > 0);

  const updatedHooks = { ...hooks };
  if (updatedGroups.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete updatedHooks[event];
  } else {
    updatedHooks[event] = updatedGroups;
  }

  if (Object.keys(updatedHooks).length === 0) {
    const result: SettingsFile = {};
    for (const [key, value] of Object.entries(settings)) {
      if (key !== "hooks") {
        result[key] = value;
      }
    }
    return result;
  }

  return {
    ...settings,
    hooks: updatedHooks,
  };
}
