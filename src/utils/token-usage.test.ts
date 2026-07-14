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
import { z } from 'zod';

import type { NormalizedCopilotStatus } from '../types/copilot-status';

import {
    USAGE_RECORDING_DISABLE_ENV,
    recordTokenUsage
} from './token-usage';

interface StatusOverrides {
    context?: Partial<NormalizedCopilotStatus['context']>;
    modelId?: string;
    modelName?: string;
    sessionId?: string;
}

const compatibleTokenStatsSchema = z.looseObject({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    cache_read: z.number().int().nonnegative().optional(),
    cache_write: z.number().int().nonnegative().optional(),
    reasoning: z.number().int().nonnegative().optional(),
    total: z.number().int().nonnegative()
});

const tokenUsageInsightsEntrySchema = z.looseObject({
    timestamp: z.string(),
    session_id: z.string(),
    session_name: z.string().optional(),
    transcript_path: z.string().optional(),
    cwd: z.string().optional(),
    version: z.string().optional(),
    turn_no: z.number().int().nonnegative(),
    model: z.string().optional(),
    model_id: z.string().optional(),
    tokens: compatibleTokenStatsSchema.optional(),
    delta_tokens: compatibleTokenStatsSchema.optional(),
    context: z.looseObject({
        current_context_tokens: z.number().int().nonnegative().optional(),
        displayed_context_limit: z.number().int().nonnegative().optional(),
        current_context_used_percentage: z.string().optional()
    }).optional(),
    cost: z.looseObject({
        total_api_duration_ms: z.number().optional(),
        total_duration_ms: z.number().optional(),
        total_premium_requests: z.number().optional()
    }).optional()
});

function createStatus(overrides: StatusOverrides = {}): NormalizedCopilotStatus {
    return {
        sessionId: overrides.sessionId ?? 'session-1',
        sessionName: 'Example session',
        transcriptPath: '/tmp/transcript',
        cwd: '/tmp/project',
        version: '1.0.71-0',
        modelId: overrides.modelId ?? 'gpt-5',
        modelName: overrides.modelName ?? 'GPT-5',
        reasoningEffort: 'high',
        allowAll: false,
        context: {
            inputTokens: 80,
            outputTokens: 20,
            cacheReadTokens: 10,
            cacheWriteTokens: 5,
            reasoningTokens: 3,
            totalTokens: 118,
            lastCallInputTokens: 12,
            lastCallOutputTokens: 4,
            currentTokens: 50,
            limitTokens: 1_000,
            usedPercentage: 5,
            ...overrides.context
        },
        cost: {
            apiDurationMs: 200,
            durationMs: 500,
            premiumRequests: 1,
            linesAdded: 4,
            linesRemoved: 2
        }
    };
}

function readEntries(home: string, date = '2026-07-15'): Record<string, unknown>[] {
    const input = fs.readFileSync(path.join(home, 'usage', `usage-${date}.jsonl`), 'utf8');
    return input.trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>);
}

let temporaryHome = '';
let originalDisableValue: string | undefined;

beforeEach(() => {
    temporaryHome = fs.mkdtempSync(path.join(os.tmpdir(), 'copilotstatusline-usage-'));
    originalDisableValue = process.env[USAGE_RECORDING_DISABLE_ENV];
    Reflect.deleteProperty(process.env, USAGE_RECORDING_DISABLE_ENV);
});

afterEach(() => {
    if (originalDisableValue === undefined) {
        Reflect.deleteProperty(process.env, USAGE_RECORDING_DISABLE_ENV);
    } else {
        process.env[USAGE_RECORDING_DISABLE_ENV] = originalDisableValue;
    }

    fs.rmSync(temporaryHome, { recursive: true, force: true });
});

