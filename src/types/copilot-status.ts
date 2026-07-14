import { z } from 'zod';

const numberValue = z.preprocess((value) => {
    if (typeof value !== 'string' || value.trim() === '') {
        return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
}, z.number());

const modelSchema = z.union([
    z.string(),
    z.looseObject({
        id: z.string().optional(),
        display_name: z.string().optional()
    })
]);

export const CopilotStatusSchema = z.looseObject({
    session_id: z.string().optional(),
    session_name: z.string().nullable().optional(),
    transcript_path: z.string().optional(),
    cwd: z.string().optional(),
    version: z.string().optional(),
    model: modelSchema.nullable().optional(),
    modelName: z.string().optional(),
    current_model: z.string().optional(),
    reasoning_effort: z.string().optional(),
    effort: z.looseObject({ level: z.string().nullable().optional() }).nullable().optional(),
    workspace: z.looseObject({
        current_dir: z.string().optional(),
        project_dir: z.string().optional()
    }).optional(),
    context_window: z.looseObject({
        total_input_tokens: numberValue.nullable().optional(),
        total_output_tokens: numberValue.nullable().optional(),
        total_cache_read_tokens: numberValue.nullable().optional(),
        total_cache_write_tokens: numberValue.nullable().optional(),
        total_reasoning_tokens: numberValue.nullable().optional(),
        total_tokens: numberValue.nullable().optional(),
        last_call_input_tokens: numberValue.nullable().optional(),
        last_call_output_tokens: numberValue.nullable().optional(),
        current_context_tokens: numberValue.nullable().optional(),
        displayed_context_limit: numberValue.nullable().optional(),
        current_context_used_percentage: numberValue.nullable().optional()
    }).nullable().optional(),
    cost: z.looseObject({
        total_api_duration_ms: numberValue.nullable().optional(),
        total_duration_ms: numberValue.nullable().optional(),
        total_premium_requests: numberValue.nullable().optional(),
        total_lines_added: numberValue.nullable().optional(),
        total_lines_removed: numberValue.nullable().optional()
    }).nullable().optional(),
    allow_all: z.boolean().optional()
});

export type CopilotStatus = z.infer<typeof CopilotStatusSchema>;

export interface NormalizedCopilotStatus {
    sessionId?: string;
    sessionName?: string;
    transcriptPath?: string;
    cwd?: string;
    version?: string;
    modelId?: string;
    modelName?: string;
    reasoningEffort?: string;
    allowAll?: boolean;
    context: {
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        reasoningTokens: number;
        totalTokens: number;
        lastCallInputTokens: number;
        lastCallOutputTokens: number;
        currentTokens: number;
        limitTokens: number;
        usedPercentage?: number;
    };
    cost: {
        apiDurationMs: number;
        durationMs: number;
        premiumRequests: number;
        linesAdded: number;
        linesRemoved: number;
    };
}

function finiteNumber(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function normalizeCopilotStatus(status: CopilotStatus): NormalizedCopilotStatus {
    const model = status.model;
    const modelId = typeof model === 'string'
        ? model
        : model?.id ?? status.modelName ?? status.current_model;
    const modelName = typeof model === 'string'
        ? model
        : model?.display_name ?? model?.id ?? status.modelName ?? status.current_model;
    const context = status.context_window;
    const inputTokens = finiteNumber(context?.total_input_tokens);
    const outputTokens = finiteNumber(context?.total_output_tokens);
    const cacheReadTokens = finiteNumber(context?.total_cache_read_tokens);
    const cacheWriteTokens = finiteNumber(context?.total_cache_write_tokens);
    const reasoningTokens = finiteNumber(context?.total_reasoning_tokens);
    const reportedTotal = finiteNumber(context?.total_tokens);
    const totalTokens = reportedTotal > 0
        ? reportedTotal
        : inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens;

    return {
        sessionId: status.session_id,
        sessionName: status.session_name ?? undefined,
        transcriptPath: status.transcript_path,
        cwd: status.cwd ?? status.workspace?.current_dir ?? status.workspace?.project_dir,
        version: status.version,
        modelId,
        modelName,
        reasoningEffort: status.reasoning_effort ?? status.effort?.level ?? undefined,
        allowAll: status.allow_all,
        context: {
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheWriteTokens,
            reasoningTokens,
            totalTokens,
            lastCallInputTokens: finiteNumber(context?.last_call_input_tokens),
            lastCallOutputTokens: finiteNumber(context?.last_call_output_tokens),
            currentTokens: finiteNumber(context?.current_context_tokens),
            limitTokens: finiteNumber(context?.displayed_context_limit),
            usedPercentage: context?.current_context_used_percentage ?? undefined
        },
        cost: {
            apiDurationMs: finiteNumber(status.cost?.total_api_duration_ms),
            durationMs: finiteNumber(status.cost?.total_duration_ms),
            premiumRequests: finiteNumber(status.cost?.total_premium_requests),
            linesAdded: finiteNumber(status.cost?.total_lines_added),
            linesRemoved: finiteNumber(status.cost?.total_lines_removed)
        }
    };
}
