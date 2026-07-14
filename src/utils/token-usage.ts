import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

import type { NormalizedCopilotStatus } from '../types/copilot-status';

import { getCopilotHome } from './copilot-settings';

export const USAGE_RECORDING_DISABLE_ENV = 'COPILOTSTATUSLINE_DISABLE_USAGE_RECORDING';

const STATE_VERSION = 1;
const MAX_TRACKED_SESSIONS = 100;
const DEFAULT_LOCK_TIMEOUT_MS = 100;
const DEFAULT_STALE_LOCK_MS = 5_000;

const nonNegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const sessionStateSchema = z.object({
    sessionId: z.string(),
    turnNo: nonNegativeInteger,
    model: z.string(),
    modelId: z.string(),
    inputTokens: nonNegativeInteger,
    outputTokens: nonNegativeInteger,
    cacheReadTokens: nonNegativeInteger,
    cacheWriteTokens: nonNegativeInteger,
    reasoningTokens: nonNegativeInteger,
    totalTokens: nonNegativeInteger,
    updatedAt: z.string(),
    updatedAtEpochMs: nonNegativeInteger
});

const usageStateSchema = z.object({
    version: z.literal(STATE_VERSION),
    sessions: z.record(z.string(), sessionStateSchema)
});

const legacyStateSchema = z.looseObject({
    session_id: z.string(),
    turn_no: nonNegativeInteger.optional(),
    model: z.string().optional(),
    model_id: z.string().optional(),
    input_tokens: nonNegativeInteger.optional(),
    output_tokens: nonNegativeInteger.optional(),
    cache_read_tokens: nonNegativeInteger.optional(),
    cache_write_tokens: nonNegativeInteger.optional(),
    reasoning_tokens: nonNegativeInteger.optional(),
    total_tokens: nonNegativeInteger.optional()
});

type SessionState = z.infer<typeof sessionStateSchema>;
type UsageState = z.infer<typeof usageStateSchema>;

export interface TokenUsageRecordingOptions {
    copilotHome?: string;
    lockTimeoutMs?: number;
    now?: Date;
    staleLockMs?: number;
}

export interface TokenUsageRecordingResult {
    recorded: boolean;
    warning?: string;
}

interface LoadedState {
    state: UsageState;
    warning?: string;
}

interface TokenCounters {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
}

function emptyState(): UsageState {
    return {
        version: STATE_VERSION,
        sessions: {}
    };
}

function isNodeError(error: unknown, code: string): boolean {
    return (error as NodeJS.ErrnoException).code === code;
}

function pad(value: number, length = 2): string {
    return String(value).padStart(length, '0');
}

