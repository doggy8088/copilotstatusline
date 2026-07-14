#!/usr/bin/env node
import {
    CopilotStatusSchema,
    normalizeCopilotStatus
} from './types/copilot-status';
import {
    getSettingsLoadError,
    getSettingsPath,
    initializeSettingsPath,
    isSettingsPathCustom,
    loadSettings
} from './utils/app-settings';
import {
    inspectCopilotIntegration,
    installCopilotStatusLine,
    uninstallCopilotStatusLine,
    type InstallCommandMode
} from './utils/copilot-settings';
import { renderStatusLines } from './utils/renderer';

const PACKAGE_VERSION = '__PACKAGE_VERSION__';

async function readStdin(): Promise<string> {
    process.stdin.setEncoding('utf8');
    const chunks: string[] = [];

    for await (const chunk of process.stdin) {
        chunks.push(String(chunk));
    }

    return chunks.join('');
}

function takeOption(name: string): string | undefined {
    const index = process.argv.indexOf(name);

    if (index < 0) {
        return undefined;
    }

    const value = process.argv[index + 1];

    if (value === undefined || value.startsWith('--')) {
        throw new Error(`${name} requires a value`);
    }

    process.argv.splice(index, 2);
    return value;
}

function hasFlag(name: string): boolean {
    const index = process.argv.indexOf(name);

    if (index < 0) {
        return false;
    }

    process.argv.splice(index, 1);
    return true;
}

async function renderPipedStatus(): Promise<void> {
    const input = await readStdin();

    if (input.trim() === '') {
        throw new Error('No status JSON received on stdin');
    }

    const parsedJson: unknown = JSON.parse(input);
    const parsed = CopilotStatusSchema.safeParse(parsedJson);

    if (!parsed.success) {
        throw new Error(`Invalid Copilot status JSON: ${parsed.error.message}`);
    }

    const settings = await loadSettings();
    const warning = getSettingsLoadError();

    if (warning !== null) {
        console.error(`copilotstatusline: ${warning}; using defaults without overwriting the file`);
    }

    const status = normalizeCopilotStatus(parsed.data);

    for (const line of renderStatusLines(status, settings)) {
        console.log(line);
    }
}

async function runCommandMode(): Promise<boolean> {
    if (hasFlag('--check')) {
        const status = await inspectCopilotIntegration();
        console.log(JSON.stringify(status, null, 2));
        return true;
    }

    const installIndex = process.argv.indexOf('--install');

    if (installIndex >= 0) {
        const candidate = process.argv[installIndex + 1] ?? 'npm';

        if (!['npm', 'bunx', 'global'].includes(candidate)) {
            throw new Error('--install mode must be npm, bunx, or global');
        }

        process.argv.splice(installIndex, candidate.startsWith('--') ? 1 : 2);
        await installCopilotStatusLine(
            candidate as InstallCommandMode,
            isSettingsPathCustom() ? getSettingsPath() : undefined
        );
        console.log(`Installed copilotstatusline through ${candidate}.`);
        return true;
    }

    if (hasFlag('--uninstall')) {
        const removed = await uninstallCopilotStatusLine();
        console.log(removed
            ? 'Removed copilotstatusline from Copilot CLI settings.'
            : 'Copilot CLI is not configured to use copilotstatusline.');
        return true;
    }

    return false;
}

async function main(): Promise<void> {
    if (hasFlag('--version')) {
        console.log(PACKAGE_VERSION);
        return;
    }

    initializeSettingsPath(takeOption('--config'));

    if (await runCommandMode()) {
        return;
    }

    if (!process.stdin.isTTY) {
        await renderPipedStatus();
        return;
    }

    const { runTui } = await import('./tui/index');
    await runTui();
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`copilotstatusline: ${message}`);
    process.exitCode = 1;
});