describe('recordTokenUsage', () => {
    it('writes TokenUsageInsights-compatible cumulative and delta entries', async () => {
        const firstTime = new Date(2026, 6, 15, 10, 20, 30);
        const first = await recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            now: firstTime
        });
        const unchanged = await recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 10, 20, 31)
        });
        const increased = createStatus({
            context: {
                inputTokens: 100,
                outputTokens: 25,
                cacheReadTokens: 15,
                cacheWriteTokens: 6,
                reasoningTokens: 4,
                totalTokens: 150
            }
        });
        const second = await recordTokenUsage(increased, {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 10, 20, 32)
        });

        expect(first.recorded).toBe(true);
        expect(unchanged.recorded).toBe(false);
        expect(second.recorded).toBe(true);

        const entries = readEntries(temporaryHome);
        expect(entries).toHaveLength(2);
        expect(() => tokenUsageInsightsEntrySchema.parse(entries[0])).not.toThrow();
        expect(entries[0]).toMatchObject({
            session_id: 'session-1',
            turn_no: 1,
            model: 'GPT-5',
            tokens: {
                input: 80,
                output: 20,
                cache_read: 10,
                cache_write: 5,
                reasoning: 3,
                total: 118
            },
            delta_tokens: {
                input: 80,
                output: 20,
                cache_read: 10,
                cache_write: 5,
                reasoning: 3,
                total: 118
            },
            context: { current_context_used_percentage: '5' }
        });
        expect(entries[1]).toMatchObject({
            turn_no: 2,
            delta_tokens: {
                input: 20,
                output: 5,
                cache_read: 5,
                cache_write: 1,
                reasoning: 1,
                total: 32
            }
        });
        expect(entries[0]?.timestamp).toMatch(/^2026-07-15T10:20:30[+-]\d{2}:\d{2}$/u);
    });

    it('tracks interleaved sessions independently', async () => {
        await recordTokenUsage(createStatus({ sessionId: 'session-a' }), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 11, 0, 0)
        });
        await recordTokenUsage(createStatus({
            sessionId: 'session-b',
            context: { totalTokens: 200 }
        }), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 11, 0, 1)
        });
        await recordTokenUsage(createStatus({
            sessionId: 'session-a',
            context: { totalTokens: 130 }
        }), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 11, 0, 2)
        });

        const entries = readEntries(temporaryHome);
        expect(entries[2]).toMatchObject({
            session_id: 'session-a',
            turn_no: 2,
            delta_tokens: { total: 12 }
        });
    });

    it('imports a matching legacy state without duplicating prior usage', async () => {
        fs.writeFileSync(path.join(temporaryHome, 'statusline-state.json'), JSON.stringify({
            session_id: 'session-1',
            turn_no: 4,
            model: 'GPT-5',
            model_id: 'gpt-5',
            input_tokens: 70,
            output_tokens: 18,
            cache_read_tokens: 9,
            cache_write_tokens: 5,
            reasoning_tokens: 3,
            total_tokens: 105
        }), 'utf8');

        await recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 12, 0, 0)
        });

        expect(readEntries(temporaryHome)[0]).toMatchObject({
            turn_no: 5,
            delta_tokens: {
                input: 10,
                output: 2,
                cache_read: 1,
                cache_write: 0,
                reasoning: 0,
                total: 13
            }
        });
    });

    it('clamps reset counters and uses the reset values as the next baseline', async () => {
        await recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 13, 0, 0)
        });
        const reset = await recordTokenUsage(createStatus({
            context: {
                inputTokens: 5,
                outputTokens: 2,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                reasoningTokens: 0,
                totalTokens: 7
            }
        }), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 13, 0, 1)
        });
        await recordTokenUsage(createStatus({
            context: {
                inputTokens: 8,
                outputTokens: 3,
                cacheReadTokens: 1,
                cacheWriteTokens: 0,
                reasoningTokens: 0,
                totalTokens: 12
            }
        }), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 13, 0, 2)
        });

        expect(reset.recorded).toBe(false);
        expect(readEntries(temporaryHome)[1]).toMatchObject({
            turn_no: 2,
            delta_tokens: {
                input: 3,
                output: 1,
                cache_read: 1,
                cache_write: 0,
                reasoning: 0,
                total: 5
            }
        });
    });

    it('records model changes on the next token-bearing turn', async () => {
        await recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 14, 0, 0)
        });
        await recordTokenUsage(createStatus({
            modelId: 'claude-sonnet-4.5',
            modelName: 'Claude Sonnet 4.5',
            context: { totalTokens: 130 }
        }), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 14, 0, 1)
        });

        expect(readEntries(temporaryHome)[1]).toMatchObject({
            previous_model: 'GPT-5',
            model: 'Claude Sonnet 4.5',
            model_changed: true
        });
    });

    it('skips missing sessions, disabled recording, and invalid counters', async () => {
        const missingSession = createStatus();
        delete missingSession.sessionId;
        expect((await recordTokenUsage(missingSession, { copilotHome: temporaryHome })).recorded)
            .toBe(false);

        process.env[USAGE_RECORDING_DISABLE_ENV] = '1';
        expect((await recordTokenUsage(createStatus(), { copilotHome: temporaryHome })).recorded)
            .toBe(false);
        Reflect.deleteProperty(process.env, USAGE_RECORDING_DISABLE_ENV);

        const invalid = createStatus({ context: { inputTokens: -1 } });
        await expect(recordTokenUsage(invalid, { copilotHome: temporaryHome }))
            .rejects.toThrow('token counters must be non-negative safe integers');
        expect(fs.existsSync(path.join(temporaryHome, 'usage'))).toBe(false);
    });

    it('preserves an invalid state file before recovering', async () => {
        const statePath = path.join(temporaryHome, 'copilotstatusline-usage-state.json');
        fs.writeFileSync(statePath, '{broken', 'utf8');

        const result = await recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 15, 0, 0)
        });
        const recovered = fs.readdirSync(temporaryHome)
            .filter(name => name.startsWith('copilotstatusline-usage-state.json.corrupt.'));

        expect(result.recorded).toBe(true);
        expect(result.warning).toContain('recovered invalid usage state');
        expect(recovered).toHaveLength(1);
        expect(fs.existsSync(statePath)).toBe(true);
    });

    it('times out on an active lock and reclaims a stale lock', async () => {
        const lockPath = path.join(temporaryHome, 'copilotstatusline-usage.lock');
        fs.mkdirSync(lockPath);

        await expect(recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            lockTimeoutMs: 10,
            staleLockMs: 60_000
        })).rejects.toThrow('timed out waiting for usage lock');

        const staleTime = new Date(Date.now() - 10_000);
        fs.utimesSync(lockPath, staleTime, staleTime);
        const result = await recordTokenUsage(createStatus(), {
            copilotHome: temporaryHome,
            now: new Date(2026, 6, 15, 16, 0, 0),
            staleLockMs: 5_000
        });

        expect(result.recorded).toBe(true);
        expect(fs.existsSync(lockPath)).toBe(false);
    });

    it('retains only the 100 most recently updated session states', async () => {
        for (let index = 0; index < 101; index += 1) {
            await recordTokenUsage(createStatus({ sessionId: `session-${index}` }), {
                copilotHome: temporaryHome,
                now: new Date(2026, 6, 15, 17, 0, index)
            });
        }

        const state = JSON.parse(fs.readFileSync(
            path.join(temporaryHome, 'copilotstatusline-usage-state.json'),
            'utf8'
        )) as { sessions: Record<string, { sessionId: string }> };
        const sessionIds = Object.values(state.sessions).map(session => session.sessionId);

        expect(sessionIds).toHaveLength(100);
        expect(sessionIds).not.toContain('session-0');
        expect(sessionIds).toContain('session-100');
    });
});
