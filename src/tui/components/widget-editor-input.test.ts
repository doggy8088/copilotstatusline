import {
    describe,
    expect,
    it
} from 'vitest';

import { getEditorGlobalKeyAction } from './widget-editor-input';

describe('getEditorGlobalKeyAction', () => {
    it('prioritizes Escape even though Ink also marks it as Meta', () => {
        expect(getEditorGlobalKeyAction({
            ctrl: false,
            escape: true,
            meta: true
        })).toBe('back');
    });

    it('ignores non-Escape modifier shortcuts', () => {
        expect(getEditorGlobalKeyAction({
            ctrl: true,
            escape: false,
            meta: false
        })).toBe('ignore');
    });

    it('continues handling ordinary editor input', () => {
        expect(getEditorGlobalKeyAction({
            ctrl: false,
            escape: false,
            meta: false
        })).toBe('continue');
    });
});
