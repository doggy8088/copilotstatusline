import {
    describe,
    expect,
    it
} from 'vitest';

import {
    HELP_TEXT,
    takeFlag
} from './cli-options';

describe('CLI options', () => {
    it.each(['-h', '--help'])('recognizes the %s help flag', (flag) => {
        const args = ['node', 'copilotstatusline', flag];

        expect(takeFlag(args, '-h', '--help')).toBe(true);
        expect(args).toEqual(['node', 'copilotstatusline']);
    });

    it.each(['-v', '--version'])('recognizes the %s version flag', (flag) => {
        const args = ['node', 'copilotstatusline', flag];

        expect(takeFlag(args, '-v', '--version')).toBe(true);
        expect(args).toEqual(['node', 'copilotstatusline']);
    });

    it('documents every supported command option', () => {
        expect(HELP_TEXT).toContain('-h, --help');
        expect(HELP_TEXT).toContain('-v, --version');
        expect(HELP_TEXT).toContain('--config <path>');
        expect(HELP_TEXT).toContain('--check');
        expect(HELP_TEXT).toContain('--install [mode]');
        expect(HELP_TEXT).toContain('--uninstall');
    });
});
