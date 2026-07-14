import {
    Box,
    Text,
    useApp,
    useInput
} from 'ink';
import Gradient from 'ink-gradient';
import TextInput from 'ink-text-input';
import { spawn } from 'node:child_process';
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactElement
} from 'react';

import packageJson from '../../package.json';
import type { Settings } from '../types/Settings';
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

import { ColorEditor } from './components/ColorEditor';
import { LineSelector } from './components/LineSelector';
import {
    List,
    type ListEntry
} from './components/List';
import {
    MainMenu,
    type MainMenuOption
} from './components/MainMenu';
import { StatusLinePreview } from './components/StatusLinePreview';
import { WidgetEditor } from './components/WidgetEditor';

interface AppProps {
    settings: Settings;
    integration: CopilotIntegrationStatus | null;
}

type Screen = 'main'
    | 'lines'
    | 'items'
    | 'colorLines'
    | 'colors'
    | 'powerline'
    | 'terminal'
    | 'overrides'
    | 'installation'
    | 'confirmSave';

interface FlashMessage {
    text: string;
    color: 'green' | 'red' | 'yellow';
}

function GradientTitle(): ReactElement {
    return (
        <Text bold>
            <Gradient name='retro'>CopilotStatusline Configuration</Gradient>
        </Text>
    );
}

interface BackableProps { onBack: () => void }

interface PowerlineSetupProps extends BackableProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

