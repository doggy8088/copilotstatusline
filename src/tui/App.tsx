import {
    Box,
    Text,
    useApp,
    useInput
} from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { randomUUID } from 'node:crypto';
import React, {
    useCallback,
    useState,
    type ReactElement
} from 'react';

import type {
    ColorName,
    Settings,
    WidgetConfig,
    WidgetType
} from '../types/Settings';
import {
    COLORS,
    WidgetConfigSchema
} from '../types/Settings';
import {
    getSettingsLoadError,
    getSettingsPath,
    isSettingsPathCustom,
    saveSettings
} from '../utils/app-settings';
import {
    inspectCopilotIntegration,
    installCopilotStatusLine,
    uninstallCopilotStatusLine,
    type CopilotIntegrationStatus,
    type InstallCommandMode
} from '../utils/copilot-settings';
import { WIDGET_CATALOG } from '../widgets/catalog';

interface AppProps {
    settings: Settings;
    integration: CopilotIntegrationStatus | null;
}

type Screen = 'menu' | 'editor' | 'install';
type EditableField = 'command' | 'prefix' | 'suffix' | 'value';

const MENU_ITEMS = [
    { label: 'Edit status lines', value: 'edit' },
    { label: 'Toggle Powerline', value: 'powerline' },
    { label: 'Install or repair Copilot integration', value: 'install' },
    { label: 'Uninstall Copilot integration', value: 'uninstall' },
    { label: 'Save and exit', value: 'save' },
    { label: 'Exit without saving', value: 'exit' }
];

const INSTALL_ITEMS: { label: string; value: InstallCommandMode | 'back' }[] = [
    { label: 'npx -y @willh/copilotstatusline@latest', value: 'npm' },
    { label: 'bunx -y @willh/copilotstatusline@latest', value: 'bunx' },
    { label: 'Global copilotstatusline binary', value: 'global' },
    { label: 'Back', value: 'back' }
];

function cycleColor(color: ColorName): ColorName {
    const index = COLORS.indexOf(color);
    return COLORS[(index + 1) % COLORS.length] ?? 'none';
}

function primaryEditableField(widget: WidgetConfig | undefined): EditableField | null {
    if (widget?.type === 'custom-command') {
        return 'command';
    }

    if (widget?.type === 'custom-text' || widget?.type === 'separator') {
        return 'value';
    }

    return null;
}

function Header({ integration }: { integration: CopilotIntegrationStatus | null }): ReactElement {
    const status = integration === null
        ? 'Copilot settings unavailable'
        : integration.installed
            ? `${integration.visible ? 'Installed' : 'Installed · custom footer hidden'} · Copilot ${integration.version ?? 'unknown'}`
            : 'Not installed';

    return (
        <Box flexDirection='column' marginBottom={1}>
            <Text bold color='cyan'>copilotstatusline</Text>
            <Text dimColor>{status}</Text>
        </Box>
    );
}

interface WidgetEditorProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
    onBack: () => void;
}

