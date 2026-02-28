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

export type PromptCompatibility = "plaintext" | "json" | "incompatible";

const PLAINTEXT_EVENTS: ReadonlySet<HookEvent> = new Set(["SessionStart", "UserPromptSubmit"]);

const JSON_EVENTS: ReadonlySet<HookEvent> = new Set([
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Stop",
  "PermissionRequest",
  "SubagentStop",
  "TaskCompleted",
]);

export function isValidHookEvent(value: string): value is HookEvent {
  return (HOOK_EVENTS as readonly string[]).includes(value);
}

export function getPromptCompatibility(event: HookEvent): PromptCompatibility {
  if (PLAINTEXT_EVENTS.has(event)) {
    return "plaintext";
  }
  if (JSON_EVENTS.has(event)) {
    return "json";
  }
  return "incompatible";
}

export function wrapPromptAsJson(event: HookEvent, content: string): string {
  if (event === "PreToolUse") {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        additionalContext: content,
      },
    });
  }
  return JSON.stringify({ additionalContext: content });
}

export function getFileExtension(kind: HookKind): string {
  if (kind === "prompt") {
    return ".md";
  }
  return ".sh";
}

export function getPromptTemplate(name: string, event: HookEvent): string {
  const compat = getPromptCompatibility(event);
  if (compat === "json") {
    return `# ${name}\n\n<!-- This prompt will be wrapped in JSON and injected as additionalContext on ${event} -->\n\n`;
  }
  return `# ${name}\n\n<!-- This prompt will be injected as context on ${event} -->\n\n`;
}

export function getScriptTemplate(name: string, event: HookEvent): string {
  const header = `#!/usr/bin/env bash\n# ${name} - runs on ${event}\n`;
  const footer = `\nset -euo pipefail\n\n`;

  const stdinDocs = SCRIPT_STDIN_DOCS[event];
  const stdoutDocs = SCRIPT_STDOUT_DOCS[event];

  return `${header}${stdinDocs}\n${stdoutDocs}${footer}`;
}

const SCRIPT_STDIN_DOCS: Record<HookEvent, string> = {
  SessionStart: "# stdin: { session_id, cwd, source }",
  UserPromptSubmit: "# stdin: { prompt }",
  PreToolUse: "# stdin: { tool_name, tool_input }",
  PostToolUse: "# stdin: { tool_name, tool_input, tool_response }",
  PostToolUseFailure: "# stdin: { tool_name, tool_input, tool_error }",
  Stop: "# stdin: { stop_hook_active, last_assistant_message }",
  Notification: "# stdin: { message, notification_type }",
  SubagentStart: "# stdin: { agent_name, task }",
  SubagentStop: "# stdin: { agent_name, task, result }",
  PermissionRequest: "# stdin: { tool_name, permission_type }",
  ConfigChange: "# stdin: { key, old_value, new_value }",
  PreCompact: "# stdin: { message_count, token_count }",
  SessionEnd: "# stdin: {}",
  TeammateIdle: "# stdin: { teammate_name }",
  TaskCompleted: "# stdin: { task_id, result }",
  WorktreeCreate: "# stdin: { worktree_path, branch }",
  WorktreeRemove: "# stdin: { worktree_path, branch }",
};

const SCRIPT_STDOUT_DOCS: Record<HookEvent, string> = {
  SessionStart: "# stdout: text injected as context",
  UserPromptSubmit: "# stdout: text injected as context",
  PreToolUse:
    '# stdout: JSON { "hookSpecificOutput": { "permissionDecision": "allow"|"deny"|"ask", "additionalContext": "..." } }',
  PostToolUse: '# stdout: JSON { "additionalContext": "..." } (optional)',
  PostToolUseFailure: '# stdout: JSON { "additionalContext": "..." } (optional)',
  Stop: '# stdout: JSON { "decision": "stop"|"continue", "additionalContext": "..." }',
  Notification:
    "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
  SubagentStart:
    "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
  SubagentStop: '# stdout: JSON { "additionalContext": "..." } (optional)',
  PermissionRequest: '# stdout: JSON { "additionalContext": "..." } (optional)',
  ConfigChange:
    "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
  PreCompact: "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
  SessionEnd: "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
  TeammateIdle:
    "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
  TaskCompleted: '# stdout: JSON { "additionalContext": "..." } (optional)',
  WorktreeCreate:
    "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
  WorktreeRemove:
    "# stdout: ignored (side-effect only)\n# exit 0 = success, exit 2 = block with error",
};
