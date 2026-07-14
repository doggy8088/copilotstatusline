import sliceAnsi from 'slice-ansi';

import type {
    ColorName,
    Settings,
    WidgetConfig
} from '../types/Settings';
import type { NormalizedCopilotStatus } from '../types/copilot-status';
import { renderWidget } from '../widgets/catalog';

import {
    powerlineArrow,
    styleText
} from './ansi';
import { visibleWidth } from './format';

const FLEX = '__COPILOTSTATUSLINE_FLEX__';
const POWERLINE_BACKGROUNDS: ColorName[] = [
    'blue',
    'magenta',
    'cyan',
    'green',
    'yellow'
];

export interface RenderOptions { terminalWidth?: number }

function terminalWidth(override?: number): number {
    if (override !== undefined && override > 0) {
        return override;
    }

    const fromEnvironment = Number(process.env.COLUMNS);

    if (Number.isFinite(fromEnvironment) && fromEnvironment > 0) {
        return fromEnvironment;
    }

    return process.stdout.columns > 0 ? process.stdout.columns : 120;
}

function truncate(value: string, width: number): string {
    if (width <= 0) {
        return '';
    }

    if (visibleWidth(value) <= width) {
        return value;
    }

    if (width === 1) {
        return '…';
    }

    const reset = value.includes('\u001B[') ? '\u001B[0m' : '';
    return `${sliceAnsi(value, 0, width - 1)}…${reset}`;
}

function renderStandardLine(
    widgets: WidgetConfig[],
    settings: Settings,
    status: NormalizedCopilotStatus,
    width: number
): string {
    const parts = widgets.flatMap((widget) => {
        const value = renderWidget(widget, {
            status,
            terminalWidth: width,
            gitCacheTtlSeconds: settings.gitCacheTtlSeconds
        });

        if (value === null) {
            return [];
        }

        return [{
            widget,
            value: value === FLEX
                ? FLEX
                : styleText(
                    value,
                    widget.color,
                    widget.backgroundColor,
                    widget.bold,
                    settings.colorLevel
                )
        }];
    });

    let output = '';

    for (const [index, part] of parts.entries()) {
        const previous = parts[index - 1];
        const needsSeparator = index > 0
            && part.value !== FLEX
            && previous?.value !== FLEX
            && !part.widget.merge;

        if (needsSeparator) {
            output += settings.defaultSeparator;
        }

        output += part.value;
    }

    if (output.includes(FLEX)) {
        const fixedWidth = visibleWidth(output.replaceAll(FLEX, ''));
        const flexCount = output.split(FLEX).length - 1;
        const available = Math.max(1, width - fixedWidth);
        const each = Math.floor(available / flexCount);
        let remainder = available % flexCount;

        output = output.replaceAll(FLEX, () => {
            const spaces = each + (remainder > 0 ? 1 : 0);
            remainder = Math.max(0, remainder - 1);
            return ' '.repeat(spaces);
        });
    }

    return truncate(output, width);
}

function renderPowerlineLine(
    widgets: WidgetConfig[],
    settings: Settings,
    status: NormalizedCopilotStatus,
    width: number
): string {
    const rendered: { background: ColorName; value: string }[] = widgets.flatMap((widget, index) => {
        const value = renderWidget(widget, {
            status,
            terminalWidth: width,
            gitCacheTtlSeconds: settings.gitCacheTtlSeconds
        });

        if (value === null) {
            return [];
        }

        if (value === FLEX) {
            return [{ value, background: 'none' as const }];
        }

        const background = widget.backgroundColor === 'none'
            ? POWERLINE_BACKGROUNDS[index % POWERLINE_BACKGROUNDS.length] ?? 'blue'
            : widget.backgroundColor;
        const foreground: ColorName = background === 'yellow' || background === 'brightYellow'
            ? 'black'
            : 'brightWhite';

        return [{
            value: styleText(` ${value} `, foreground, background, widget.bold, settings.colorLevel),
            background
        }];
    });
    let output = '';

    for (const [index, part] of rendered.entries()) {
        if (part.value === FLEX) {
            output += FLEX;
            continue;
        }

        output += part.value;
        const next = rendered[index + 1];
        const nextBackground = next?.value === FLEX ? 'none' : next?.background ?? 'none';
        output += powerlineArrow(
            settings.powerline.separator,
            part.background,
            nextBackground,
            settings.colorLevel
        );
    }

    if (output.includes(FLEX)) {
        const available = Math.max(1, width - visibleWidth(output.replaceAll(FLEX, '')));
        output = output.replaceAll(FLEX, ' '.repeat(available));
    }

    return truncate(output, width);
}

export function renderStatusLines(
    status: NormalizedCopilotStatus,
    settings: Settings,
    options: RenderOptions = {}
): string[] {
    const width = terminalWidth(options.terminalWidth);

    return settings.lines.flatMap((line) => {
        const rendered = settings.powerline.enabled
            ? renderPowerlineLine(line, settings, status, width)
            : renderStandardLine(line, settings, status, width);
        return visibleWidth(rendered) === 0 ? [] : [rendered];
    });
}
