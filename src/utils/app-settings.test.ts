import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    afterEach,
    describe,
    expect,
    it
} from 'vitest';

import { DEFAULT_SETTINGS } from '../types/Settings';

import {
    getSettingsLoadError,
    getSettingsPath,
    initializeSettingsPath,
    isSettingsPathCustom,
    loadSettings,
    saveSettings
} from './app-settings';

const temporaryDirectories: string[] = [];

function temporaryPath(): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'copilotstatusline-settings-'));
    temporaryDirectories.push(directory);
    return path.join(directory, 'settings.json');
}

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }

    initializeSettingsPath();
});

describe('app settings', () => {
    it('creates defaults only when explicitly requested', async () => {
        const filePath = temporaryPath();
        initializeSettingsPath(filePath);

        const settings = await loadSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);
        expect(fs.existsSync(filePath)).toBe(false);

        await loadSettings({ createIfMissing: true });
        expect(fs.existsSync(filePath)).toBe(true);
        expect(isSettingsPathCustom()).toBe(true);
        expect(getSettingsPath()).toBe(filePath);
    });

    it('does not overwrite malformed JSON', async () => {
        const filePath = temporaryPath();
        fs.writeFileSync(filePath, '{broken', 'utf8');
        initializeSettingsPath(filePath);

        const settings = await loadSettings();

        expect(settings).toEqual(DEFAULT_SETTINGS);
        expect(getSettingsLoadError()).toBe('settings.json 不是有效的 JSON');
        expect(fs.readFileSync(filePath, 'utf8')).toBe('{broken');
    });

    it('validates and atomically saves settings', async () => {
        const filePath = temporaryPath();
        initializeSettingsPath(filePath);
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.powerline.enabled = true;

        await saveSettings(settings);

        expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toMatchObject({
            version: 1,
            powerline: { enabled: true }
        });
    });
});