function localDate(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localIsoTimestamp(date: Date): string {
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteOffset = Math.abs(offsetMinutes);
    const offsetHours = Math.floor(absoluteOffset / 60);
    const remainingMinutes = absoluteOffset % 60;

    return `${localDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
        + `${offsetSign}${pad(offsetHours)}:${pad(remainingMinutes)}`;
}

function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function acquireLock(
    lockPath: string,
    timeoutMs: number,
    staleLockMs: number
): Promise<() => Promise<void>> {
    const startedAt = Date.now();

    for (;;) {
        try {
            await fs.promises.mkdir(lockPath);
            return async () => fs.promises.rm(lockPath, { recursive: true, force: true });
        } catch (error) {
            if (!isNodeError(error, 'EEXIST')) {
                throw error;
            }

            const stats = await fs.promises.stat(lockPath).catch(() => undefined);

            if (stats !== undefined && Date.now() - stats.mtimeMs > staleLockMs) {
                await fs.promises.rm(lockPath, { recursive: true, force: true });
                continue;
            }

            if (Date.now() - startedAt >= timeoutMs) {
                throw new Error(`timed out waiting for usage lock after ${timeoutMs} ms`, { cause: error });
            }

            await delay(Math.min(10, Math.max(1, timeoutMs)));
        }
    }
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
    const temporaryPath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
    );

    try {
        await fs.promises.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
        await fs.promises.rename(temporaryPath, filePath);
    } catch (error) {
        await fs.promises.unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

function legacySessionState(
    input: unknown,
    sessionId: string,
    updatedAt: string,
    updatedAtEpochMs: number
): SessionState | undefined {
    const parsed = legacyStateSchema.safeParse(input);

    if (!parsed.success || parsed.data.session_id !== sessionId) {
        return undefined;
    }

    return {
        sessionId,
        turnNo: parsed.data.turn_no ?? 0,
        model: parsed.data.model ?? 'unknown',
        modelId: parsed.data.model_id ?? 'unknown',
        inputTokens: parsed.data.input_tokens ?? 0,
        outputTokens: parsed.data.output_tokens ?? 0,
        cacheReadTokens: parsed.data.cache_read_tokens ?? 0,
        cacheWriteTokens: parsed.data.cache_write_tokens ?? 0,
        reasoningTokens: parsed.data.reasoning_tokens ?? 0,
        totalTokens: parsed.data.total_tokens ?? 0,
        updatedAt,
        updatedAtEpochMs
    };
}

async function loadLegacyState(
    copilotHome: string,
    sessionId: string,
    updatedAt: string,
    updatedAtEpochMs: number
): Promise<UsageState> {
    try {
        const input = await fs.promises.readFile(path.join(copilotHome, 'statusline-state.json'), 'utf8');
        const legacy = legacySessionState(
            JSON.parse(input) as unknown,
            sessionId,
            updatedAt,
            updatedAtEpochMs
        );
        const state = emptyState();

        if (legacy !== undefined) {
            state.sessions[sessionId] = legacy;
        }

        return state;
    } catch {
        return emptyState();
    }
}

async function loadState(
    statePath: string,
    copilotHome: string,
    sessionId: string,
    updatedAt: string,
    updatedAtEpochMs: number
): Promise<LoadedState> {
    let input: string;

    try {
        input = await fs.promises.readFile(statePath, 'utf8');
    } catch (error) {
        if (!isNodeError(error, 'ENOENT')) {
            throw error;
        }

        return { state: await loadLegacyState(copilotHome, sessionId, updatedAt, updatedAtEpochMs) };
    }

    try {
        const parsedJson: unknown = JSON.parse(input);
        const parsed = usageStateSchema.safeParse(parsedJson);

        if (!parsed.success) {
            throw new Error('state schema is invalid');
        }

        return { state: parsed.data };
    } catch {
        const corruptPath = `${statePath}.corrupt.${Date.now()}.${process.pid}`;
        await fs.promises.rename(statePath, corruptPath);
        return {
            state: emptyState(),
            warning: `recovered invalid usage state as ${corruptPath}`
        };
    }
}

function tokenCounters(status: NormalizedCopilotStatus): TokenCounters | undefined {
    const cumulative = [
        status.context.inputTokens,
        status.context.outputTokens,
        status.context.cacheReadTokens,
        status.context.cacheWriteTokens,
        status.context.reasoningTokens,
        status.context.totalTokens
    ];
    const optional = [
        status.context.lastCallInputTokens,
        status.context.lastCallOutputTokens,
        status.context.currentTokens,
        status.context.limitTokens
    ];
    const present = [...cumulative, ...optional].filter(value => value !== undefined);

    if (!present.every(value => Number.isSafeInteger(value) && value >= 0)) {
        throw new Error('token counters must be non-negative safe integers');
    }

    if (cumulative.some(value => value === undefined)) {
        return undefined;
    }

    const [
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        reasoningTokens,
        totalTokens
    ] = cumulative as number[];

    return {
        inputTokens: inputTokens ?? 0,
        outputTokens: outputTokens ?? 0,
        cacheReadTokens: cacheReadTokens ?? 0,
        cacheWriteTokens: cacheWriteTokens ?? 0,
        reasoningTokens: reasoningTokens ?? 0,
        totalTokens: totalTokens ?? 0
    };
}

function delta(current: number, previous: number | undefined): number {
    return Math.max(0, current - (previous ?? 0));
}

function sessionStateKey(sessionId: string): string {
    return Buffer.from(sessionId, 'utf8').toString('base64url');
}

function pruneSessions(state: UsageState): void {
    const sessions = Object.entries(state.sessions);

    if (sessions.length <= MAX_TRACKED_SESSIONS) {
        return;
    }

    sessions.sort((left, right) => {
        return right[1].updatedAtEpochMs - left[1].updatedAtEpochMs;
    });
    state.sessions = Object.fromEntries(sessions.slice(0, MAX_TRACKED_SESSIONS));
}

export async function recordTokenUsage(
    status: NormalizedCopilotStatus,
    options: TokenUsageRecordingOptions = {}
): Promise<TokenUsageRecordingResult> {
    if (process.env[USAGE_RECORDING_DISABLE_ENV] === '1') {
        return { recorded: false };
    }

    const sessionId = status.sessionId;

    if (sessionId === undefined || sessionId.trim() === '') {
        return { recorded: false };
    }

    const counters = tokenCounters(status);

    if (counters === undefined) {
        return { recorded: false };
    }

    const now = options.now ?? new Date();
    const timestamp = localIsoTimestamp(now);
    const copilotHome = options.copilotHome ?? getCopilotHome();
    const usageDirectory = path.join(copilotHome, 'usage');
    const statePath = path.join(copilotHome, 'copilotstatusline-usage-state.json');
    const lockPath = path.join(copilotHome, 'copilotstatusline-usage.lock');
    await fs.promises.mkdir(copilotHome, { recursive: true });
    const releaseLock = await acquireLock(
        lockPath,
        options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS,
        options.staleLockMs ?? DEFAULT_STALE_LOCK_MS
    );

    try {
        const loaded = await loadState(
            statePath,
            copilotHome,
            sessionId,
            timestamp,
            now.getTime()
        );
        const state = loaded.state;
        const sessionKey = sessionStateKey(sessionId);
        const previous = state.sessions[sessionKey] ?? state.sessions[sessionId];
        const model = status.modelName ?? status.modelId ?? 'unknown';
        const modelId = status.modelId ?? 'unknown';
        const deltaInput = delta(counters.inputTokens, previous?.inputTokens);
        const deltaOutput = delta(counters.outputTokens, previous?.outputTokens);
        const deltaCacheRead = delta(counters.cacheReadTokens, previous?.cacheReadTokens);
        const deltaCacheWrite = delta(counters.cacheWriteTokens, previous?.cacheWriteTokens);
        const deltaReasoning = delta(counters.reasoningTokens, previous?.reasoningTokens);
        const deltaTotal = delta(counters.totalTokens, previous?.totalTokens);
        const previousModel = previous?.model ?? '';
        const modelChanged = previousModel !== '' && previousModel !== model;
        const turnNo = (previous?.turnNo ?? 0) + (deltaTotal > 0 ? 1 : 0);

        if (deltaTotal > 0) {
            const entry = {
                timestamp,
                session_id: sessionId,
                session_name: status.sessionName ?? '',
                transcript_path: status.transcriptPath ?? '',
                cwd: status.cwd ?? '',
                version: status.version ?? '',
                turn_no: turnNo,
                model,
                model_id: modelId,
                previous_model: previousModel,
                model_changed: modelChanged,
                tokens: {
                    input: counters.inputTokens,
                    output: counters.outputTokens,
                    cache_read: counters.cacheReadTokens,
                    cache_write: counters.cacheWriteTokens,
                    reasoning: counters.reasoningTokens,
                    total: counters.totalTokens,
                    last_call_input: status.context.lastCallInputTokens,
                    last_call_output: status.context.lastCallOutputTokens
                },
                delta_tokens: {
                    input: deltaInput,
                    output: deltaOutput,
                    cache_read: deltaCacheRead,
                    cache_write: deltaCacheWrite,
                    reasoning: deltaReasoning,
                    total: deltaTotal
                },
                context: {
                    current_context_tokens: status.context.currentTokens,
                    displayed_context_limit: status.context.limitTokens,
                    current_context_used_percentage: status.context.usedPercentage === undefined
                        ? ''
                        : String(status.context.usedPercentage)
                },
                cost: {
                    total_api_duration_ms: status.cost.apiDurationMs,
                    total_duration_ms: status.cost.durationMs,
                    total_premium_requests: status.cost.premiumRequests,
                    total_lines_added: status.cost.linesAdded,
                    total_lines_removed: status.cost.linesRemoved
                }
            };

            await fs.promises.mkdir(usageDirectory, { recursive: true });
            const jsonlPath = path.join(usageDirectory, `usage-${localDate(now)}.jsonl`);
            await fs.promises.appendFile(jsonlPath, `${JSON.stringify(entry)}\n`, 'utf8');
        }

        Reflect.deleteProperty(state.sessions, sessionId);
        state.sessions[sessionKey] = {
            sessionId,
            turnNo,
            model,
            modelId,
            inputTokens: counters.inputTokens,
            outputTokens: counters.outputTokens,
            cacheReadTokens: counters.cacheReadTokens,
            cacheWriteTokens: counters.cacheWriteTokens,
            reasoningTokens: counters.reasoningTokens,
            totalTokens: counters.totalTokens,
            updatedAt: timestamp,
            updatedAtEpochMs: now.getTime()
        };
        pruneSessions(state);
        await atomicWriteJson(statePath, state);

        return {
            recorded: deltaTotal > 0,
            ...(loaded.warning === undefined ? {} : { warning: loaded.warning })
        };
    } finally {
        await releaseLock();
    }
}
