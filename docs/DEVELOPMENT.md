# Development

## Setup

```sh
bun install
```

The project is written in TypeScript. Bun runs source files and tests; the published bundle targets Node.js 22 or newer.

## Verification

```sh
bun run lint
bun test
bun run build
bun run example
```

`bun run lint` runs TypeScript checking before ESLint. The lint configuration is intentionally strict. Fix the implementation instead of suppressing a rule.

## Architecture

The external Copilot payload is parsed into `NormalizedCopilotStatus` before rendering. This boundary prevents payload aliases and nullable fields from spreading through widget logic.

Piped mode also passes the normalized payload to the local usage recorder before rendering. The recorder keeps bounded per-session state, appends TokenUsageInsights-compatible JSONL under `COPILOT_HOME`, and treats recording failures as non-fatal so filesystem problems cannot hide the status line.

Formatter settings and Copilot CLI settings are separate:

- formatter settings control lines, widgets, colors, Powerline, and local command behavior;
- Copilot settings control whether and how Copilot invokes the formatter.

Both settings writers use a temporary file and atomic rename. Copilot settings also receive timestamped backups because the file belongs to another application.

## Adding a payload field

1. Add the known optional field to `CopilotStatusSchema`.
2. Normalize it in `normalizeCopilotStatus`.
3. Add a widget type and catalog entry only if the value is useful independently.
4. Render absence as `null` instead of a fabricated fallback.
5. Add payload and rendering tests.

Keep the top-level and nested schemas loose so future Copilot fields do not break existing installations.

## Adding a widget

1. Add its type to `WIDGET_TYPES` in `src/types/Settings.ts`.
2. Add metadata to `WIDGET_CATALOG` in `src/widgets/catalog.ts`.
3. Add rendering behavior to `renderWidget`.
4. Add a focused renderer or widget test.

Subprocess widgets must suppress stderr, use a short timeout, work with an absent command, and avoid filesystem mutations. Git and Jujutsu values should go through the existing TTL cache.

## Integration testing

Use a temporary Copilot home so local user settings are never touched:

```sh
temporary_home="$(mktemp -d)"
COPILOT_HOME="$temporary_home" bun run src/copilotstatusline.ts --install global
COPILOT_HOME="$temporary_home" bun run src/copilotstatusline.ts --check
COPILOT_HOME="$temporary_home" bun run src/copilotstatusline.ts --uninstall
```

For custom formatter settings:

```sh
temporary_config="$(mktemp)"
rm "$temporary_config"
COPILOT_HOME="$temporary_home" bun run src/copilotstatusline.ts \
  --config "$temporary_config" --install global
```

## Build

```sh
bun run build
node dist/copilotstatusline.js --version
```

The postbuild script replaces the `__PACKAGE_VERSION__` placeholder from `package.json`. The bundle must remain executable as the npm `copilotstatusline` binary.
