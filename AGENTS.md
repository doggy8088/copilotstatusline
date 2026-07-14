# Project guidance

## Project overview

`copilotstatusline` is a command status-line formatter and interactive configuration UI for GitHub Copilot CLI. It has two modes:

1. Piped mode parses one Copilot status payload from stdin and prints configured terminal lines.
2. Interactive mode launches a React/Ink TUI when stdin is a TTY.

This repository supports GitHub Copilot CLI only. Do not add integrations, payload assumptions, or configuration paths for unrelated agent CLIs.

## Development commands

```sh
bun install
bun run start
bun run example
bun test
bun test --watch
bun run lint
bun run lint:fix
bun run build
```

Use `bun run lint:fix` only when automatic ESLint changes are intentional. Never disable a lint rule with an inline comment.

## Architecture

- `src/copilotstatusline.ts`: CLI entry point, argument handling, stdin parsing, and TUI dispatch.
- `src/types/copilot-status.ts`: loose forward-compatible Zod schema and normalized internal payload.
- `src/types/Settings.ts`: schema-v1 formatter settings and widget types.
- `src/utils/app-settings.ts`: XDG, APPDATA, and `--config` path resolution plus atomic writes.
- `src/utils/copilot-settings.ts`: `$COPILOT_HOME/settings.json` inspection, merge installation, backup, and owned-command uninstall.
- `src/utils/renderer.ts`: standard and Powerline rendering, flex expansion, ANSI-safe truncation, and multi-line output.
- `src/widgets/catalog.ts`: widget metadata and rendering from normalized Copilot fields or bounded local commands.
- `src/tui/`: React/Ink interactive editor.

## Runtime rules

- Treat the Copilot payload as versioned external input. Accept unknown fields, validate known fields, and render missing fields as absent rather than inventing values.
- Do not parse Copilot transcript files to reconstruct metrics already present in `context_window` or `cost`.
- Status rendering must not make network calls.
- Git and Jujutsu probes must be bounded, quiet, and cached.
- Invalid formatter JSON must not be overwritten automatically.
- Installation may modify only the user-level Copilot settings file. Preserve unrelated keys, create a backup before replacing an existing file, and uninstall only commands owned by this package.
- Respect `COPILOT_HOME`; its fallback is `~/.copilot`.
- Repository-level `.github/copilot/settings.json` does not support `statusLine` and must not be targeted.

## Compatibility

- Published bundle: Node.js 22 or newer.
- Development and tests: Bun.
- Copilot shell-command status lines: Copilot CLI 1.0.52 or newer.
- Keep the payload parser forward-compatible with newer Copilot CLI fields.

## Testing

Tests use Vitest through `bun test`. Add focused coverage for:

- payload aliases, coercion, missing fields, and invalid fields;
- settings path resolution, malformed JSON safety, and atomic writes;
- Copilot settings merge, preservation, ownership, and uninstall behavior;
- ANSI-safe rendering, Powerline output, flexible spacing, and width limits.

Before handing off a change, run `bun run lint`, `bun test`, and `bun run build`. For CLI changes, also run `bun run example` and execute the built bundle with a temporary `COPILOT_HOME` when integration behavior changes.

## Commit messages

Use Conventional Commits 1.0.0. Prepare the complete UTF-8 commit message in a unique temporary file and commit with:

```sh
commit_msg_file="$(mktemp -t copilotstatusline-commit-message)"
git commit -F "$commit_msg_file"
```

Do not use `git commit -m`.
