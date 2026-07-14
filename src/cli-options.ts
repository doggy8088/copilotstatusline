export const HELP_TEXT = `Usage: copilotstatusline [options]

Render a GitHub Copilot CLI status payload from stdin. When stdin is a TTY,
open the interactive configuration UI instead.

Options:
  -h, --help                  Show this help message
  -v, --version               Show the package version
      --config <path>         Use a custom formatter settings file
      --check                 Print Copilot CLI integration status as JSON
      --install [mode]        Install the integration using npm, bunx, or global
      --uninstall             Remove an integration owned by this package`;

export function takeFlag(args: string[], ...names: string[]): boolean {
    const index = args.findIndex(argument => names.includes(argument));

    if (index < 0) {
        return false;
    }

    args.splice(index, 1);
    return true;
}
