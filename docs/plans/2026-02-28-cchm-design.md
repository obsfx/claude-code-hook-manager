# cchm (claude-code-hook-manager) Design

## Purpose

CLI tool to manage Claude Code hooks. Add hooks that return instructions (prompts) or execute shell scripts, with cross-platform support (macOS, Linux, Windows).

## Decisions

- **Settings scope:** Global (`~/.claude/settings.json`) by default, `--project` flag for per-project (`.claude/settings.json`)
- **Hook event names:** Use Claude Code event names directly (e.g., `PreToolUse`, `SessionStart`)
- **Prompt hooks:** Command-type hooks that print .md file content to stdout
- **Script hooks:** Command-type hooks that execute .sh files via shell
- **Storage:** `~/.claude/hooks/<Event>/<name>.md|.sh` with `.cchm.json` metadata sidecar
- **Runner:** cchm itself is the runner -- `cchm run <path>` handles file type detection and cross-platform execution
- **Matchers:** Optional `--matcher <regex>` flag on add
- **CLI framework:** commander.js
- **Build:** Bun for dev, tsc for compilation, npm-publishable with `bin: { "cchm": "./dist/index.js" }`

## CLI Interface

```
cchm <HookEvent> list                                               # list hooks for event
cchm <HookEvent> add prompt <name> [--matcher <regex>] [--project]  # add prompt hook
cchm <HookEvent> add script <name> [--matcher <regex>] [--project]  # add script hook
cchm <HookEvent> remove <name> [--project]                          # remove hook
cchm <HookEvent> edit <name> [--project]                             # re-open in $EDITOR
cchm list                                                            # list all hooks
cchm run <relative-path>                                             # internal runner
```

### Valid HookEvent values

PreToolUse, PostToolUse, PostToolUseFailure, SessionStart, UserPromptSubmit, Stop, Notification, SubagentStart, SubagentStop, PermissionRequest, ConfigChange, PreCompact, SessionEnd, TeammateIdle, TaskCompleted, WorktreeCreate, WorktreeRemove

## File Layout

```
~/.claude/hooks/
  .cchm.json                    # metadata sidecar
  SessionStart/
    my-rules.md
  PreToolUse/
    lint-check.sh
```

For `--project` mode: `<project>/.claude/hooks/` with same structure.

## Generated settings.json entries

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cchm run SessionStart/my-rules.md"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "cchm run PreToolUse/lint-check.sh"
          }
        ]
      }
    ]
  }
}
```

## .cchm.json structure

```json
{
  "hooks": [
    {
      "name": "my-rules",
      "event": "SessionStart",
      "kind": "prompt",
      "matcher": null,
      "file": "SessionStart/my-rules.md",
      "createdAt": "2026-02-28T12:00:00Z"
    }
  ]
}
```

## Core Operations

### add prompt/script

1. Validate event name
2. Check name uniqueness in .cchm.json
3. Create `~/.claude/hooks/<Event>/` directory
4. Create file (.md or .sh) with template
5. Open in $EDITOR (fallback: vi on unix, notepad on windows)
6. Wait for editor to close
7. Register in .cchm.json
8. Read settings.json, merge hook entry, write back

### remove

1. Find in .cchm.json
2. Delete file
3. Remove from .cchm.json
4. Remove from settings.json

### list

1. Read .cchm.json
2. Display table: name, event, kind, matcher, file

### run (internal)

1. Resolve path against hooks directory
2. .md: read + print to stdout
3. .sh: spawn with shell, forward stdin/stdout/stderr

## Project Structure

```
src/
  index.ts              # CLI entry (commander)
  commands/
    add.ts
    remove.ts
    list.ts
    edit.ts
    run.ts
  lib/
    settings.ts         # settings.json read/write/merge
    metadata.ts         # .cchm.json read/write
    editor.ts           # $EDITOR cross-platform
    paths.ts            # path resolution (global/project, cross-platform)
    hooks.ts            # event validation, templates
```

## Dependencies

- commander (CLI framework)
- typescript
- eslint + prettier (strict: no ternary, no relaxation)

## Cross-platform

- All paths via `path.join()`, `os.homedir()`
- cchm run handles .md (fs read) and .sh (shell spawn) per platform
- $EDITOR with platform-appropriate fallbacks
