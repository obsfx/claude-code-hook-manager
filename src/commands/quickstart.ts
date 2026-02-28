import { HOOK_EVENTS, getPromptCompatibility } from "../lib/hooks.js";

function formatEventTable(): string {
  const lines: string[] = [];

  const plaintext: string[] = [];
  const json: string[] = [];
  const scriptOnly: string[] = [];

  for (const event of HOOK_EVENTS) {
    const compat = getPromptCompatibility(event);
    if (compat === "plaintext") {
      plaintext.push(event);
    } else if (compat === "json") {
      json.push(event);
    } else {
      scriptOnly.push(event);
    }
  }

  lines.push("Events by prompt compatibility:");
  lines.push(`  plaintext (raw stdout):    ${plaintext.join(", ")}`);
  lines.push(`  json (auto-wrapped):       ${json.join(", ")}`);
  lines.push(`  script-only (no prompts):  ${scriptOnly.join(", ")}`);

  return lines.join("\n");
}

function formatStdinReference(): string {
  const stdinMap: Record<string, string> = {
    SessionStart: "{ session_id, cwd, source }",
    UserPromptSubmit: "{ prompt }",
    PreToolUse: "{ tool_name, tool_input }",
    PostToolUse: "{ tool_name, tool_input, tool_response }",
    PostToolUseFailure: "{ tool_name, tool_input, tool_error }",
    Stop: "{ stop_hook_active, last_assistant_message }",
    Notification: "{ message, notification_type }",
    SubagentStart: "{ agent_name, task }",
    SubagentStop: "{ agent_name, task, result }",
    PermissionRequest: "{ tool_name, permission_type }",
    ConfigChange: "{ key, old_value, new_value }",
    PreCompact: "{ message_count, token_count }",
    SessionEnd: "{}",
    TeammateIdle: "{ teammate_name }",
    TaskCompleted: "{ task_id, result }",
    WorktreeCreate: "{ worktree_path, branch }",
    WorktreeRemove: "{ worktree_path, branch }",
  };

  const lines = ["Script stdin by event:"];
  for (const event of HOOK_EVENTS) {
    lines.push(`  ${event}: ${stdinMap[event]}`);
  }
  return lines.join("\n");
}

export function quickstart(): void {
  const output = `# cchm — Claude Code Hook Manager

Manages Claude Code hooks. Creates hook files, registers them in settings.json, tracks metadata.

## Hook Types

- prompt (.md): Markdown content injected as context into Claude. Some events auto-wrap in JSON.
- script (.sh): Bash script executed on the event. Receives JSON on stdin. Works for all events.

## ${formatEventTable()}

## Commands

Add a hook (opens $EDITOR):
  cchm <Event> add prompt <name> [--matcher <regex>] [--project]
  cchm <Event> add script <name> [--matcher <regex>] [--project]

Add a hook with content (skips $EDITOR, ideal for AI agents):
  cchm <Event> add prompt <name> --content "your markdown content"
  cchm <Event> add script <name> --content '#!/usr/bin/env bash\necho "hello"'

List hooks:
  cchm list [--project]
  cchm <Event> list [--project]

Remove a hook:
  cchm <Event> remove <name> [--project]

Edit a hook (opens $EDITOR):
  cchm <Event> edit <name> [--project]

## Examples

Add a SessionStart prompt:
  cchm SessionStart add prompt my-context --content "Always use TypeScript strict mode."

Add a PreToolUse prompt (auto-wrapped in JSON):
  cchm PreToolUse add prompt lint-check --matcher "Bash" --content "Run linter before executing bash commands."

Add a UserPromptSubmit script:
  cchm UserPromptSubmit add script log-prompt --content '#!/usr/bin/env bash
set -euo pipefail
# Log the prompt
jq -r .prompt | tee -a /tmp/claude-prompts.log'

## ${formatStdinReference()}

## Flags

--content <text>  Write content directly to the hook file (skips $EDITOR)
--matcher <regex> Regex matcher (e.g. "Bash" for PreToolUse to match tool name)
--project         Target project-level hooks (.claude/ in cwd) instead of global (~/.claude/)
`;

  process.stdout.write(output);
}
