import {
    Box,
    Text,
    useInput,
    type BoxProps
} from 'ink';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren,
    type ReactElement
} from 'react';

import { getVerticalNavigationDirection } from '../vertical-navigation';

export interface ListEntry<V = string | number> {
    label: string;
    sublabel?: string;
    disabled?: boolean;
    description?: string;
    value: V;
}

interface ListProps<V = string | number> extends BoxProps {
    items: (ListEntry<V> | '-')[];
    onSelect: (value: V | 'back', index: number) => void;
    onSelectionChange?: (value: V | 'back', index: number) => void;
    initialSelection?: number;
    showBackButton?: boolean;
    color?: 'blue' | 'cyan' | 'green';
}

export function List<V = string | number>({
    items,
    onSelect,
    onSelectionChange,
    initialSelection = 0,
    showBackButton = false,
    color = 'green',
    ...boxProps
}: ListProps<V>): ReactElement {
    const [selectedIndex, setSelectedIndex] = useState(initialSelection);
    const latestSelectionChange = useRef(onSelectionChange);
    const renderedItems = useMemo(() => showBackButton
        ? [...items, '-' as const, { label: '← Back', value: 'back' as V }]
        : items, [items, showBackButton]);
    const selectableItems = renderedItems.filter(
        item => item !== '-' && !item.disabled
    ) as ListEntry<V>[];
    const selectedItem = selectableItems[selectedIndex];
    const selectedValue = selectedItem?.value;
    const actualIndex = renderedItems.findIndex(item => item === selectedItem);

    useEffect(() => {
        latestSelectionChange.current = onSelectionChange;
    }, [onSelectionChange]);

    useEffect(() => {
        setSelectedIndex(Math.min(initialSelection, Math.max(0, selectableItems.length - 1)));
    }, [initialSelection, selectableItems.length]);

    useEffect(() => {
        if (selectedValue !== undefined) {
            latestSelectionChange.current?.(selectedValue, selectedIndex);
        }
    }, [selectedIndex, selectedValue]);

    useInput((input, key) => {
        if (selectableItems.length === 0) {
            return;
        }

        const direction = getVerticalNavigationDirection(input, key);

        if (direction !== null) {
            setSelectedIndex(index => (index + direction + selectableItems.length) % selectableItems.length);
        } else if (key.return && selectedItem !== undefined) {
            onSelect(selectedItem.value, selectedIndex);
        }
    });

    return (
        <Box flexDirection='column' {...boxProps}>
            {renderedItems.map((item, index) => item === '-'
                ? <Text key={index}> </Text>
                : (
                    <ListItem
                        key={`${String(item.value)}-${index}`}
                        isSelected={index === actualIndex}
                        color={color}
                        disabled={item.disabled}
                    >
                        <Text>
                            {item.label}
                            {item.sublabel === undefined ? null : (
                                <Text dimColor={index !== actualIndex}>
                                    {' '}
                                    {item.sublabel}
                                </Text>
                            )}
                        </Text>
                    </ListItem>
                ))}
            {selectedItem?.description === undefined ? null : (
                <Box marginTop={1} paddingLeft={2}>
                    <Text dimColor wrap='wrap'>{selectedItem.description}</Text>
                </Box>
            )}
        </Box>
    );
}

interface ListItemProps extends PropsWithChildren {
    isSelected: boolean;
    color: 'blue' | 'cyan' | 'green';
    disabled?: boolean;
}

function ListItem({ children, isSelected, color, disabled }: ListItemProps): ReactElement {
    return (
        <Text color={isSelected ? color : undefined} dimColor={disabled}>
            {isSelected ? '▶  ' : '   '}
            {children}
        </Text>
    );
}
