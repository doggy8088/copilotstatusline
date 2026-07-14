import { z } from 'zod';

export const COLORS = [
    'none',
    'black',
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
    'white',
    'brightBlack',
    'brightRed',
    'brightGreen',
    'brightYellow',
    'brightBlue',
    'brightMagenta',
    'brightCyan',
    'brightWhite'
] as const;

export const WIDGET_TYPES = [
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
    'allow-all',
    'git-branch',
    'git-changes',
    'jj-change',
    'terminal-width',
    'memory',
    'custom-text',
    'custom-command',
    'separator',
    'flex'
] as const;

export type ColorName = typeof COLORS[number];
export type WidgetType = typeof WIDGET_TYPES[number];

export const WidgetConfigSchema = z.object({
    id: z.string(),
    type: z.enum(WIDGET_TYPES),
    color: z.enum(COLORS).default('none'),
    backgroundColor: z.enum(COLORS).default('none'),
    bold: z.boolean().default(false),
    raw: z.boolean().default(false),
    prefix: z.string().default(''),
    suffix: z.string().default(''),
    value: z.string().optional(),
    command: z.string().optional(),
    merge: z.boolean().default(false),
    hideWhenZero: z.boolean().default(false)
});

export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

export const SettingsSchema = z.object({
    version: z.literal(1).default(1),
    lines: z.array(z.array(WidgetConfigSchema)).min(1),
    defaultSeparator: z.string().default(' · '),
    colorLevel: z.number().int().min(0).max(3).default(2),
    powerline: z.object({
        enabled: z.boolean().default(false),
        separator: z.string().default('\uE0B0')
    }).default({ enabled: false, separator: '\uE0B0' }),
    gitCacheTtlSeconds: z.number().min(0).max(60).default(5)
});

export type Settings = z.infer<typeof SettingsSchema>;

function widget(id: string, type: WidgetType, color: ColorName): WidgetConfig {
    return WidgetConfigSchema.parse({ id, type, color });
}

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({
    version: 1,
    lines: [[
        widget('model', 'model', 'cyan'),
        widget('context', 'context-remaining', 'brightBlack'),
        widget('branch', 'git-branch', 'magenta'),
        widget('changes', 'git-changes', 'yellow')
    ]]
});
