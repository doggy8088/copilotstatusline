# Windows

## Requirements

- GitHub Copilot CLI 1.0.52 or newer
- Node.js 22 or newer
- Windows Terminal or another terminal with ANSI support

## Paths

Copilot user settings:

```text
%COPILOT_HOME%\settings.json
```

When `COPILOT_HOME` is not set, the fallback is the `.copilot` directory in the current user's home directory.

Formatter settings:

```text
%APPDATA%\copilotstatusline\settings.json
```

`--config <path>` overrides the formatter settings path. Installing with the same command writes the absolute Windows path into Copilot settings.

## Installation

PowerShell:

```powershell
npx -y @willh/copilotstatusline@latest --install npm
```

If a global package is installed:

```powershell
copilotstatusline --install global
```

Restart Copilot CLI after installation.

## Powerline

The default Powerline separator requires a font containing U+E0B0. If the glyph is missing, disable Powerline in the TUI or install a compatible terminal font and select it in the terminal profile.

## Diagnostics

```powershell
copilotstatusline --check
Get-Content $env:COPILOT_HOME\settings.json
```

All helper subprocesses are launched with hidden Windows process windows. Missing Git or Jujutsu executables cause only the related widgets to be omitted.
