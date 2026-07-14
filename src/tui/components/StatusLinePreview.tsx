import {
    Box,
    Text
} from 'ink';
import {
    useMemo,
    type ReactElement
} from 'react';

import type { Settings } from '../../types/Settings';
import type { NormalizedCopilotStatus } from '../../types/copilot-status';
import { renderStatusLines } from '../../utils/renderer';

interface StatusLinePreviewProps {
    settings: Settings;
    terminalWidth: number;
}

const PREVIEW_STATUS: NormalizedCopilotStatus = {
    sessionId: 'a196c973',
    sessionName: 'copilotstatusline',
    cwd: process.cwd(),
    version: '1.0.71',
    modelId: 'gpt-5.4',
    modelName: 'GPT-5.4',
    reasoningEffort: 'high',
    allowAll: false,
    context: {
        inputTokens: 698_833,
        outputTokens: 5_726,
        cacheReadTokens: 582_656,
        cacheWriteTokens: 0,
        reasoningTokens: 2_880,
        totalTokens: 704_559,
        lastCallInputTokens: 34_890,
        lastCallOutputTokens: 1_320,
        currentTokens: 56_320,
        limitTokens: 200_000,
        usedPercentage: 28.16
    },
    cost: {
        apiDurationMs: 15_420,
        durationMs: 48_210,
        premiumRequests: 2,
        linesAdded: 84,
        linesRemoved: 17
    }
};

export function StatusLinePreview({ settings, terminalWidth }: StatusLinePreviewProps): ReactElement {
    const renderedLines = useMemo(() => renderStatusLines(
        PREVIEW_STATUS,
        settings,
        { terminalWidth: Math.max(1, terminalWidth - 2) }
    ), [settings, terminalWidth]);

    return (
        <Box flexDirection='column'>
            <Box
                borderStyle='round'
                borderColor='gray'
                borderDimColor
                width='100%'
                paddingLeft={1}
            >
                <Text>
                    &gt;
                    <Text dimColor> Preview  (ctrl+s to save configuration at any time)</Text>
                </Text>
            </Box>
            {renderedLines.length === 0
                ? <Text dimColor>  (empty status line)</Text>
                : renderedLines.map((line, index) => (
                    <Text key={index} wrap='truncate'>
                        {'  '}
                        {line}
                    </Text>
                ))}
        </Box>
    );
}
