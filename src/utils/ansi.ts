import type { ColorName } from '../types/Settings';

const foregroundCodes: Record<ColorName, number | null> = {
    none: null,
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
    brightBlack: 90,
    brightRed: 91,
    brightGreen: 92,
    brightYellow: 93,
    brightBlue: 94,
    brightMagenta: 95,
    brightCyan: 96,
    brightWhite: 97
};

const backgroundCodes: Record<ColorName, number | null> = {
    none: null,
    black: 40,
    red: 41,
    green: 42,
    yellow: 43,
    blue: 44,
    magenta: 45,
    cyan: 46,
    white: 47,
    brightBlack: 100,
    brightRed: 101,
    brightGreen: 102,
    brightYellow: 103,
    brightBlue: 104,
    brightMagenta: 105,
    brightCyan: 106,
    brightWhite: 107
};

export function styleText(
    value: string,
    foreground: ColorName,
    background: ColorName = 'none',
    bold = false,
    colorLevel = 2
): string {
    if (colorLevel === 0 || value === '') {
        return value;
    }

    const codes: number[] = [];

    if (bold) {
        codes.push(1);
    }

    const foregroundCode = foregroundCodes[foreground];
    const backgroundCode = backgroundCodes[background];

    if (foregroundCode !== null) {
        codes.push(foregroundCode);
    }

    if (backgroundCode !== null) {
        codes.push(backgroundCode);
    }

    return codes.length === 0 ? value : `\u001B[${codes.join(';')}m${value}\u001B[0m`;
}

export function powerlineArrow(
    value: string,
    foreground: ColorName,
    background: ColorName,
    colorLevel: number
): string {
    if (colorLevel === 0 || value === '') {
        return value;
    }

    if (background === 'none') {
        const foregroundCode = foregroundCodes[foreground];
        const codes = foregroundCode === null
            ? [49]
            : [foregroundCode, 49];

        return `\u001B[${codes.join(';')}m${value}\u001B[0m`;
    }

    return styleText(value, foreground, background, false, colorLevel);
}