function WidgetEditor({ settings, onChange, onBack }: WidgetEditorProps): ReactElement {
    const [lineIndex, setLineIndex] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [adding, setAdding] = useState(false);
    const [editingField, setEditingField] = useState<EditableField | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const currentLine = settings.lines[lineIndex] ?? [];
    const selectedWidget = currentLine[selectedIndex];

    const updateSelected = useCallback((update: (widget: WidgetConfig) => WidgetConfig) => {
        if (selectedWidget === undefined) {
            return;
        }

        const lines = settings.lines.map((line, index) => index === lineIndex
            ? line.map((widget, widgetIndex) => widgetIndex === selectedIndex ? update(widget) : widget)
            : line);
        onChange({ ...settings, lines });
    }, [lineIndex, onChange, selectedIndex, selectedWidget, settings]);

    const startEditing = useCallback((field: EditableField) => {
        if (selectedWidget === undefined) {
            return;
        }

        setEditingField(field);
        setEditingValue(selectedWidget[field] ?? '');
    }, [selectedWidget]);

    const finishEditing = useCallback((value: string) => {
        if (editingField !== null) {
            updateSelected(widget => ({ ...widget, [editingField]: value }));
        }

        setEditingField(null);
        setEditingValue('');
    }, [editingField, updateSelected]);

    useInput((input, key) => {
        if (adding) {
            if (key.escape) {
                setAdding(false);
            }

            return;
        }

        if (editingField !== null) {
            if (key.escape) {
                setEditingField(null);
                setEditingValue('');
            }

            return;
        }

        if (key.escape) {
            onBack();
        } else if (key.upArrow) {
            setSelectedIndex(value => Math.max(0, value - 1));
        } else if (key.downArrow) {
            setSelectedIndex(value => Math.min(Math.max(0, currentLine.length - 1), value + 1));
        } else if (key.tab) {
            setLineIndex(value => (value + 1) % settings.lines.length);
            setSelectedIndex(0);
        } else if (input === 'a') {
            setAdding(true);
        } else if (input === 'n') {
            onChange({ ...settings, lines: [...settings.lines, []] });
            setLineIndex(settings.lines.length);
            setSelectedIndex(0);
        } else if (input === 'd' && settings.lines.length > 1) {
            const lines = settings.lines.filter((_, index) => index !== lineIndex);
            onChange({ ...settings, lines });
            setLineIndex(value => Math.max(0, Math.min(value, lines.length - 1)));
            setSelectedIndex(0);
        } else if (input === 'x' && currentLine[selectedIndex] !== undefined) {
            const lines = settings.lines.map((line, index) => index === lineIndex
                ? line.filter((_, widgetIndex) => widgetIndex !== selectedIndex)
                : line);
            onChange({ ...settings, lines });
            setSelectedIndex(value => Math.max(0, value - 1));
        } else if ((input === '[' || input === ']') && currentLine[selectedIndex] !== undefined) {
            const offset = input === '[' ? -1 : 1;
            const target = Math.max(0, Math.min(currentLine.length - 1, selectedIndex + offset));

            if (target !== selectedIndex) {
                const reordered = [...currentLine];
                const [item] = reordered.splice(selectedIndex, 1);

                if (item !== undefined) {
                    reordered.splice(target, 0, item);
                }

                const lines = settings.lines.map((line, index) => index === lineIndex ? reordered : line);
                onChange({ ...settings, lines });
                setSelectedIndex(target);
            }
        } else if (input === 'c' && currentLine[selectedIndex] !== undefined) {
            updateSelected(widget => ({ ...widget, color: cycleColor(widget.color) }));
        } else if (input === 'g' && currentLine[selectedIndex] !== undefined) {
            updateSelected(widget => ({
                ...widget,
                backgroundColor: cycleColor(widget.backgroundColor)
            }));
        } else if (input === 'b' && currentLine[selectedIndex] !== undefined) {
            updateSelected(widget => ({ ...widget, bold: !widget.bold }));
        } else if (input === 'r' && currentLine[selectedIndex] !== undefined) {
            updateSelected(widget => ({ ...widget, raw: !widget.raw }));
        } else if (input === 'm' && currentLine[selectedIndex] !== undefined) {
            updateSelected(widget => ({ ...widget, merge: !widget.merge }));
        } else if (input === 'z' && currentLine[selectedIndex] !== undefined) {
            updateSelected(widget => ({ ...widget, hideWhenZero: !widget.hideWhenZero }));
        } else if (input === 'e') {
            const field = primaryEditableField(selectedWidget);

            if (field !== null) {
                startEditing(field);
            }
        } else if (input === 'p') {
            startEditing('prefix');
        } else if (input === 's') {
            startEditing('suffix');
        }
    });

    const addWidget = useCallback((type: WidgetType) => {
        const catalog = WIDGET_CATALOG.find(entry => entry.type === type);
        const extra: Partial<WidgetConfig> = type === 'custom-text'
            ? { value: 'text' }
            : type === 'custom-command'
                ? { command: 'printf ok' }
                : type === 'separator'
                    ? { value: '|' }
                    : {};
        const created = WidgetConfigSchema.parse({
            id: randomUUID(),
            type,
            color: catalog?.defaultColor ?? 'none',
            ...extra
        });
        const lines = settings.lines.map((line, index) => index === lineIndex
            ? [...line, created]
            : line);
        onChange({ ...settings, lines });
        setSelectedIndex(currentLine.length);
        setAdding(false);
    }, [currentLine.length, lineIndex, onChange, settings]);

    if (adding) {
        return (
            <Box flexDirection='column'>
                <Text bold>Add widget</Text>
                <SelectInput
                    items={WIDGET_CATALOG.map(entry => ({
                        label: `${entry.name} — ${entry.description}`,
                        value: entry.type
                    }))}
                    onSelect={(item) => { addWidget(item.value); }}
                />
                <Text dimColor>Esc cancels.</Text>
            </Box>
        );
    }

    if (editingField !== null) {
        return (
            <Box flexDirection='column'>
                <Text bold>
                    Edit
                    {editingField}
                </Text>
                <TextInput
                    value={editingValue}
                    onChange={setEditingValue}
                    onSubmit={finishEditing}
                />
                <Text dimColor>Enter applies · Esc cancels</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>
                Line
                {lineIndex + 1}
                {' '}
                of
                {settings.lines.length}
            </Text>
            {currentLine.length === 0
                ? <Text dimColor>Empty line</Text>
                : currentLine.map((widget, index) => (
                    <Text key={widget.id}>
                        {index === selectedIndex ? '❯ ' : '  '}
                        {widget.type}
                        {' '}
                        <Text dimColor>
                            {widget.color}
                            {widget.bold ? ' bold' : ''}
                            {widget.raw ? ' raw' : ''}
                            {widget.merge ? ' merged' : ''}
                            {widget.hideWhenZero ? ' hide-zero' : ''}
                        </Text>
                    </Text>
                ))}
            <Box marginTop={1} flexDirection='column'>
                <Text dimColor>↑↓ select · Tab next line · a add · x remove · [ ] move</Text>
                <Text dimColor>c fg · g bg · b bold · r raw · m merge · z hide zero</Text>
                <Text dimColor>e value/command · p prefix · s suffix · n new · d delete · Esc back</Text>
            </Box>
        </Box>
    );
}

export function App({ settings: initialSettings, integration: initialIntegration }: AppProps): ReactElement {
    const { exit } = useApp();
    const [settings, setSettings] = useState(initialSettings);
    const [integration, setIntegration] = useState(initialIntegration);
    const [screen, setScreen] = useState<Screen>('menu');
    const [message, setMessage] = useState<string | null>(getSettingsLoadError());
    const [busy, setBusy] = useState(false);

    const refreshIntegration = useCallback(async () => {
        setIntegration(await inspectCopilotIntegration());
    }, []);

    const handleMenu = useCallback(async (value: string) => {
        if (value === 'edit') {
            setScreen('editor');
            return;
        }

        if (value === 'powerline') {
            setSettings(current => ({
                ...current,
                powerline: { ...current.powerline, enabled: !current.powerline.enabled }
            }));
            setMessage(`Powerline ${settings.powerline.enabled ? 'disabled' : 'enabled'}`);
            return;
        }

        if (value === 'install') {
            setScreen('install');
            return;
        }

        if (value === 'uninstall') {
            setBusy(true);

            try {
                const removed = await uninstallCopilotStatusLine();
                setMessage(removed ? 'Copilot integration removed.' : 'No owned integration was found.');
                await refreshIntegration();
            } catch (error) {
                setMessage(error instanceof Error ? error.message : String(error));
            } finally {
                setBusy(false);
            }

            return;
        }

        if (value === 'save') {
            setBusy(true);

            try {
                await saveSettings(settings);
                exit();
            } catch (error) {
                setMessage(error instanceof Error ? error.message : String(error));
                setBusy(false);
            }

            return;
        }

        exit();
    }, [exit, refreshIntegration, settings]);

    const handleInstall = useCallback(async (mode: InstallCommandMode | 'back') => {
        if (mode === 'back') {
            setScreen('menu');
            return;
        }

        setBusy(true);

        try {
            await installCopilotStatusLine(
                mode,
                isSettingsPathCustom() ? getSettingsPath() : undefined
            );
            await refreshIntegration();
            setMessage(`Installed with ${mode}.`);
            setScreen('menu');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    }, [refreshIntegration]);

    return (
        <Box flexDirection='column' paddingX={1}>
            <Header integration={integration} />
            {message === null ? null : <Box marginBottom={1}><Text color='yellow'>{message}</Text></Box>}
            {busy
                ? <Text>Working…</Text>
                : screen === 'editor'
                    ? <WidgetEditor settings={settings} onChange={setSettings} onBack={() => { setScreen('menu'); }} />
                    : screen === 'install'
                        ? (
                            <Box flexDirection='column'>
                                <Text bold>Install command</Text>
                                <SelectInput items={INSTALL_ITEMS} onSelect={item => void handleInstall(item.value)} />
                            </Box>
                        )
                        : (
                            <Box flexDirection='column'>
                                <Text dimColor>
                                    Config:
                                    {getSettingsPath()}
                                </Text>
                                <Text dimColor>
                                    Powerline:
                                    {settings.powerline.enabled ? 'on' : 'off'}
                                </Text>
                                <SelectInput items={MENU_ITEMS} onSelect={item => void handleMenu(item.value)} />
                            </Box>
                        )}
        </Box>
    );
}
