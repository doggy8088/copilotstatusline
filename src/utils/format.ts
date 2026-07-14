import stringWidth from 'string-width';
import stripAnsi from 'strip-ansi';

export function formatTokens(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
        return '0';
    }

    if (value >= 999_500) {
        const millions = value / 1_000_000;
        return `${millions >= 10 ? millions.toFixed(1) : millions.toFixed(2)}m`;
    }

    if (value >= 1_000) {
        const thousands = value / 1_000;
        return `${thousands >= 10 ? thousands.toFixed(1) : thousands.toFixed(2)}k`;
    }

    return Math.round(value).toString();
}

export function formatDuration(milliseconds: number): string {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
        return '0s';
    }

    const totalSeconds = Math.floor(milliseconds / 1_000);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor((totalSeconds % 3_600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }

    return `${seconds}s`;
}

export function formatPercentage(value: number): string {
    return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

export function visibleWidth(value: string): number {
    return stringWidth(stripAnsi(value));
}
