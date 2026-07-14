import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';

import {
    STATUS_LINE_COMMANDS,
    getCopilotSettingsPath,
    inspectCopilotIntegration,
    installCopilotStatusLine,
    isOwnedStatusLineCommand,
    uninstallCopilotStatusLine
} from './copilot-settings';

let temporaryHome = '';
let originalCopilotHome: string | undefined;
let originalPath: string | undefined;

beforeEach(() => {
    originalCopilotHome = process.env.COPILOT_HOME;
    originalPath = process.env.PATH;
    temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'copilotstatusline-home-'));
    process.env.COPILOT_HOME = temporaryHome;
    process.env.PATH = '';
});

afterEach(() => {
    if (originalCopilotHome === undefined) {
        delete process.env.COPILOT_HOME;
    } else {
        process.env.COPILOT_HOME = originalCopilotHome;
    }

    if (originalPath === undefined) {
        delete process.env.PATH;
    } else {
        process.env.PATH = originalPath;
    }

    fs.rmSync(temporaryHome, { recursive: true, force: true });
});

describe('Copilot integration', () => {
    it('recognizes only commands owned by this package', () => {
        expect(isOwnedStatusLineCommand(STATUS_LINE_COMMANDS.npm)).toBe(true);
        expect(isOwnedStatusLineCommand('copilotstatusline --config "/tmp/settings.json"')).toBe(true);
        expect(isOwnedStatusLineCommand('my-status-command')).toBe(false);
    });

    it('merges installation settings and preserves unrelated keys', async () => {
        fs.writeFileSync(getCopilotSettingsPath(), JSON.stringify({
            theme: 'dark',
            footer: { showModel: true }
        }), 'utf8');

        await installCopilotStatusLine('global', '/tmp/custom settings.json');

        const installed = JSON.parse(fs.readFileSync(getCopilotSettingsPath(), 'utf8')) as {
            theme: string;
            footer: { showCustom: boolean; showModel: boolean };
            statusLine: { command: string; padding: number; type: string };
        };
        expect(installed.theme).toBe('dark');
        expect(installed.footer).toEqual({ showModel: true, showCustom: true });
        expect(installed.statusLine).toEqual({
            type: 'command',
            command: 'copilotstatusline --config "/tmp/custom settings.json"',
            padding: 0
        });

        const status = await inspectCopilotIntegration();
        expect(status.installed).toBe(true);
        expect(status.visible).toBe(true);
    });

    it('uninstalls only an owned status line', async () => {
        fs.writeFileSync(getCopilotSettingsPath(), JSON.stringify({ statusLine: { type: 'command', command: 'someone-elses-command' } }), 'utf8');
        expect(await uninstallCopilotStatusLine()).toBe(false);

        await installCopilotStatusLine('npm');
        expect(await uninstallCopilotStatusLine()).toBe(true);
        const settings = JSON.parse(fs.readFileSync(getCopilotSettingsPath(), 'utf8')) as {
            footer?: unknown;
            statusLine?: unknown;
        };
        expect(settings.footer).toEqual({ showCustom: true });
        expect(settings.statusLine).toBeUndefined();
    });
});
