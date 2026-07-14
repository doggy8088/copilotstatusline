import {
    execFileSync,
    execSync
} from 'node:child_process';
import * as os from 'node:os';

import type {
    ColorName,
    WidgetConfig,
    WidgetType
} from '../types/Settings';
import type { NormalizedCopilotStatus } from '../types/copilot-status';
import {
    formatDuration,
    formatPercentage,
    formatTokens
} from '../utils/format';

export interface WidgetCatalogEntry {
    type: WidgetType;
    name: string;
    description: string;
    defaultColor: ColorName;
}

export interface WidgetRenderContext {
    status: NormalizedCopilotStatus;
    terminalWidth: number;
    gitCacheTtlSeconds: number;
}

export const WIDGET_CATALOG: readonly WidgetCatalogEntry[] = [
    { type: 'model', name: 'Model', description: '目前模型顯示名稱', defaultColor: 'cyan' },
    { type: 'model-id', name: 'Model ID', description: '目前模型識別碼', defaultColor: 'cyan' },
    { type: 'reasoning', name: 'Reasoning', description: '推理強度', defaultColor: 'brightCyan' },
    { type: 'copilot-version', name: 'Copilot Version', description: 'Copilot CLI 版本', defaultColor: 'brightBlack' },
    { type: 'session-id', name: 'Session ID', description: '目前 session ID', defaultColor: 'brightBlack' },
    { type: 'session-name', name: 'Session Name', description: '目前 session 名稱', defaultColor: 'brightBlue' },
    { type: 'cwd', name: 'Current Directory', description: '目前工作目錄', defaultColor: 'blue' },
    { type: 'input-tokens', name: 'Input Tokens', description: '累計 input tokens', defaultColor: 'green' },
    { type: 'output-tokens', name: 'Output Tokens', description: '累計 output tokens', defaultColor: 'yellow' },
    { type: 'cache-read-tokens', name: 'Cache Read', description: '累計 cache read tokens', defaultColor: 'brightGreen' },
    { type: 'cache-write-tokens', name: 'Cache Write', description: '累計 cache write tokens', defaultColor: 'brightYellow' },
    { type: 'reasoning-tokens', name: 'Reasoning Tokens', description: '累計 reasoning tokens', defaultColor: 'brightMagenta' },
    { type: 'total-tokens', name: 'Total Tokens', description: '累計總 tokens', defaultColor: 'white' },
    { type: 'last-call-input', name: 'Last Call Input', description: '上一次 API call input tokens', defaultColor: 'green' },
    { type: 'last-call-output', name: 'Last Call Output', description: '上一次 API call output tokens', defaultColor: 'yellow' },
    { type: 'current-context', name: 'Current Context', description: '目前 context tokens', defaultColor: 'blue' },
    { type: 'context-limit', name: 'Context Limit', description: '目前顯示的 context 上限', defaultColor: 'brightBlue' },
    { type: 'context-used', name: 'Context Used', description: 'context 使用百分比', defaultColor: 'yellow' },
    { type: 'context-remaining', name: 'Context Remaining', description: 'context 剩餘百分比', defaultColor: 'brightBlack' },
    { type: 'premium-requests', name: 'Premium Requests', description: '累計 premium requests', defaultColor: 'magenta' },
    { type: 'api-duration', name: 'API Duration', description: '累計 API 時間', defaultColor: 'brightBlack' },
    { type: 'session-duration', name: 'Session Duration', description: '累計 session 時間', defaultColor: 'brightBlack' },
    { type: 'lines-added', name: 'Lines Added', description: '本 session 新增行數', defaultColor: 'green' },
    { type: 'lines-removed', name: 'Lines Removed', description: '本 session 刪除行數', defaultColor: 'red' },
    { type: 'allow-all', name: 'Allow All', description: 'Allow-all／YOLO 狀態', defaultColor: 'brightRed' },
    { type: 'git-branch', name: 'Git Branch', description: '目前 Git branch', defaultColor: 'magenta' },
    { type: 'git-changes', name: 'Git Changes', description: 'Git staged／unstaged／untracked 數量', defaultColor: 'yellow' },
    { type: 'jj-change', name: 'Jujutsu Change', description: '目前 jj change ID', defaultColor: 'magenta' },
    { type: 'terminal-width', name: 'Terminal Width', description: '目前終端寬度', defaultColor: 'brightBlack' },
    { type: 'memory', name: 'Free Memory', description: '系統可用記憶體', defaultColor: 'brightBlack' },
    { type: 'custom-text', name: 'Custom Text', description: '使用者自訂文字', defaultColor: 'white' },
    { type: 'custom-command', name: 'Custom Command', description: '執行使用者設定的 shell command', defaultColor: 'white' },
    { type: 'separator', name: 'Separator', description: '明確分隔字元', defaultColor: 'brightBlack' },
    { type: 'flex', name: 'Flex', description: '填滿剩餘寬度', defaultColor: 'none' }
];

