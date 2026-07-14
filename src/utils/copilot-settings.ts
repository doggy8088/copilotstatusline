import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const STATUS_LINE_COMMANDS = {
    npm: 'npx -y copilotstatusline@latest',
    bunx: 'bunx -y copilotstatusline@latest',
    global: 'copilotstatusline'
} as const;

export type InstallCommandMode = keyof typeof STATUS_LINE_COMMANDS;

interface StatusLineSetting {
    type?: string;
    command?: string;
    padding?: number;
}

interface CopilotSettings {
    statusLine?: StatusLineSetting;
    footer?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface CopilotIntegrationStatus {
    home: string;
    settingsPath: string;
    installed: boolean;
    visible: boolean;
    command: string | null;
    version: string | null;
    supportedVersion: boolean;
}

export function getCopilotHome(): string {
    const configured = process.env.COPILOT_HOME;
    return configured === undefined || configured.trim() === ''
        ? path.join(os.homedir(), '.copilot')
        : path.resolve(configured);
}

export function getCopilotSettingsPath(): string {
    return path.join(getCopilotHome(), 'settings.json');
}

export function isOwnedStatusLineCommand(command: string | undefined): boolean {
    if (command === undefined) {
        return false;
    }

    return Object.values(STATUS_LINE_COMMANDS).some(candidate => command === candidate
        || command.startsWith(`${candidate} --config `))
    || /(?:^|[\\/\s])copilotstatusline\.(?:ts|js)(?:\s|$)/u.test(command);
}

async function loadCopilotSettings(): Promise<CopilotSettings> {
    try {
        const input = await fs.promises.readFile(getCopilotSettingsPath(), 'utf8');
        const parsed: unknown = JSON.parse(input);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('Copilot settings must be a JSON object');
        }

        return parsed as CopilotSettings;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {};
        }

        throw error;
    }
}

async function writeCopilotSettings(settings: CopilotSettings): Promise<void> {
    const settingsPath = getCopilotSettingsPath();
    const directory = path.dirname(settingsPath);
    await fs.promises.mkdir(directory, { recursive: true });

    if (fs.existsSync(settingsPath)) {
        const backupPath = `${settingsPath}.bak.${Date.now()}`;
        await fs.promises.copyFile(settingsPath, backupPath);
    }

    const temporaryPath = path.join(
        directory,
        `${path.basename(settingsPath)}.${process.pid}.${Date.now()}.tmp`
    );

    try {
        await fs.promises.writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
        await fs.promises.rename(temporaryPath, settingsPath);
    } catch (error) {
        await fs.promises.unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

function parseVersion(output: string): string | null {
    return (/\b(\d+\.\d+\.\d+)(?:-\d+)?\b/u.exec(output))?.[1] ?? null;
}

function supportsStatusLineShellCommand(version: string | null): boolean {
    if (version === null) {
        return false;
    }

    const parts = version.split('.').map(Number);
    const [major = 0, minor = 0, patch = 0] = parts;
    return major > 1 || (major === 1 && (minor > 0 || patch >= 52));
}

export function getCopilotVersion(): string | null {
    try {
        return parseVersion(execFileSync('copilot', ['--version'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 2_000,
            windowsHide: true
        }));
    } catch {
        return null;
    }
}

export async function inspectCopilotIntegration(): Promise<CopilotIntegrationStatus> {
    const settings = await loadCopilotSettings();
    const command = settings.statusLine?.command ?? null;
    const version = getCopilotVersion();

    return {
        home: getCopilotHome(),
        settingsPath: getCopilotSettingsPath(),
        installed: isOwnedStatusLineCommand(command ?? undefined),
        visible: settings.footer?.showCustom === true,
        command,
        version,
        supportedVersion: supportsStatusLineShellCommand(version)
    };
}

export async function installCopilotStatusLine(
    mode: InstallCommandMode,
    customConfigPath?: string
): Promise<void> {
    const version = getCopilotVersion();

    if (version !== null && !supportsStatusLineShellCommand(version)) {
        throw new Error(`Copilot CLI ${version} 不支援 shell command statusline；最低版本為 1.0.52`);
    }

    const settings = await loadCopilotSettings();
    const baseCommand = STATUS_LINE_COMMANDS[mode];
    const command = customConfigPath === undefined
        ? baseCommand
        : `${baseCommand} --config ${JSON.stringify(path.resolve(customConfigPath))}`;

    settings.statusLine = {
        type: 'command',
        command,
        padding: 0
    };
    settings.footer = {
        ...(settings.footer ?? {}),
        showCustom: true
    };
    await writeCopilotSettings(settings);
}

export async function uninstallCopilotStatusLine(): Promise<boolean> {
    const settings = await loadCopilotSettings();

    if (!isOwnedStatusLineCommand(settings.statusLine?.command)) {
        return false;
    }

    delete settings.statusLine;

    await writeCopilotSettings(settings);
    return true;
}
