import {
    describe,
    expect,
    it
} from 'vitest';

import { getVerticalNavigationDirection } from './vertical-navigation';

function key(overrides: Partial<Parameters<typeof getVerticalNavigationDirection>[1]> = {}) {
    return {
        ctrl: false,
        downArrow: false,
        meta: false,
        upArrow: false,
        ...overrides
    };
}

describe('getVerticalNavigationDirection', () => {
    it('maps Vim-style j and k keys to down and up', () => {
        expect(getVerticalNavigationDirection('j', key())).toBe(1);
        expect(getVerticalNavigationDirection('k', key())).toBe(-1);
    });

    it('preserves arrow-key navigation', () => {
        expect(getVerticalNavigationDirection('', key({ downArrow: true }))).toBe(1);
        expect(getVerticalNavigationDirection('', key({ upArrow: true }))).toBe(-1);
    });

    it('ignores modified and unrelated text input', () => {
        expect(getVerticalNavigationDirection('j', key({ ctrl: true }))).toBeNull();
        expect(getVerticalNavigationDirection('k', key({ meta: true }))).toBeNull();
        expect(getVerticalNavigationDirection('J', key())).toBeNull();
        expect(getVerticalNavigationDirection('x', key())).toBeNull();
    });
});
