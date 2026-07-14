import {
    Box,
    Text,
    useInput
} from 'ink';
import TextInput from 'ink-text-input';
import { randomUUID } from 'node:crypto';
import {
    useMemo,
    useState,
    type ReactElement
} from 'react';

import type {
    Settings,
    WidgetConfig,
    WidgetType
} from '../../types/Settings';
import { WidgetConfigSchema } from '../../types/Settings';
import { WIDGET_CATALOG } from '../../widgets/catalog';

import { List } from './List';
import { getEditorGlobalKeyAction } from './widget-editor-input';

type PickerAction = 'add' | 'insert' | 'change';
type EditableField = 'command' | 'prefix' | 'suffix' | 'value';

interface WidgetEditorProps {
    widgets: WidgetConfig[];
    lineNumber: number;
    settings: Settings;
    onUpdate: (widgets: WidgetConfig[]) => void;
    onBack: () => void;
}

interface PickerState {
    action: PickerAction;
    query: string;
    selectedType: WidgetType | null;
}

function makeWidget(type: WidgetType): WidgetConfig {
    const catalog = WIDGET_CATALOG.find(entry => entry.type === type);
    const extra: Partial<WidgetConfig> = type === 'custom-text'
        ? { value: 'text' }
        : type === 'custom-command'
            ? { command: 'printf ok' }
            : type === 'separator'
                ? { value: '|' }
                : {};

    return WidgetConfigSchema.parse({
        id: randomUUID(),
        type,
        color: catalog?.defaultColor ?? 'none',
        ...extra
    });
}

function editableValueField(widget: WidgetConfig | undefined): EditableField | null {
    if (widget?.type === 'custom-command') {
        return 'command';
    }

    if (widget?.type === 'custom-text' || widget?.type === 'separator') {
        return 'value';
    }

    return null;
}

function widgetDisplay(widget: WidgetConfig): string {
    const catalog = WIDGET_CATALOG.find(entry => entry.type === widget.type);
    const detail = widget.type === 'custom-text'
        ? widget.value
        : widget.type === 'custom-command'
            ? widget.command
            : widget.type === 'separator'
                ? widget.value
                : undefined;

    return detail === undefined || detail === ''
        ? catalog?.name ?? widget.type
        : `${catalog?.name ?? widget.type}: ${detail}`;
}

interface ClearLineConfirmationProps {
    lineNumber: number;
    onConfirm: () => void;
    onCancel: () => void;
}

