export interface EditorModifierKey {
    ctrl: boolean;
    escape: boolean;
    meta: boolean;
}

export type EditorGlobalKeyAction = 'back' | 'continue' | 'ignore';

export function getEditorGlobalKeyAction(key: EditorModifierKey): EditorGlobalKeyAction {
    if (key.escape) {
        return 'back';
    }

    if (key.ctrl || key.meta) {
        return 'ignore';
    }

    return 'continue';
}