function PowerlineSetup({ settings, onChange, onBack }: PowerlineSetupProps): ReactElement {
    const [editingSeparator, setEditingSeparator] = useState(false);
    const [separator, setSeparator] = useState(settings.powerline.separator);

    useInput((_, key) => {
        if (key.escape) {
            if (editingSeparator) {
                setEditingSeparator(false);
                setSeparator(settings.powerline.separator);
            } else {
                onBack();
            }
        }
    });

    if (editingSeparator) {
        return (
            <Box flexDirection='column'>
                <Text bold>Edit Powerline Separator</Text>
                <Box marginTop={1}>
                    <Text color='cyan'>&gt; </Text>
                    <TextInput
                        value={separator}
                        onChange={setSeparator}
                        onSubmit={(value) => {
                            onChange({
                                ...settings,
                                powerline: { ...settings.powerline, separator: value || '' }
                            });
                            setEditingSeparator(false);
                        }}
                    />
                </Box>
                <Text dimColor>Enter apply, ESC cancel</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>Powerline Setup</Text>
            <Text dimColor>Configure segment rendering and separators</Text>
            <List
                marginTop={1}
                showBackButton
                items={[
                    {
                        label: settings.powerline.enabled ? '◉ Powerline enabled' : '○ Powerline disabled',
                        value: 'toggle',
                        description: 'Toggle filled Powerline segments in the status line renderer'
                    },
                    {
                        label: `Separator: ${settings.powerline.separator}`,
                        value: 'separator',
                        description: 'Change the Powerline transition glyph'
                    }
                ]}
                onSelect={(value) => {
                    if (value === 'back') {
                        onBack();
                    } else if (value === 'toggle') {
                        onChange({
                            ...settings,
                            powerline: {
                                ...settings.powerline,
                                enabled: !settings.powerline.enabled
                            }
                        });
                    } else {
                        setSeparator(settings.powerline.separator);
                        setEditingSeparator(true);
                    }
                }}
            />
        </Box>
    );
}

interface TerminalOptionsProps extends BackableProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

function TerminalOptions({ settings, onChange, onBack }: TerminalOptionsProps): ReactElement {
    useInput((_, key) => {
        if (key.escape) {
            onBack();
        }
    });
    const levels: ListEntry<number>[] = [
        { label: 'No colors', value: 0, description: 'Disable ANSI color output' },
        { label: '16 colors', value: 1, description: 'Use the basic ANSI terminal palette' },
        { label: '256 colors', value: 2, description: 'Use the extended terminal palette' },
        { label: 'True color', value: 3, description: 'Use 24-bit terminal color output' }
    ].map(entry => ({
        ...entry,
        label: `${entry.value === settings.colorLevel ? '◉' : '○'} ${entry.label}`
    }));

    return (
        <Box flexDirection='column'>
            <Text bold>Terminal Options</Text>
            <Text dimColor>Select the color capability used for rendering</Text>
            <List
                marginTop={1}
                items={levels}
                initialSelection={settings.colorLevel}
                showBackButton
                onSelect={(value) => {
                    if (value === 'back') {
                        onBack();
                    } else {
                        onChange({ ...settings, colorLevel: value });
                    }
                }}
            />
        </Box>
    );
}

interface GlobalOverridesProps extends BackableProps {
    settings: Settings;
    onChange: (settings: Settings) => void;
}

function GlobalOverrides({ settings, onChange, onBack }: GlobalOverridesProps): ReactElement {
    const [separator, setSeparator] = useState(settings.defaultSeparator);

    useInput((_, key) => {
        if (key.escape) {
            onBack();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>Global Overrides</Text>
            <Text dimColor>Default separator inserted between visible widgets</Text>
            <Box marginTop={1}>
                <Text color='cyan'>&gt; </Text>
                <TextInput
                    value={separator}
                    onChange={setSeparator}
                    onSubmit={(value) => {
                        onChange({ ...settings, defaultSeparator: value });
                        onBack();
                    }}
                />
            </Box>
            <Text dimColor>Enter apply, ESC cancel</Text>
        </Box>
    );
}

interface InstallationMenuProps extends BackableProps {
    integration: CopilotIntegrationStatus | null;
    busy: boolean;
    onInstall: (mode: InstallCommandMode) => void;
    onUninstall: () => void;
}

function InstallationMenu({
    integration,
    busy,
    onInstall,
    onUninstall,
    onBack
}: InstallationMenuProps): ReactElement {
    useInput((_, key) => {
        if (key.escape && !busy) {
            onBack();
        }
    });
    const items: (ListEntry<InstallCommandMode | 'uninstall'> | '-')[] = [
        {
            label: 'npx -y @willh/copilotstatusline@latest',
            value: 'npm',
            description: 'Use the latest npm package for each Copilot CLI status refresh'
        },
        {
            label: 'bunx -y @willh/copilotstatusline@latest',
            value: 'bunx',
            description: 'Use the latest npm package through Bun for each status refresh'
        },
        {
            label: 'Global copilotstatusline binary',
            value: 'global',
            description: 'Use the copilotstatusline command already available on PATH'
        },
        ...(integration?.installed === true
            ? [
                '-' as const,
                {
                    label: 'Uninstall from Copilot CLI',
                    value: 'uninstall' as const,
                    description: 'Remove only the status line command owned by this package'
                }
            ]
            : [])
    ];

    if (busy) {
        return (
            <Box flexDirection='column'>
                <Text bold>Manage Installation</Text>
                <Box marginTop={1}><Text color='cyan'>Working…</Text></Box>
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>{integration?.installed === true ? 'Manage Installation' : 'Install to Copilot CLI'}</Text>
            <Text dimColor>User-level Copilot settings only</Text>
            <List
                marginTop={1}
                items={items}
                showBackButton
                onSelect={(value) => {
                    if (value === 'back') {
                        onBack();
                    } else if (value === 'uninstall') {
                        onUninstall();
                    } else {
                        onInstall(value);
                    }
                }}
            />
        </Box>
    );
}

function openProjectRepository(): void {
    const url = 'https://github.com/doggy8088/copilotstatusline';
    const command = process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
            ? 'cmd'
            : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
}

export function App({
    settings: initialSettings,
    integration: initialIntegration
}: AppProps): ReactElement {
    const { exit } = useApp();
    const [settings, setSettings] = useState(initialSettings);
    const [savedSettings, setSavedSettings] = useState(initialSettings);
    const [integration, setIntegration] = useState(initialIntegration);
    const [screen, setScreen] = useState<Screen>('main');
    const [selectedLine, setSelectedLine] = useState(0);
    const [mainSelection, setMainSelection] = useState(0);
    const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 120);
    const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
    const [busy, setBusy] = useState(false);
    const [loadError, setLoadError] = useState(getSettingsLoadError());
    const [pendingSaveExit, setPendingSaveExit] = useState(false);
    const hasChanges = useMemo(
        () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
        [savedSettings, settings]
    );

    useEffect(() => {
        const handleResize = () => {
            setTerminalWidth(process.stdout.columns || 120);
        };

        process.stdout.on('resize', handleResize);
        return () => { process.stdout.off('resize', handleResize); };
    }, []);

    useEffect(() => {
        if (flashMessage === null) {
            return;
        }

        const timer = setTimeout(() => { setFlashMessage(null); }, 2_000);
        return () => { clearTimeout(timer); };
    }, [flashMessage]);

    const performSave = useCallback(async (exitAfterSave: boolean) => {
        try {
            await saveSettings(settings);
            setSavedSettings(settings);
            setLoadError(null);

            if (exitAfterSave) {
                exit();
            } else {
                setFlashMessage({ text: '✓ Configuration saved', color: 'green' });
            }
        } catch (error) {
            setFlashMessage({
                text: error instanceof Error ? error.message : String(error),
                color: 'red'
            });
        }
    }, [exit, settings]);

    const requestSave = useCallback((exitAfterSave: boolean) => {
        if (loadError !== null) {
            setPendingSaveExit(exitAfterSave);
            setScreen('confirmSave');
            return;
        }

        void performSave(exitAfterSave);
    }, [loadError, performSave]);

    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            exit();
        } else if (key.ctrl && input === 's' && screen !== 'confirmSave') {
            requestSave(false);
        }
    });

    const refreshIntegration = useCallback(async () => {
        setIntegration(await inspectCopilotIntegration().catch(() => null));
    }, []);

    const handleInstall = useCallback(async (mode: InstallCommandMode) => {
        setBusy(true);

        try {
            await installCopilotStatusLine(
                mode,
                isSettingsPathCustom() ? getSettingsPath() : undefined
            );
            await refreshIntegration();
            setFlashMessage({ text: `Installed with ${mode}`, color: 'green' });
            setScreen('main');
        } catch (error) {
            setFlashMessage({
                text: error instanceof Error ? error.message : String(error),
                color: 'red'
            });
        } finally {
            setBusy(false);
        }
    }, [refreshIntegration]);

    const handleUninstall = useCallback(async () => {
        setBusy(true);

        try {
            const removed = await uninstallCopilotStatusLine();
            await refreshIntegration();
            setFlashMessage({
                text: removed ? 'Copilot integration removed' : 'No owned integration was found',
                color: removed ? 'green' : 'yellow'
            });
            setScreen('main');
        } catch (error) {
            setFlashMessage({
                text: error instanceof Error ? error.message : String(error),
                color: 'red'
            });
        } finally {
            setBusy(false);
        }
    }, [refreshIntegration]);

    const handleMainMenu = (value: MainMenuOption, index: number) => {
        setMainSelection(index);

        switch (value) {
            case 'lines':
                setScreen('lines');
                break;
            case 'colors':
                setScreen('colorLines');
                break;
            case 'powerline':
                setScreen('powerline');
                break;
            case 'terminal':
                setScreen('terminal');
                break;
            case 'overrides':
                setScreen('overrides');
                break;
            case 'installation':
                setScreen('installation');
                break;
            case 'save':
                requestSave(true);
                break;
            case 'github':
                openProjectRepository();
                setFlashMessage({ text: 'Opened project repository', color: 'green' });
                break;
            case 'exit':
                exit();
                break;
        }
    };

    const updateSelectedLine = (widgets: Settings['lines'][number]) => {
        setSettings(current => ({
            ...current,
            lines: current.lines.map((line, index) => index === selectedLine ? widgets : line)
        }));
    };

    const screenContent = (() => {
        switch (screen) {
            case 'lines':
                return (
                    <LineSelector
                        lines={settings.lines}
                        allowEditing
                        initialSelection={selectedLine}
                        onLinesUpdate={(lines) => { setSettings({ ...settings, lines }); }}
                        onSelect={(lineIndex) => {
                            setSelectedLine(lineIndex);
                            setScreen('items');
                        }}
                        onBack={() => { setScreen('main'); }}
                    />
                );
            case 'items':
                return (
                    <WidgetEditor
                        widgets={settings.lines[selectedLine] ?? []}
                        lineNumber={selectedLine + 1}
                        settings={settings}
                        onUpdate={updateSelectedLine}
                        onBack={() => { setScreen('lines'); }}
                    />
                );
            case 'colorLines':
                return (
                    <LineSelector
                        lines={settings.lines}
                        title='Select Line to Configure Colors'
                        initialSelection={selectedLine}
                        onLinesUpdate={(lines) => { setSettings({ ...settings, lines }); }}
                        onSelect={(lineIndex) => {
                            setSelectedLine(lineIndex);
                            setScreen('colors');
                        }}
                        onBack={() => { setScreen('main'); }}
                    />
                );
            case 'colors':
                return (
                    <ColorEditor
                        widgets={settings.lines[selectedLine] ?? []}
                        lineNumber={selectedLine + 1}
                        settings={settings}
                        onUpdate={updateSelectedLine}
                        onBack={() => { setScreen('colorLines'); }}
                    />
                );
            case 'powerline':
                return (
                    <PowerlineSetup
                        settings={settings}
                        onChange={setSettings}
                        onBack={() => { setScreen('main'); }}
                    />
                );
            case 'terminal':
                return (
                    <TerminalOptions
                        settings={settings}
                        onChange={setSettings}
                        onBack={() => { setScreen('main'); }}
                    />
                );
            case 'overrides':
                return (
                    <GlobalOverrides
                        settings={settings}
                        onChange={setSettings}
                        onBack={() => { setScreen('main'); }}
                    />
                );
            case 'installation':
                return (
                    <InstallationMenu
                        integration={integration}
                        busy={busy}
                        onInstall={(mode) => { void handleInstall(mode); }}
                        onUninstall={() => { void handleUninstall(); }}
                        onBack={() => { setScreen('main'); }}
                    />
                );
            case 'confirmSave':
                return (
                    <Box flexDirection='column'>
                        <Text bold color='yellow'>Replace Invalid Configuration?</Text>
                        <Box marginTop={1}>
                            <Text color='red' wrap='wrap'>{loadError}</Text>
                        </Box>
                        <Text dimColor>Saving replaces the malformed file with the current configuration.</Text>
                        <List
                            marginTop={1}
                            color='cyan'
                            items={[
                                { label: 'Replace configuration', value: 'replace' },
                                { label: '← Cancel', value: 'cancel' }
                            ]}
                            onSelect={(value) => {
                                if (value === 'replace') {
                                    setScreen('main');
                                    void performSave(pendingSaveExit);
                                } else {
                                    setScreen('main');
                                }
                            }}
                        />
                    </Box>
                );
            case 'main':
                return (
                    <MainMenu
                        integration={integration}
                        hasChanges={hasChanges}
                        initialSelection={mainSelection}
                        onSelect={handleMainMenu}
                    />
                );
        }
    })();

    return (
        <Box flexDirection='column'>
            <Box marginBottom={1}>
                <GradientTitle />
                <Text bold dimColor>
                    {' | v'}
                    {packageJson.version}
                </Text>
                {flashMessage === null ? null : (
                    <Text bold color={flashMessage.color}>
                        {'  '}
                        {flashMessage.text}
                    </Text>
                )}
            </Box>
            {loadError === null || screen === 'confirmSave' ? null : (
                <Text color='red' wrap='wrap'>
                    ⚠
                    {' '}
                    {loadError}
                    {' — showing defaults; saving requires confirmation.'}
                </Text>
            )}
            {isSettingsPathCustom() ? <Text dimColor>{`Config: ${getSettingsPath()}`}</Text> : null}
            <StatusLinePreview settings={settings} terminalWidth={terminalWidth} />
            <Box marginTop={1}>{screenContent}</Box>
        </Box>
    );
}
