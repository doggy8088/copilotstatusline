import {
    Box,
    Text,
    useInput
} from 'ink';
import {
    useState,
    type ReactElement
} from 'react';

import type {
    ColorName,
    Settings,
    WidgetConfig
} from '../../types/Settings';
import { COLORS } from '../../types/Settings';
import { styleText } from '../../utils/ansi';
import { WIDGET_CATALOG } from '../../widgets/catalog';
import { getVerticalNavigationDirection } from '../vertical-navigation';

import { List } from './List';

interface ColorEditorProps {
    widgets: WidgetConfig[];
    lineNumber: number;
    settings: Settings;
    onUpdate: (widgets: WidgetConfig[]) => void;
    onBack: () => void;
}

function cycleColor(color: ColorName, direction: -1 | 1): ColorName {
    const current = COLORS.indexOf(color);
    const next = (current + direction + COLORS.length) % COLORS.length;
    return COLORS[next] ?? 'none';
}

interface ClearColorsConfirmationProps {
    onConfirm: () => void;
    onCancel: () => void;
}

function ClearColorsConfirmation({
    onConfirm,
    onCancel
}: ClearColorsConfirmationProps): ReactElement {
    useInput((_, key) => {
        if (key.escape) {
            onCancel();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold color='yellow'>Confirm Clear All Colors</Text>
            <Box marginTop={1} flexDirection='column'>
                <Text>Reset every widget on this line to its default styling?</Text>
                <Text color='red'>This action cannot be undone.</Text>
            </Box>
            <List
                marginTop={1}
                color='cyan'
                items={[
                    { label: 'Reset colors', value: 'confirm' },
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

function resetWidgetStyle(widget: WidgetConfig): WidgetConfig {
    const catalog = WIDGET_CATALOG.find(entry => entry.type === widget.type);

    return {
        ...widget,
        color: catalog?.defaultColor ?? 'none',
        backgroundColor: 'none',
        bold: false
    };
}

export function ColorEditor({
    widgets,
    lineNumber,
    settings,
    onUpdate,
    onBack
}: ColorEditorProps): ReactElement {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [editingBackground, setEditingBackground] = useState(false);
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);
    const selectedWidget = widgets[selectedIndex];
    const currentColor = selectedWidget === undefined
        ? 'none'
        : editingBackground
            ? selectedWidget.backgroundColor
            : selectedWidget.color;
    const colorNumber = COLORS.indexOf(currentColor) + 1;

    useInput((input, key) => {
        if (showClearConfirmation) {
            return;
        }

        if (widgets.length === 0) {
            if (key.escape || input !== '') {
                onBack();
            }

            return;
        }

        const direction = getVerticalNavigationDirection(input, key);

        if (direction !== null) {
            setSelectedIndex(index => (index + direction + widgets.length) % widgets.length);
        } else if ((key.leftArrow || key.rightArrow) && selectedWidget !== undefined) {
            const direction = key.leftArrow ? -1 : 1;
            const field = editingBackground ? 'backgroundColor' : 'color';
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? { ...widget, [field]: cycleColor(widget[field], direction) }
                : widget));
        } else if (input === 'f') {
            setEditingBackground(value => !value);
        } else if (input === 'b' && selectedWidget !== undefined) {
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? { ...widget, bold: !widget.bold }
                : widget));
        } else if (input === 'r' && selectedWidget !== undefined) {
            onUpdate(widgets.map((widget, index) => index === selectedIndex
                ? resetWidgetStyle(widget)
                : widget));
        } else if (input === 'c') {
            setShowClearConfirmation(true);
        } else if (key.escape) {
            onBack();
        }
    });

    if (showClearConfirmation) {
        return (
            <ClearColorsConfirmation
                onCancel={() => { setShowClearConfirmation(false); }}
                onConfirm={() => {
                    onUpdate(widgets.map(resetWidgetStyle));
                    setShowClearConfirmation(false);
                }}
            />
        );
    }

    if (widgets.length === 0) {
        return (
            <Box flexDirection='column'>
                <Text bold>
                    Configure Colors — Line
                    {' '}
                    {lineNumber}
                </Text>
                <Box marginTop={1}>
                    <Text dimColor>No colorable widgets in this status line.</Text>
                </Box>
                <Text dimColor>Add a widget first to continue.</Text>
                <Box marginTop={1}><Text>Press any key to go back...</Text></Box>
            </Box>
        );
    }

    const selectedName = selectedWidget === undefined
        ? ''
        : WIDGET_CATALOG.find(entry => entry.type === selectedWidget.type)?.name ?? selectedWidget.type;
    const styleIndicators = [selectedWidget?.bold ? '[BOLD]' : null]
        .filter(value => value !== null)
        .join(' ');

    return (
        <Box flexDirection='column'>
            <Text bold>
                Configure Colors — Line
                {' '}
                {lineNumber}
                {editingBackground ? <Text color='yellow'> [Background Mode]</Text> : null}
            </Text>
            <Text dimColor>
                ↑↓/j/k select, ←→ cycle
                {' '}
                {editingBackground ? 'background' : 'foreground'}
                , (f) toggle bg/fg, (b)old, (r)eset, (c)lear all, ESC back
            </Text>
            <Box marginTop={1}>
                <Text>
                    Current
                    {' '}
                    {editingBackground ? 'background' : 'foreground'}
                    {' '}
                    (
                    {colorNumber}
                    /
                    {COLORS.length}
                    ):
                    {' '}
                    {styleText(
                        currentColor === 'none' ? '(none)' : currentColor,
                        editingBackground ? 'white' : currentColor,
                        editingBackground ? currentColor : 'none',
                        false,
                        settings.colorLevel
                    )}
                    {styleIndicators === '' ? null : ` ${styleIndicators}`}
                </Text>
            </Box>
            <Box marginTop={1} flexDirection='column'>
                {widgets.map((widget, index) => {
                    const selected = index === selectedIndex;
                    const label = `${index + 1}: ${WIDGET_CATALOG.find(entry => entry.type === widget.type)?.name ?? widget.type}`;

                    return (
                        <Text key={widget.id} color={selected ? 'green' : undefined}>
                            {selected ? '▶  ' : '   '}
                            {styleText(
                                label,
                                widget.color,
                                widget.backgroundColor,
                                widget.bold,
                                settings.colorLevel
                            )}
                        </Text>
                    );
                })}
            </Box>
            <Box marginTop={1} paddingLeft={2}>
                <Text dimColor>{selectedName}</Text>
            </Box>
        </Box>
    );
}
