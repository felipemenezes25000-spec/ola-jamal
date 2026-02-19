import React from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, shadows } from '../../lib/themeDoctor';

interface BottomActionBarProps {
    children: React.ReactNode;
    style?: ViewStyle;
    /** If true, wraps children in KeyboardAvoidingView for forms */
    keyboardAware?: boolean;
}

export function BottomActionBar({
    children,
    style,
    keyboardAware = true,
}: BottomActionBarProps) {
    const insets = useSafeAreaInsets();
    const paddingBottom = Math.max(insets.bottom, spacing.md);

    const content = (
        <View style={[styles.container, { paddingBottom }, style]}>
            {children}
        </View>
    );

    if (keyboardAware && Platform.OS === 'ios') {
        return (
            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
                {content}
            </KeyboardAvoidingView>
        );
    }

    return content;
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: spacing.sm,
        ...shadows.sm,
    },
});
