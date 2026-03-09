import React from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../lib/ui/useAppTheme';

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
    const { colors, spacing, shadows } = useAppTheme();
    const paddingBottom = Math.max(insets.bottom, spacing.md);

    const content = (
        <View style={[
            styles.container,
            {
                paddingBottom,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.md,
                backgroundColor: colors.surface,
                borderTopColor: colors.borderLight,
                ...shadows.sm,
            },
            style,
        ]}>
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
        borderTopWidth: 1,
        gap: 8,
    },
});
