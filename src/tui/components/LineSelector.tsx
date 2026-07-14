import {
    Box,
    Text,
    useInput
} from 'ink';
import {
    useEffect,
    useState,
    type ReactElement
} from 'react';

import type { Settings } from '../../types/Settings';

import {
    List,
    type ListEntry
} from './List';

interface LineSelectorProps {
    lines: Settings['lines'];
    title?: string;
    allowEditing?: boolean;
    initialSelection?: number;
    onSelect: (lineIndex: number) => void;
    onBack: () => void;
    onLinesUpdate: (lines: Settings['lines']) => void;
}

interface DeleteConfirmationProps {
    lineNumber: number;
    onConfirm: () => void;
    onCancel: () => void;
}

function DeleteConfirmation({
    lineNumber,
    onConfirm,
    onCancel
}: DeleteConfirmationProps): ReactElement {
    useInput((_, key) => {
        if (key.escape) {
            onCancel();
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold color='yellow'>Confirm Delete Line</Text>
            <Box marginTop={1}>
                <Text>
                    Delete Line
                    {' '}
                    {lineNumber}
                    {' '}
                    and all widgets in it?
                </Text>
            </Box>
            <List
                marginTop={1}
                items={[
                    { label: 'Delete line', value: 'confirm' },
                    { label: '← Cancel', value: 'cancel' }
                ]}
                color='cyan'
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

export function LineSelector({
    lines,
    title = 'Select Line to Edit',
    allowEditing = false,
    initialSelection = 0,
    onSelect,
    onBack,
    onLinesUpdate
}: LineSelectorProps): ReactElement {
    const [selectedIndex, setSelectedIndex] = useState(initialSelection);
    const [moveMode, setMoveMode] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    useEffect(() => {
        setSelectedIndex(index => Math.min(index, Math.max(0, lines.length - 1)));
    }, [lines.length]);

    useInput((input, key) => {
        if (showDeleteConfirmation) {
            return;
        }

        if (moveMode) {
            if ((key.upArrow || key.downArrow) && lines.length > 1) {
                const direction = key.upArrow ? -1 : 1;
                const target = (selectedIndex + direction + lines.length) % lines.length;
                const reordered = [...lines];
                const current = reordered[selectedIndex];
                const replacement = reordered[target];

                if (current !== undefined && replacement !== undefined) {
                    reordered[selectedIndex] = replacement;
                    reordered[target] = current;
                    onLinesUpdate(reordered);
                    setSelectedIndex(target);
                }
            } else if (key.escape || key.return) {
                setMoveMode(false);
            }

            return;
        }

        if (input === 'a' && allowEditing) {
            onLinesUpdate([...lines, []]);
            setSelectedIndex(lines.length);
        } else if (input === 'd' && allowEditing && lines.length > 1) {
            setShowDeleteConfirmation(true);
        } else if (input === 'm' && allowEditing && lines.length > 1) {
            setMoveMode(true);
        } else if (key.escape) {
            onBack();
        }
    });

    if (showDeleteConfirmation) {
        return (
            <DeleteConfirmation
                lineNumber={selectedIndex + 1}
                onCancel={() => { setShowDeleteConfirmation(false); }}
                onConfirm={() => {
                    const remaining = lines.filter((_, index) => index !== selectedIndex);
                    onLinesUpdate(remaining);
                    setSelectedIndex(Math.max(0, selectedIndex - 1));
                    setShowDeleteConfirmation(false);
                }}
            />
        );
    }

    const lineItems: ListEntry<number>[] = lines.map((line, index) => ({
        label: `☰ Line ${index + 1}`,
        sublabel: `(${line.length === 0 ? 'empty' : `${line.length} ${line.length === 1 ? 'widget' : 'widgets'}`})`,
        value: index
    }));

    return (
        <Box flexDirection='column'>
            <Text bold>
                {title}
                {moveMode ? <Text color='blue'> [MOVE MODE]</Text> : null}
            </Text>
            <Text dimColor>Choose which status line to configure</Text>
            <Text dimColor>
                {moveMode
                    ? '↑↓ to move line, ESC or Enter to exit move mode'
                    : allowEditing
                        ? '(a) append line, (d) delete line, (m) move line, ESC back'
                        : 'ESC to go back'}
            </Text>
            {moveMode
                ? (
                    <Box marginTop={1} flexDirection='column'>
                        {lineItems.map((item, index) => (
                            <Text key={item.value} color={index === selectedIndex ? 'blue' : undefined}>
                                {index === selectedIndex ? '◆  ' : '   '}
                                {item.label}
                                <Text dimColor={index !== selectedIndex}>
                                    {' '}
                                    {item.sublabel}
                                </Text>
                            </Text>
                        ))}
                    </Box>
                )
                : (
                    <List
                        items={lineItems}
                        marginTop={1}
                        initialSelection={selectedIndex}
                        showBackButton
                        onSelectionChange={(_, index) => { setSelectedIndex(index); }}
                        onSelect={(value) => {
                            if (value === 'back') {
                                onBack();
                            } else {
                                onSelect(value);
                            }
                        }}
                    />
                )}
        </Box>
    );
}
