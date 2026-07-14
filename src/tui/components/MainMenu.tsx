import {
    Box,
    Text
} from 'ink';
import type { ReactElement } from 'react';

import type { CopilotIntegrationStatus } from '../../utils/copilot-settings';

import {
    List,
    type ListEntry
} from './List';

export type MainMenuOption = 'lines'
    | 'colors'
    | 'powerline'
    | 'terminal'
    | 'overrides'
    | 'installation'
    | 'save'
    | 'exit'
    | 'github';

interface MainMenuProps {
    integration: CopilotIntegrationStatus | null;
    hasChanges: boolean;
    initialSelection?: number;
    onSelect: (option: MainMenuOption, index: number) => void;
}

function installationItem(integration: CopilotIntegrationStatus | null): ListEntry<MainMenuOption> {
    if (integration?.installed === true) {
        return {
            label: '🧰 Manage Installation',
            value: 'installation',
            description: 'Repair, change, or remove the Copilot CLI status line command'
        };
    }

    return {
        label: '📦 Install to Copilot CLI',
        value: 'installation',
        description: 'Add copilotstatusline to the user-level Copilot CLI settings'
    };
}

function menuItems(
    integration: CopilotIntegrationStatus | null,
    hasChanges: boolean
): (ListEntry<MainMenuOption> | '-')[] {
    return [
        {
            label: '📝 Edit Lines',
            value: 'lines',
            description: 'Configure any number of status lines and choose which widgets appear in each line'
        },
        {
            label: '🎨 Edit Colors',
            value: 'colors',
            description: 'Customize each widget foreground, background, and bold styling'
        },
        {
            label: '⚡ Powerline Setup',
            value: 'powerline',
            description: 'Enable Powerline rendering and configure its separator character'
        },
        '-',
        {
            label: '💻 Terminal Options',
            value: 'terminal',
            description: 'Configure the terminal color level used by the formatter'
        },
        {
            label: '🌐 Global Overrides',
            value: 'overrides',
            description: 'Set the default separator applied between widgets'
        },
        '-',
        installationItem(integration),
        '-',
        hasChanges
            ? {
                label: '💾 Save & Exit',
                value: 'save',
                description: 'Save all changes and exit the configuration tool'
            }
            : {
                label: '🚪 Exit',
                value: 'exit',
                description: 'Exit the configuration tool'
            },
        ...(hasChanges
            ? [{
                label: '❌ Exit without saving',
                value: 'exit' as const,
                description: 'Discard changes made during this session'
            }]
            : []),
        '-',
        {
            label: '⭐ Like copilotstatusline? Star us on GitHub',
            value: 'github',
            description: 'Open the copilotstatusline GitHub repository in your browser'
        }
    ];
}

export function MainMenu({
    integration,
    hasChanges,
    initialSelection = 0,
    onSelect
}: MainMenuProps): ReactElement {
    return (
        <Box flexDirection='column'>
            <Text bold>Main Menu</Text>
            <Text dimColor>↑↓ or j/k to select, Enter to open</Text>
            <List
                items={menuItems(integration, hasChanges)}
                marginTop={1}
                initialSelection={initialSelection}
                onSelect={(value, index) => {
                    if (value !== 'back') {
                        onSelect(value, index);
                    }
                }}
            />
        </Box>
    );
}
