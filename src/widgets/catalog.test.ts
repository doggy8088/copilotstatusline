import {
    describe,
    expect,
    it
} from 'vitest';

import {
    WIDGET_TYPES,
    WidgetConfigSchema,
    type WidgetType
} from '../types/Settings';
import {
    CopilotStatusSchema,
    normalizeCopilotStatus
} from '../types/copilot-status';

import {
    WIDGET_CATALOG,
    renderWidget
} from './catalog';

const COPILOT_WIDGET_TYPES = [
    'model',
    'model-id',
    'reasoning',
    'copilot-version',
    'session-id',
    'session-name',
    'cwd',
    'input-tokens',
    'output-tokens',
    'cache-read-tokens',
    'cache-write-tokens',
    'reasoning-tokens',
    'total-tokens',
    'last-call-input',
    'last-call-output',
    'current-context',
    'context-limit',
    'context-used',
    'context-remaining',
    'premium-requests',
    'api-duration',
    'session-duration',
    'lines-added',
    'lines-removed',
    'allow-all'
] as const satisfies readonly WidgetType[];

const completeStatus = normalizeCopilotStatus(CopilotStatusSchema.parse({
    session_id: 'session-1',
    session_name: 'Widget audit',
    cwd: '/tmp/project',
    version: '1.0.71-1',
    model: {
        id: 'gpt-5.4',
        display_name: 'GPT-5.4'
    },
    reasoning_effort: 'high',
    context_window: {
        total_input_tokens: 1_200,
        total_output_tokens: 300,
        total_cache_read_tokens: 100,
        total_cache_write_tokens: 20,
        total_reasoning_tokens: 10,
        total_tokens: 1_500,
        last_call_input_tokens: 200,
        last_call_output_tokens: 40,
        current_context_tokens: 2_500,
        displayed_context_limit: 10_000,
        current_context_used_percentage: 25
    },
    cost: {
        total_api_duration_ms: 1_200,
        total_duration_ms: 65_000,
        total_premium_requests: 2,
        total_lines_added: 8,
        total_lines_removed: 3
    },
    allow_all: false
}));

function render(type: WidgetType, status = completeStatus): string | null {
    return renderWidget(WidgetConfigSchema.parse({ id: type, type }), {
        status,
        terminalWidth: 120,
        gitCacheTtlSeconds: 0
    });
}

describe('WIDGET_CATALOG', () => {
    it('contains every configured widget type exactly once', () => {
        expect(WIDGET_CATALOG.map(entry => entry.type)).toEqual(WIDGET_TYPES);
    });

    it('renders every Copilot payload-backed widget when its field is available', () => {
        const rendered = Object.fromEntries(COPILOT_WIDGET_TYPES.map(type => [type, render(type)]));

        expect(rendered).toEqual({
            'model': 'Model: GPT-5.4',
            'model-id': 'Model ID: gpt-5.4',
            'reasoning': 'Effort: high',
            'copilot-version': 'Copilot: 1.0.71-1',
            'session-id': 'Session: session-1',
            'session-name': 'Session Name: Widget audit',
            'cwd': '/tmp/project',
            'input-tokens': 'In: 1.20k',
            'output-tokens': 'Out: 300',
            'cache-read-tokens': 'Cache read: 100',
            'cache-write-tokens': 'Cache write: 20',
            'reasoning-tokens': 'Reasoning: 10',
            'total-tokens': 'Tokens: 1.50k',
            'last-call-input': 'Last in: 200',
            'last-call-output': 'Last out: 40',
            'current-context': 'Context: 2.50k',
            'context-limit': 'Limit: 10.0k',
            'context-used': 'Context: 25% used',
            'context-remaining': 'Context: 75% left',
            'premium-requests': 'Premium: 2',
            'api-duration': 'API: 1s',
            'session-duration': 'Time: 1m 5s',
            'lines-added': '+: 8',
            'lines-removed': '-: 3',
            'allow-all': 'Allow All: OFF'
        });
    });

    it('distinguishes enabled, disabled, and unavailable Allow All states', () => {
        expect(render('allow-all', { ...completeStatus, allowAll: true })).toBe('Allow All: ON');
        expect(render('allow-all', { ...completeStatus, allowAll: false })).toBe('Allow All: OFF');

        const unavailable = { ...completeStatus };
        delete unavailable.allowAll;
        expect(render('allow-all', unavailable)).toBeNull();
    });

    it('hides missing optional payload values instead of rendering fabricated zeroes', () => {
        const minimal = normalizeCopilotStatus(CopilotStatusSchema.parse({ model: 'gpt-5-mini' }));

        expect(render('input-tokens', minimal)).toBeNull();
        expect(render('premium-requests', minimal)).toBeNull();
        expect(render('context-used', minimal)).toBeNull();
        expect(render('session-name', minimal)).toBeNull();
    });
});
