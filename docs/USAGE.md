# Usage

## Runtime model

GitHub Copilot CLI executes the configured shell command and sends a JSON object on stdin. `copilotstatusline` validates the known fields, normalizes aliases, loads formatter settings, and writes rendered lines to stdout.

Unknown payload fields are accepted for forward compatibility. Missing optional fields hide the corresponding widgets. Invalid known field types fail the invocation with a concise stderr message and a nonzero exit code.

## Automatic token usage recording

After a payload is validated, `copilotstatusline` automatically records cumulative and per-turn token usage locally. This requires no formatter option and uses the JSONL layout consumed by TokenUsageInsights.

Default files:

```text
~/.copilot/usage/usage-YYYY-MM-DD.jsonl
~/.copilot/copilotstatusline-usage-state.json
```

`COPILOT_HOME` changes both paths. The daily filename and entry timestamp use the local date and time-zone offset. Each entry can contain the Copilot session name, transcript path, working directory, version, model, token counters, context usage, durations, premium requests, and changed-line counts. These files remain local; recording and rendering make no network requests.

Only a positive increase in cumulative total tokens creates a JSONL entry. Per-session state prevents interleaved Copilot sessions from affecting one another. Missing session IDs are not fabricated and therefore are not recorded. File or lock errors are reported on stderr without suppressing status-line output.

Disable recording explicitly with:

```sh
COPILOTSTATUSLINE_DISABLE_USAGE_RECORDING=1 copilotstatusline
```

When Copilot invokes the command, set the same environment variable in its environment. Removing the integration does not delete recorded history. If TokenUsageInsights is configured with `COPILOT_DIR`, point it to the same directory as `COPILOT_HOME`.

## Installation

Interactive installation:

```sh
npx -y @willh/copilotstatusline@latest
```

Non-interactive installation:

```sh
npx -y @willh/copilotstatusline@latest --install npm
bunx -y @willh/copilotstatusline@latest --install bunx
copilotstatusline --install global
```

The accepted install modes are `npm`, `bunx`, and `global`. Installation writes only to `$COPILOT_HOME/settings.json`, with `~/.copilot/settings.json` as the fallback. Existing files are backed up as `settings.json.bak.<timestamp>` before replacement.

The installer:

- preserves unrelated root and footer keys;
- sets `statusLine.type` to `command`;
- sets status-line padding to zero;
- enables `footer.showCustom`;
- refuses an installed Copilot CLI version older than 1.0.52.

If the `copilot` executable cannot be resolved, installation still writes the configuration. This supports configuring an environment before Copilot CLI is added to `PATH`.

## Uninstallation safety

```sh
copilotstatusline --uninstall
```

Uninstallation removes `statusLine` only when its command is recognized as belonging to `copilotstatusline`. A different custom status-line command is left untouched.

## Formatter settings

The interactive editor accepts Up/Down arrows or Vim-style `k`/`j` for vertical navigation. The same shortcuts move lines and widgets while move mode is active. Widget search and text-editing fields keep `j` and `k` as normal text input. In the widget editor, `y` clones the selected widget.

Default path:

```text
~/.config/copilotstatusline/settings.json
```

`XDG_CONFIG_HOME` changes the Unix root. `%APPDATA%` is used on Windows. A custom path can be selected with:

```sh
copilotstatusline --config /absolute/path/settings.json
```

Combine the flag with installation so Copilot always invokes the same file:

```sh
copilotstatusline --config /absolute/path/settings.json --install global
```

The settings schema is versioned independently of Copilot settings:

```json
{
  "version": 1,
  "lines": [
    [
      {
        "id": "model",
        "type": "model",
        "color": "cyan",
        "backgroundColor": "none",
        "bold": false,
        "raw": false,
        "prefix": "",
        "suffix": "",
        "merge": false,
        "hideWhenZero": false
      }
    ]
  ],
  "defaultSeparator": " · ",
  "colorLevel": 2,
  "powerline": {
    "enabled": false,
    "separator": ""
  },
  "gitCacheTtlSeconds": 5
}
```

`colorLevel` accepts zero through three. Zero disables ANSI styling. The current renderer uses ANSI 16-color names; values above zero enable them.

## Widget configuration

Every widget has an `id`, `type`, foreground and background colors, bold and raw-value flags, prefix and suffix text, merge behavior, and an optional zero-hiding flag.

Additional widget fields:

- `custom-text`: set `value`.
- `custom-command`: set `command`.
- `separator`: set `value`.
- `flex`: no additional value; it consumes remaining terminal width.

Custom commands execute through the local shell with a 500 ms timeout. Only the first output line is rendered. Store only trusted commands in the settings file.

## Payload fields

The normalized widgets currently use:

- session: `session_id`, `session_name`, `cwd`, `workspace`, and `version`;
- model: string or object `model`, `modelName`, `current_model`, `reasoning_effort`, and `effort.level`;
- context: cumulative input, output, cache read/write, reasoning and total tokens, last-call tokens, current context, displayed limit, and used percentage;
- cost: API duration, total duration, premium requests, and added/removed lines;
- permission state: `allow_all`.

## Diagnostics

Inspect integration status:

```sh
copilotstatusline --check
```

Test rendering without changing Copilot settings:

```sh
bun run example
```

Warnings about malformed formatter settings go to stderr. Status-line content remains on stdout so Copilot does not receive diagnostics as display content.
