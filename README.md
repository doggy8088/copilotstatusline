# copilotstatusline

A customizable command status line for GitHub Copilot CLI.

`copilotstatusline` reads the JSON payload that Copilot CLI sends to a custom status-line command and renders one or more terminal lines. Running it in an interactive terminal opens an Ink configuration UI.

## Requirements

- GitHub Copilot CLI 1.0.52 or newer for shell-command status lines
- Node.js 22 or newer when running the published bundle
- Bun for development

The implementation targets the user-level Copilot settings file at `$COPILOT_HOME/settings.json`, falling back to `~/.copilot/settings.json`. Repository-level `.github/copilot/settings.json` files do not support the `statusLine` setting.

## Quick start

Launch the configuration UI:

```sh
npx -y copilotstatusline@latest
```

Choose `Install or repair Copilot integration`, or install non-interactively:

```sh
npx -y copilotstatusline@latest --install npm
```

The installer merges the following keys into the existing Copilot settings and preserves unrelated settings:

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx -y copilotstatusline@latest",
    "padding": 0
  },
  "footer": {
    "showCustom": true
  }
}
```

Restart Copilot CLI after changing its settings.

## Command line

```text
copilotstatusline                       Open the configuration UI
copilotstatusline --install npm         Install an npx command
copilotstatusline --install bunx        Install a bunx command
copilotstatusline --install global      Install a global binary command
copilotstatusline --uninstall           Remove an owned integration
copilotstatusline --check               Print integration status as JSON
copilotstatusline --config <path>       Use a custom formatter settings file
copilotstatusline --version             Print the package version
```

When `--config` is combined with `--install`, the absolute config path is included in Copilot's command setting.

## Widgets

The initial release supports Copilot-native fields for model, reasoning effort, version, session, token totals, cache tokens, last-call tokens, context usage, premium requests, durations, changed-line counts, and allow-all state.

Local widgets include current directory, Git branch and change counts, Jujutsu change ID, terminal width, free memory, custom text, custom commands, explicit separators, and flexible spacing. Powerline rendering and multiple status lines are supported.

Custom commands run through the local shell with the Copilot working directory and a 500 ms timeout. Treat the formatter settings file as executable configuration.

## Configuration

Formatter settings are stored at:

- Linux and macOS: `$XDG_CONFIG_HOME/copilotstatusline/settings.json`, or `~/.config/copilotstatusline/settings.json`
- Windows: `%APPDATA%\copilotstatusline\settings.json`

Malformed configuration is never overwritten during status rendering. Defaults are used in memory and a warning is written to stderr. Interactive mode creates a missing settings file; piped mode does not.

See [Usage](docs/USAGE.md), [Development](docs/DEVELOPMENT.md), and [Windows](docs/WINDOWS.md) for details.

## Manual payload test

```sh
bun run example
```

Or pipe a payload directly:

```sh
printf '%s\n' '{"model":{"id":"gpt-5","display_name":"GPT-5"},"context_window":{"current_context_tokens":25000,"displayed_context_limit":128000}}' | bun run src/copilotstatusline.ts
```

## Development

```sh
bun install
bun run lint
bun test
bun run build
```

## Upstream references

- [Copilot CLI configuration directory reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference)
- [Copilot CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)
- [Copilot CLI changelog](https://github.com/github/copilot-cli/blob/main/changelog.md)

## License

MIT. See [LICENSE](LICENSE).
