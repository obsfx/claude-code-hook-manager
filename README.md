# cchm - Claude Code Hook Manager

A CLI tool that manages [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks). It creates hook files, registers them in `settings.json`, and tracks metadata — so you don't have to manually edit JSON config files.

## Installation

```bash
npm install -g cchm
```

Or run directly with npx:

```bash
npx cchm quickstart
```

## How It Works

Claude Code hooks are configured in `~/.claude/settings.json` (global) or `.claude/settings.json` (project). Each hook points to a command that runs on a specific event.

cchm abstracts this away:

1. You run `cchm <Event> add prompt|script <name>`
2. It creates the hook file under `~/.claude/hooks/<Event>/<name>.md|.sh`
3. It registers `cchm run <Event>/<name>.md|.sh` as a command in `settings.json`
4. It tracks hook metadata in `.cchm.json` for listing and management

When Claude Code triggers an event, it calls `cchm run <path>`, which executes the hook file and handles output formatting automatically.

### Hook Types

**Prompt hooks** (`.md`) — Markdown content injected as context into Claude. Write plain text; cchm handles JSON wrapping when the event requires it.

**Script hooks** (`.sh`) — Bash scripts executed on the event. They receive JSON on stdin and can produce output or perform side effects.

### Event Compatibility

Not all events support both hook types. cchm enforces this automatically:

| Category            | Events                                                                                                                          | Prompt               | Script |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------ |
| Plaintext           | `SessionStart`, `UserPromptSubmit`                                                                                              | raw text             | yes    |
| JSON (auto-wrapped) | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `Stop`, `PermissionRequest`, `SubagentStop`, `TaskCompleted`                 | auto-wrapped in JSON | yes    |
| Script only         | `Notification`, `SubagentStart`, `ConfigChange`, `PreCompact`, `SessionEnd`, `TeammateIdle`, `WorktreeCreate`, `WorktreeRemove` | blocked              | yes    |

## Usage

### Add a hook

```bash
# Opens $EDITOR to write the hook content
cchm SessionStart add prompt my-rules
cchm PreToolUse add script lint-guard --matcher "Bash"

# Pass content directly (ideal for AI agents or scripting)
cchm SessionStart add prompt my-rules --content "Always use TypeScript strict mode."
cchm PreToolUse add script lint-guard --matcher "Bash" --content '#!/usr/bin/env bash
set -euo pipefail
echo "Checking lint..."'
```

### List hooks

```bash
# List all hooks
cchm list

# List hooks for a specific event
cchm PreToolUse list

# List project-level hooks
cchm list --project
```

### Remove a hook

```bash
cchm SessionStart remove my-rules
```

### Edit a hook

```bash
cchm SessionStart edit my-rules
```

### Quickstart (for AI agents)

```bash
cchm quickstart
```

Outputs a self-contained reference that AI agents can read to understand the full CLI surface and create hooks programmatically.

## Examples

### Inject coding standards on every session

```bash
cchm SessionStart add prompt coding-standards --content "Follow these rules:
- Use TypeScript strict mode
- Prefer const over let
- Use early returns
- No console.log in production code"
```

### Guard bash commands with a linter

```bash
cchm PreToolUse add script lint-check --matcher "Bash" --content '#!/usr/bin/env bash
set -euo pipefail
tool_input=$(jq -r ".tool_input.command" < /dev/stdin)
if echo "$tool_input" | grep -q "rm -rf /"; then
  echo "Blocked dangerous command" >&2
  exit 2
fi'
```

### Log all prompts

```bash
cchm UserPromptSubmit add script prompt-logger --content '#!/usr/bin/env bash
set -euo pipefail
jq -r ".prompt" < /dev/stdin >> /tmp/claude-prompts.log'
```

### Block git operations

```bash
cchm PreToolUse add script prevent-git-ops --matcher "Bash" --content '#!/usr/bin/env bash
set -euo pipefail
command=$(jq -r ".tool_input.command" 2>/dev/null)
if echo "$command" | grep -qE "git\s+(add|commit|push)"; then
  echo "BLOCKED: git add, commit, and push are not allowed." >&2
  exit 2
fi'
```

### Send desktop notification on task completion

```bash
cchm Notification add script desktop-notify --content '#!/usr/bin/env bash
set -euo pipefail
message=$(jq -r ".message" < /dev/stdin)
osascript -e "display notification \"$message\" with title \"Claude Code\""'
```

## Flags

| Flag                | Description                                                                     |
| ------------------- | ------------------------------------------------------------------------------- |
| `--content <text>`  | Write content directly to the hook file, skipping `$EDITOR`                     |
| `--matcher <regex>` | Regex matcher for the hook (e.g., `"Bash"` for PreToolUse to match tool name)   |
| `--project`         | Target project-level hooks (`.claude/` in cwd) instead of global (`~/.claude/`) |

## Project vs Global Hooks

- **Global** (default): stored in `~/.claude/hooks/`, configured in `~/.claude/settings.json`
- **Project** (`--project`): stored in `.claude/hooks/`, configured in `.claude/settings.json`

Use `--project` for repository-specific hooks that should be committed with the codebase.

## License

MIT