const cache = new Map<string, { expiresAt: number; value: string | null }>();

function cachedCommand(
    key: string,
    ttlSeconds: number,
    command: () => string | null
): string | null {
    const cached = cache.get(key);

    if (cached !== undefined && cached.expiresAt >= Date.now()) {
        return cached.value;
    }

    const value = command();
    cache.set(key, { expiresAt: Date.now() + ttlSeconds * 1_000, value });
    return value;
}

function runFile(command: string, args: string[], cwd: string | undefined): string | null {
    try {
        const output = execFileSync(command, args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 250,
            windowsHide: true
        }).trim();
        return output === '' ? null : output;
    } catch {
        return null;
    }
}

function renderValue(config: WidgetConfig, label: string, value: string): string {
    const body = config.raw || label === '' ? value : `${label}: ${value}`;
    return `${config.prefix}${body}${config.suffix}`;
}

function numericValue(
    config: WidgetConfig,
    label: string,
    value: number,
    formatter: (input: number) => string = formatTokens
): string | null {
    if (config.hideWhenZero && value === 0) {
        return null;
    }

    return renderValue(config, label, formatter(value));
}

function contextUsed(status: NormalizedCopilotStatus): number | null {
    if (status.context.usedPercentage !== undefined) {
        return status.context.usedPercentage;
    }

    if (status.context.limitTokens <= 0) {
        return null;
    }

    return status.context.currentTokens / status.context.limitTokens * 100;
}

function gitChanges(cwd: string | undefined, ttl: number): string | null {
    return cachedCommand(`git-changes:${cwd ?? ''}`, ttl, () => {
        const output = runFile('git', ['--no-optional-locks', 'status', '--porcelain'], cwd);

        if (output === null) {
            return null;
        }

        let staged = 0;
        let unstaged = 0;
        let untracked = 0;

        for (const line of output.split('\n')) {
            if (line.startsWith('??')) {
                untracked += 1;
                continue;
            }

            if (!line.startsWith(' ')) {
                staged += 1;
            }

            if (line[1] !== ' ') {
                unstaged += 1;
            }
        }

        return `+${staged} ~${unstaged} ?${untracked}`;
    });
}

