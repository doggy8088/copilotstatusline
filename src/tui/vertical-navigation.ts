export interface VerticalNavigationKey {
    ctrl: boolean;
    downArrow: boolean;
    meta: boolean;
    upArrow: boolean;
}

export type VerticalNavigationDirection = -1 | 1;

export function getVerticalNavigationDirection(
    input: string,
    key: VerticalNavigationKey
): VerticalNavigationDirection | null {
    if (key.upArrow) {
        return -1;
    }

    if (key.downArrow) {
        return 1;
    }

    if (key.ctrl || key.meta) {
        return null;
    }

    if (input === 'k') {
        return -1;
    }

    if (input === 'j') {
        return 1;
    }

    return null;
}
