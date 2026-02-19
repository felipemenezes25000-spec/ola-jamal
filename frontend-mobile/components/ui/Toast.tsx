import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Animated,
    Text,
    StyleSheet,
    View,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../lib/themeDoctor';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
    message: string;
    type?: ToastType;
    duration?: number;
}

const TYPE_CONFIG: Record<ToastType, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
    success: { bg: '#D1FAE5', icon: 'checkmark-circle', iconColor: '#059669' },
    error: { bg: '#FEE2E2', icon: 'alert-circle', iconColor: '#EF4444' },
    info: { bg: '#E0F2FE', icon: 'information-circle', iconColor: '#0077B6' },
    warning: { bg: '#FEF3C7', icon: 'warning', iconColor: '#F59E0B' },
};

// Global toast state
let _showToast: ((config: ToastConfig) => void) | null = null;

export function showToast(config: ToastConfig) {
    _showToast?.(config);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<ToastConfig>({ message: '' });
    const translateY = useRef(new Animated.Value(-100)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

    const show = useCallback((cfg: ToastConfig) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setConfig(cfg);
        setVisible(true);
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();

        timerRef.current = setTimeout(() => {
            Animated.timing(translateY, {
                toValue: -100,
                duration: 250,
                useNativeDriver: true,
            }).start(() => setVisible(false));
        }, cfg.duration ?? 3000);
    }, [translateY]);

    useEffect(() => {
        _showToast = show;
        return () => { _showToast = null; };
    }, [show]);

    const dismiss = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        Animated.timing(translateY, {
            toValue: -100,
            duration: 200,
            useNativeDriver: true,
        }).start(() => setVisible(false));
    }, [translateY]);

    const type = config.type ?? 'info';
    const tc = TYPE_CONFIG[type];

    return (
        <>
            {children}
            {visible && (
                <Animated.View
                    style={[
                        styles.toast,
                        {
                            top: insets.top + 8,
                            backgroundColor: tc.bg,
                            transform: [{ translateY }],
                        },
                    ]}
                    pointerEvents="box-none"
                >
                    <TouchableOpacity
                        style={styles.toastInner}
                        onPress={dismiss}
                        activeOpacity={0.8}
                    >
                        <Ionicons name={tc.icon} size={22} color={tc.iconColor} />
                        <Text style={styles.toastText} numberOfLines={2}>
                            {config.message}
                        </Text>
                        <Ionicons name="close" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </>
    );
}

const { width: SW } = Dimensions.get('window');

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        zIndex: 9999,
        borderRadius: borderRadius.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    toastInner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.sm,
    },
    toastText: {
        flex: 1,
        fontSize: 14,
        fontFamily: typography.fontFamily.medium,
        fontWeight: '500',
        color: colors.text,
        lineHeight: 20,
    },
});