export function renderWidget(config: WidgetConfig, context: WidgetRenderContext): string | null {
    const status = context.status;
    const tokenValues: Partial<Record<WidgetType, [string, number]>> = {
        'input-tokens': ['In', status.context.inputTokens],
        'output-tokens': ['Out', status.context.outputTokens],
        'cache-read-tokens': ['Cache read', status.context.cacheReadTokens],
        'cache-write-tokens': ['Cache write', status.context.cacheWriteTokens],
        'reasoning-tokens': ['Reasoning', status.context.reasoningTokens],
        'total-tokens': ['Tokens', status.context.totalTokens],
        'last-call-input': ['Last in', status.context.lastCallInputTokens],
        'last-call-output': ['Last out', status.context.lastCallOutputTokens],
        'current-context': ['Context', status.context.currentTokens],
        'context-limit': ['Limit', status.context.limitTokens]
    };
    const tokenValue = tokenValues[config.type];

    if (tokenValue !== undefined) {
        return numericValue(config, tokenValue[0], tokenValue[1]);
    }

    switch (config.type) {
        case 'model':
            return status.modelName === undefined ? null : renderValue(config, 'Model', status.modelName);
        case 'model-id':
            return status.modelId === undefined ? null : renderValue(config, 'Model', status.modelId);
        case 'reasoning':
            return status.reasoningEffort === undefined
                ? null
                : renderValue(config, 'Effort', status.reasoningEffort);
        case 'copilot-version':
            return status.version === undefined ? null : renderValue(config, 'Copilot', status.version);
        case 'session-id':
            return status.sessionId === undefined ? null : renderValue(config, 'Session', status.sessionId);
        case 'session-name':
            return status.sessionName === undefined ? null : renderValue(config, 'Session', status.sessionName);
        case 'cwd':
            return status.cwd === undefined ? null : renderValue(config, '', status.cwd);
        case 'context-used': {
            const used = contextUsed(status);
            return used === null ? null : renderValue(config, 'Context', `${formatPercentage(used)} used`);
        }
        case 'context-remaining': {
            const used = contextUsed(status);
            return used === null ? null : renderValue(config, 'Context', `${formatPercentage(100 - used)} left`);
        }
        case 'premium-requests':
            return numericValue(config, 'Premium', status.cost.premiumRequests, value => String(value));
        case 'api-duration':
            return numericValue(config, 'API', status.cost.apiDurationMs, formatDuration);
        case 'session-duration':
            return numericValue(config, 'Time', status.cost.durationMs, formatDuration);
        case 'lines-added':
            return numericValue(config, '+', status.cost.linesAdded, value => String(value));
        case 'lines-removed':
            return numericValue(config, '-', status.cost.linesRemoved, value => String(value));
        case 'allow-all':
            return status.allowAll === true ? renderValue(config, '', 'YOLO') : null;
        case 'git-branch': {
            const branch = cachedCommand(`git-branch:${status.cwd ?? ''}`, context.gitCacheTtlSeconds, () => runFile('git', ['--no-optional-locks', 'branch', '--show-current'], status.cwd));
            return branch === null ? null : renderValue(config, '', branch);
        }
        case 'git-changes': {
            const changes = gitChanges(status.cwd, context.gitCacheTtlSeconds);
            return changes === null ? null : renderValue(config, '', changes);
        }
        case 'jj-change': {
            const change = cachedCommand(`jj-change:${status.cwd ?? ''}`, context.gitCacheTtlSeconds, () => runFile('jj', ['log', '-r', '@', '--no-graph', '-T', 'change_id.shortest(8)'], status.cwd));
            return change === null ? null : renderValue(config, '', change);
        }
        case 'terminal-width':
            return renderValue(config, 'Width', String(context.terminalWidth));
        case 'memory':
            return renderValue(config, 'Free', `${(os.freemem() / 1_073_741_824).toFixed(1)} GB`);
        case 'custom-text':
            return config.value === undefined ? null : renderValue(config, '', config.value);
        case 'custom-command':
            if (config.command === undefined || config.command.trim() === '') {
                return null;
            }

            try {
                const output = execSync(config.command, {
                    cwd: status.cwd,
                    encoding: 'utf8',
                    stdio: ['ignore', 'pipe', 'ignore'],
                    timeout: 500,
                    windowsHide: true
                }).trim();
                return output === '' ? null : renderValue(config, '', output.split('\n')[0] ?? '');
            } catch {
                return null;
            }
        case 'separator':
            return config.value ?? '|';
        case 'flex':
            return '__COPILOTSTATUSLINE_FLEX__';
        default:
            return null;
    }
}
