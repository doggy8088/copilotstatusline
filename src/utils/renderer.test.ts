import stripAnsi from 'strip-ansi';
import {
    describe,
    expect,
    it
} from 'vitest';

import {
    DEFAULT_SETTINGS,
    SettingsSchema
} from '../types/Settings';
import type { NormalizedCopilotStatus } from '../types/copilot-status';

import { renderStatusLines } from './renderer';

const status: NormalizedCopilotStatus = {
    modelId: 'gpt-5',
    modelName: 'GPT-5',
    cwd: '/path/that-is-not-a-repository',
    context: {
        inputTokens: 1200,
        outputTokens: 300,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        totalTokens: 1500,
        lastCallInputTokens: 200,
        lastCallOutputTokens: 40,
        currentTokens: 2500,
        limitTokens: 10_000,
        usedPercentage: 25
    },
    cost: {
        apiDurationMs: 1200,
        durationMs: 65_000,
        premiumRequests: 2,
        linesAdded: 8,
        linesRemoved: 3
    }
};

describe('renderStatusLines', () => {
    it('renders available default widgets and omits unavailable git data', () => {
        const settings = structuredClone(DEFAULT_SETTINGS);
        settings.colorLevel = 0;

        expect(renderStatusLines(status, settings, { terminalWidth: 120 })).toEqual([
            'Model: GPT-5 · Context: 75% left'
        ]);
    });

    it('expands flex widgets to the requested terminal width', () => {
        const settings = SettingsSchema.parse({
            version: 1,
            colorLevel: 0,
            lines: [[
                { id: 'left', type: 'custom-text', value: 'left', raw: true },
                { id: 'flex', type: 'flex' },
                { id: 'right', type: 'custom-text', value: 'right', raw: true }
            ]]
        });
        const [line = ''] = renderStatusLines(status, settings, { terminalWidth: 20 });

        expect(line).toBe('left           right');
        expect(stripAnsi(line)).toHaveLength(20);
    });

    it('renders and truncates Powerline output without breaking the width limit', () => {
        const settings = SettingsSchema.parse({
            version: 1,
            colorLevel: 2,
            powerline: { enabled: true, separator: '>' },
            lines: [[
                { id: 'model', type: 'model' },
                { id: 'tokens', type: 'total-tokens' }
            ]]
        });
        const [line = ''] = renderStatusLines(status, settings, { terminalWidth: 16 });

        expect(stripAnsi(line)).toMatch(/^ Model: GPT-5/u);
        expect(stripAnsi(line).length).toBeLessThanOrEqual(16);
    });

    it('explicitly resets the background after the final Powerline segment', () => {
        const settings = SettingsSchema.parse({
            version: 1,
            colorLevel: 2,
            powerline: { enabled: true, separator: '>' },
            lines: [[
                { id: 'model', type: 'model' },
                { id: 'tokens', type: 'total-tokens' }
            ]]
        });
        const [line = ''] = renderStatusLines(status, settings, { terminalWidth: 120 });

        expect(line).toMatch(/\u001B\[35;49m>\u001B\[0m$/u);
    });
});
