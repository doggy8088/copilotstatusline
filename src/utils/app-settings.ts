import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
    DEFAULT_SETTINGS,
    SettingsSchema,
    type Settings
} from '../types/Settings';

let configuredPath: string | undefined;
let customPath = false;
let loadError: string | null = null;

function defaultConfigRoot(): string {
    if (process.platform === 'win32') {
        return process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
    }

    return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
}

export function initializeSettingsPath(filePath?: string): void {
    customPath = filePath !== undefined;
    configuredPath = filePath === undefined
        ? path.join(defaultConfigRoot(), 'copilotstatusline', 'settings.json')
        : path.resolve(filePath);
}

export function isSettingsPathCustom(): boolean {
    return customPath;
}

export function getSettingsPath(): string {
    const filePath = configuredPath ?? path.join(defaultConfigRoot(), 'copilotstatusline', 'settings.json');
    configuredPath = filePath;

    return filePath;
}

export function getSettingsLoadError(): string | null {
    return loadError;
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
    const directory = path.dirname(filePath);
    await fs.promises.mkdir(directory, { recursive: true });
    const destination = await fs.promises.realpath(filePath).catch(() => filePath);
    const temporaryPath = path.join(
        path.dirname(destination),
        `${path.basename(destination)}.${process.pid}.${Date.now()}.tmp`
    );

    try {
        await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        await fs.promises.rename(temporaryPath, destination);
    } catch (error) {
        await fs.promises.unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

export async function loadSettings(options: { createIfMissing?: boolean } = {}): Promise<Settings> {
    loadError = null;
    const filePath = getSettingsPath();

    try {
        const input = await fs.promises.readFile(filePath, 'utf8');
        const parsed: unknown = JSON.parse(input);
        const result = SettingsSchema.safeParse(parsed);

        if (!result.success) {
            loadError = 'settings.json 格式不符合 schema v1';
            return structuredClone(DEFAULT_SETTINGS);
        }

        return result.data;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            const defaults = structuredClone(DEFAULT_SETTINGS);

            if (options.createIfMissing === true) {
                await atomicWriteJson(filePath, defaults);
            }

            return defaults;
        }

        loadError = error instanceof SyntaxError
            ? 'settings.json 不是有效的 JSON'
            : '無法讀取 settings.json';
        return structuredClone(DEFAULT_SETTINGS);
    }
}

export async function saveSettings(settings: Settings): Promise<void> {
    const validated = SettingsSchema.parse(settings);
    await atomicWriteJson(getSettingsPath(), validated);
    loadError = null;
}
