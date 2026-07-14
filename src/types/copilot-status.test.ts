import {
    describe,
    expect,
    it
} from 'vitest';

import {
    CopilotStatusSchema,
    normalizeCopilotStatus
} from './copilot-status';

describe('CopilotStatusSchema', () => {
    it('accepts a modern Copilot status payload and normalizes aliases', () => {
        const parsed = CopilotStatusSchema.parse({
            session_id: 'session-1',
            workspace: { current_dir: '/tmp/project' },
            model: {
                id: 'gpt-5',
                display_name: 'GPT-5'
            },
            effort: { level: 'high' },
            context_window: {
                total_input_tokens: '1200',
                total_output_tokens: 300,
                current_context_tokens: 1500,
                displayed_context_limit: 10_000,
                current_context_used_percentage: 15
            },
            cost: {
                total_duration_ms: '2500',
                total_premium_requests: 2
            },
            allow_all: true,
            future_field: 'ignored but preserved by the loose schema'
        });
        const status = normalizeCopilotStatus(parsed);

        expect(status).toMatchObject({
            sessionId: 'session-1',
            cwd: '/tmp/project',
            modelId: 'gpt-5',
            modelName: 'GPT-5',
            reasoningEffort: 'high',
            allowAll: true
        });
        expect(status.context.inputTokens).toBe(1200);
        expect(status.context.totalTokens).toBe(1500);
        expect(status.cost.durationMs).toBe(2500);
    });

    it('accepts a minimal payload and supplies zero-valued counters', () => {
        const status = normalizeCopilotStatus(CopilotStatusSchema.parse({ model: 'gpt-5-mini' }));

        expect(status.modelId).toBe('gpt-5-mini');
        expect(status.modelName).toBe('gpt-5-mini');
        expect(status.context.totalTokens).toBe(0);
        expect(status.cost.premiumRequests).toBe(0);
    });

    it('accepts a null session name from Copilot CLI', () => {
        const status = normalizeCopilotStatus(CopilotStatusSchema.parse({
            session_id: 'session-2',
            session_name: null,
            model: {
                id: 'gpt-5.4',
                display_name: 'GPT-5.4'
            }
        }));

        expect(status.sessionId).toBe('session-2');
        expect(status.sessionName).toBeUndefined();
        expect(status.modelName).toBe('GPT-5.4');
    });

    it('rejects invalid numeric fields instead of guessing', () => {
        expect(() => CopilotStatusSchema.parse({ context_window: { total_input_tokens: 'not-a-number' } })).toThrow();
    });
});