function ClearLineConfirmation({
    lineNumber,
    onConfirm,
    onCancel
}: ClearLineConfirmationProps): ReactElement {
    useInput((_, key) => {
        if (key.escape) {
            onCancel();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold color='yellow'>Confirm Clear Line</Text>
            <Box marginTop={1}>
                <Text>
                    Remove every widget from Line
                    {' '}
                    {lineNumber}
                    ?
                </Text>
            </Box>
            <List
                marginTop={1}
                color='cyan'
                items={[
                    { label: 'Clear line', value: 'confirm' },
                    { label: '← Cancel', value: 'cancel' }
                ]}
                onSelect={(value) => {
                    if (value === 'confirm') {
                        onConfirm();
                    } else {
                        onCancel();
                    }
                }}
            />
        </Box>
    );
}

export function WidgetEditor({
    widgets,
    lineNumber,
    settings,
    onUpdate,
    onBack
}: WidgetEditorProps): ReactElement {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [moveMode, setMoveMode] = useState(false);
    const [picker, setPicker] = useState<PickerState | null>(null);
    const [editingField, setEditingField] = useState<EditableField | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);
    const currentWidget = widgets[selectedIndex];
    const filteredCatalog = useMemo(() => {
        const query = picker?.query.trim().toLocaleLowerCase() ?? '';

        if (query === '') {
            return WIDGET_CATALOG;
        }

        return WIDGET_CATALOG.filter(entry => [entry.name, entry.type, entry.description]
            .some(value => value.toLocaleLowerCase().includes(query)));
    }, [picker?.query]);
    const pickerIndex = picker === null
        ? -1
        : filteredCatalog.findIndex(entry => entry.type === picker.selectedType);
    const selectedPickerEntry = filteredCatalog[Math.max(0, pickerIndex)];

    const openPicker = (action: PickerAction) => {
        setPicker({
            action,
            query: '',
            selectedType: action === 'change'
                ? currentWidget?.type ?? WIDGET_CATALOG[0]?.type ?? null
                : WIDGET_CATALOG[0]?.type ?? null
        });
    };

    const applyPicker = (type: WidgetType) => {
        if (picker === null) {
            return;
        }

        if (picker.action === 'change' && currentWidget !== undefined) {
            const replacement = makeWidget(type);
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? { ...replacement, id: widget.id }
                : widget));
        } else {
            const insertAt = picker.action === 'add'
                ? (widgets.length === 0 ? 0 : selectedIndex + 1)
                : selectedIndex;
            const next = [...widgets];
            next.splice(insertAt, 0, makeWidget(type));
            onUpdate(next);
            setSelectedIndex(insertAt);
        }

        setPicker(null);
    };

    const startEditing = (field: EditableField) => {
        if (currentWidget === undefined) {
            return;
        }

        setEditingField(field);
        setEditingValue(currentWidget[field] ?? '');
    };

    useInput((input, key) => {
        if (showClearConfirmation) {
            return;
        }

        if (editingField !== null) {
            if (key.escape) {
                setEditingField(null);
                setEditingValue('');
            }

            return;
        }

        if (picker !== null) {
            if (key.escape) {
                if (picker.query === '') {
                    setPicker(null);
                } else {
                    setPicker({ ...picker, query: '', selectedType: WIDGET_CATALOG[0]?.type ?? null });
                }
            } else if (key.upArrow || key.downArrow) {
                if (filteredCatalog.length === 0) {
                    return;
                }

                const current = pickerIndex < 0 ? 0 : pickerIndex;
                const direction = key.upArrow ? -1 : 1;
                const nextIndex = (current + direction + filteredCatalog.length) % filteredCatalog.length;
                setPicker({ ...picker, selectedType: filteredCatalog[nextIndex]?.type ?? null });
            } else if (key.return && selectedPickerEntry !== undefined) {
                applyPicker(selectedPickerEntry.type);
            } else if (key.backspace || key.delete) {
                const query = picker.query.slice(0, -1);
                const firstMatch = WIDGET_CATALOG.find(entry => [entry.name, entry.type, entry.description]
                    .some(value => value.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
                setPicker({ ...picker, query, selectedType: firstMatch?.type ?? null });
            } else if (input !== '' && !key.ctrl && !key.meta && !key.tab) {
                const query = picker.query + input;
                const firstMatch = WIDGET_CATALOG.find(entry => [entry.name, entry.type, entry.description]
                    .some(value => value.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
                setPicker({ ...picker, query, selectedType: firstMatch?.type ?? null });
            }

            return;
        }

        if (moveMode) {
            if ((key.upArrow || key.downArrow) && widgets.length > 1) {
                const direction = key.upArrow ? -1 : 1;
                const target = (selectedIndex + direction + widgets.length) % widgets.length;
                const reordered = [...widgets];
                const current = reordered[selectedIndex];
                const replacement = reordered[target];

                if (current !== undefined && replacement !== undefined) {
                    reordered[selectedIndex] = replacement;
                    reordered[target] = current;
                    onUpdate(reordered);
                    setSelectedIndex(target);
                }
            } else if (key.escape || key.return) {
                setMoveMode(false);
            }

            return;
        }

        const globalKeyAction = getEditorGlobalKeyAction(key);

        if (globalKeyAction === 'back') {
            onBack();
            return;
        }

        if (globalKeyAction === 'ignore') {
            return;
        }

        if ((key.upArrow || key.downArrow) && widgets.length > 0) {
            const direction = key.upArrow ? -1 : 1;
            setSelectedIndex((selectedIndex + direction + widgets.length) % widgets.length);
        } else if ((key.leftArrow || key.rightArrow) && currentWidget !== undefined) {
            openPicker('change');
        } else if (key.return && currentWidget !== undefined) {
            setMoveMode(true);
        } else if (input === 'a') {
            openPicker('add');
        } else if (input === 'i') {
            openPicker('insert');
        } else if (input === 'd' && currentWidget !== undefined) {
            const next = widgets.filter((_, index) => index !== selectedIndex);
            onUpdate(next);
            setSelectedIndex(Math.max(0, Math.min(selectedIndex, next.length - 1)));
        } else if (input === 'k' && currentWidget !== undefined) {
            const clone = { ...currentWidget, id: randomUUID() };
            const next = [...widgets];
            next.splice(selectedIndex + 1, 0, clone);
            onUpdate(next);
            setSelectedIndex(selectedIndex + 1);
        } else if (input === 'c' && widgets.length > 0) {
            setShowClearConfirmation(true);
        } else if (input === 'r' && currentWidget !== undefined) {
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? { ...widget, raw: !widget.raw }
                : widget));
        } else if (input === 'm' && currentWidget !== undefined && selectedIndex < widgets.length - 1) {
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? { ...widget, merge: !widget.merge }
                : widget));
        } else if (input === 'z' && currentWidget !== undefined) {
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? { ...widget, hideWhenZero: !widget.hideWhenZero }
                : widget));
        } else if (input === ' ' && currentWidget?.type === 'separator') {
            const separators = ['|', '-', ',', ' '];
            const current = separators.indexOf(currentWidget.value ?? '|');
            const value = separators[(current + 1) % separators.length] ?? '|';
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? { ...widget, value }
                : widget));
        } else if (input === 'e') {
            const field = editableValueField(currentWidget);

            if (field !== null) {
                startEditing(field);
            }
        } else if (input === 'p') {
            startEditing('prefix');
        } else if (input === 's') {
            startEditing('suffix');
        }
    });

    if (showClearConfirmation) {
        return (
            <ClearLineConfirmation
                lineNumber={lineNumber}
                onCancel={() => { setShowClearConfirmation(false); }}
                onConfirm={() => {
                    onUpdate([]);
                    setSelectedIndex(0);
                    setShowClearConfirmation(false);
                }}
            />
        );
    }

    if (editingField !== null) {
        return (
            <Box flexDirection='column'>
                <Text bold>
                    Edit
                    {' '}
                    {editingField}
                    {' '}
                    — Line
                    {' '}
                    {lineNumber}
                </Text>
                <Box marginTop={1}>
                    <Text color='cyan'>&gt; </Text>
                    <TextInput
                        value={editingValue}
                        onChange={setEditingValue}
                        onSubmit={(value) => {
                            onUpdate(widgets.map((widget, index) => index === selectedIndex
                                ? { ...widget, [editingField]: value }
                                : widget));
                            setEditingField(null);
                            setEditingValue('');
                        }}
                    />
                </Box>
                <Text dimColor>Enter apply, ESC cancel</Text>
            </Box>
        );
    }

    if (picker !== null) {
        const action = picker.action === 'change'
            ? 'Change Widget'
            : picker.action === 'insert'
                ? 'Insert Widget'
                : 'Add Widget';

        return (
            <Box flexDirection='column'>
                <Text bold>
                    Edit Line
                    {' '}
                    {lineNumber}
                    <Text color='cyan'>{` [${action.toUpperCase()}]`}</Text>
                </Text>
                <Text dimColor>↑↓ select widget, type to search, Enter apply, ESC clear/cancel</Text>
                <Text>
                    <Text dimColor>Search: </Text>
                    <Text color='cyan'>{picker.query === '' ? '(none)' : picker.query}</Text>
                </Text>
                <Box marginTop={1} flexDirection='column'>
                    {filteredCatalog.length === 0
                        ? <Text dimColor>No widgets match the search.</Text>
                        : filteredCatalog.map((entry, index) => {
                            const selected = entry.type === selectedPickerEntry?.type;

                            return (
                                <Text key={entry.type} color={selected ? 'green' : undefined}>
                                    {selected ? '▶  ' : '   '}
                                    {index + 1}
                                    .
                                    {' '}
                                    {entry.name}
                                </Text>
                            );
                        })}
                </Box>
                {selectedPickerEntry === undefined ? null : (
                    <Box marginTop={1} paddingLeft={2}>
                        <Text dimColor>{selectedPickerEntry.description}</Text>
                    </Box>
                )}
            </Box>
        );
    }

    return (
        <Box flexDirection='column'>
            <Text bold>
                Edit Line
                {' '}
                {lineNumber}
                {moveMode ? <Text color='blue'> [MOVE MODE]</Text> : null}
            </Text>
            <Text dimColor>
                {moveMode
                    ? '↑↓ move widget, ESC or Enter exit move mode'
                    : '↑↓ select, ←→ change, Enter move, (a)dd, (i)nsert, (k) clone, (d)elete, (c)lear'}
            </Text>
            <Text dimColor>
                {moveMode
                    ? ' '
                    : '(e)dit value, (p)refix, (s)uffix, (r)aw, (m)erge, hide-(z)ero, ESC back'}
            </Text>
            {settings.powerline.enabled ? (
                <Text color='yellow'>Powerline mode active: segment backgrounds are visible in Edit Colors</Text>
            ) : null}
            <Box marginTop={1} flexDirection='column'>
                {widgets.length === 0
                    ? <Text dimColor>No widgets. Press 'a' to add one.</Text>
                    : widgets.map((widget, index) => {
                        const selected = index === selectedIndex;
                        const modifiers = [
                            widget.raw ? 'raw value' : null,
                            widget.merge ? 'merged→' : null,
                            widget.hideWhenZero ? 'hide zero' : null
                        ].filter(value => value !== null).join(', ');

                        return (
                            <Text
                                key={widget.id}
                                color={selected ? (moveMode ? 'blue' : 'green') : undefined}
                            >
                                {selected ? (moveMode ? '◆  ' : '▶  ') : '   '}
                                {index + 1}
                                .
                                {' '}
                                {widgetDisplay(widget)}
                                {modifiers === '' ? null : <Text dimColor>{` (${modifiers})`}</Text>}
                            </Text>
                        );
                    })}
            </Box>
            {currentWidget === undefined ? null : (
                <Box marginTop={1} paddingLeft={2}>
                    <Text dimColor>
                        {WIDGET_CATALOG.find(entry => entry.type === currentWidget.type)?.description}
                    </Text>
                </Box>
            )}
        </Box>
    );
}
