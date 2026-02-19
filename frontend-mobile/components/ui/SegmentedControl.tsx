import React, { useRef } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Animated,
    useWindowDimensions,
    LayoutChangeEvent,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../lib/themeDoctor';

const MIN_TOUCH = 44;

export interface SegmentedControlItem {
    key: string;
    label: string;
}

interface SegmentedControlProps {
    items: SegmentedControlItem[];
    value: string;
    onValueChange: (key: string) => void;
    disabled?: boolean;
}

export function SegmentedControl({
    items,
    value,
    onValueChange,
    disabled = false,
}: SegmentedControlProps) {
    const { width: screenWidth } = useWindowDimensions();
    const isCompact = screenWidth < 360;
    const fontSize = isCompact ? 12 : 14;

    return (
        <View style={styles.wrapper}>
            <View style={styles.container}>
                {items.map((item) => {
                    const isSelected = value === item.key;
                    return (
                        <Pressable
                            key={item.key}
                            style={[
                                styles.segment,
                                isSelected && styles.segmentActive,
                            ]}
                            onPress={() => !disabled && onValueChange(item.key)}
                            disabled={disabled}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected, disabled }}
                            accessibilityLabel={item.label}
                        >
                            <Text
                                style={[
                                    styles.label,
                                    { fontSize },
                                    isSelected && styles.labelActive,
                                ]}
                                numberOfLines={1}
                            >
                                {item.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.background,
    },
    container: {
        flexDirection: 'row',
        backgroundColor: colors.muted,
        borderRadius: borderRadius.md,
        padding: 3,
        gap: 2,
    },
    segment: {
        flex: 1,
        minHeight: MIN_TOUCH,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: borderRadius.md - 2,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.sm,
    },
    segmentActive: {
        backgroundColor: colors.surface,
        shadowColor: '#0077B6',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
    },
    label: {
        fontFamily: typography.fontFamily.semibold,
        fontWeight: '600',
        color: colors.textMuted,
    },
    labelActive: {
        color: colors.primary,
        fontWeight: '700',
        fontFamily: typography.fontFamily.bold,
    },
});
