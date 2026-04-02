import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Animated,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius, typography, theme } from '../../lib/theme';
import { haptics } from '../../lib/haptics';
import { useAppTheme } from '../../lib/ui/useAppTheme';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
    message: string;
    type?: ToastType;
    duration?: number;
    /** Ex.: "Ver pedido" — mostra botão que chama onAction e fecha o toast. */
    actionLabel?: string;
    onAction?: () => void;
}

function getTypeConfig(c: { successLight: string; success: string; errorLight: string; error: string; infoLight: string; info: string; warningLight: string; warning: string }) {
  return {
    success: { bg: c.successLight, icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap, iconColor: c.success },
    error: { bg: c.errorLight, icon: 'alert-circle' as keyof typeof Ionicons.glyphMap, iconColor: c.error },
    info: { bg: c.infoLight, icon: 'information-circle' as keyof typeof Ionicons.glyphMap, iconColor: c.info },
    warning: { bg: c.warningLight, icon: 'warning' as keyof typeof Ionicons.glyphMap, iconColor: c.warning },
  };
}

// Global toast state
let _showToast: ((config: ToastConfig) => void) | null = null;

export function showToast(config: ToastConfig) {
    _showToast?.(config);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const insets = useSafeAreaInsets();
    const { colors: themeColors } = useAppTheme();
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<ToastConfig>({ message: '' });
    const translateY = useRef(new Animated.Value(-100)).current;
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = useCallback((cfg: ToastConfig) => {
        if (timerRef.current) clearTimeout(timerRef.current);
        const t = cfg.type ?? 'info';
        if (t === 'success') haptics.success();
        else if (t === 'error') haptics.error();
        else if (t === 'warning') haptics.warning();
        else haptics.light();
        setConfig(cfg);
        setVisible(true);
        const useNative = Platform.OS !== 'web';
        Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: useNative,
            tension: 80,
            friction: 12,
        }).start();

        timerRef.current = setTimeout(() => {
            Animated.timing(translateY, {
                toValue: -100,
                duration: 250,
                useNativeDriver: useNative,
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
            useNativeDriver: Platform.OS !== 'web',
        }).start(() => setVisible(false));
    }, [translateY]);

    const type = config.type ?? 'info';
    const typeConfig = getTypeConfig(themeColors);
    const tc = typeConfig[type];

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
                            pointerEvents: 'box-none',
                        },
                    ]}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={config.message}
                >
                    <TouchableOpacity
                        style={styles.toastInner}
                        onPress={dismiss}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={`${type === 'success' ? 'Sucesso' : type === 'error' ? 'Erro' : type === 'warning' ? 'Aviso' : 'Informação'}: ${config.message}. Toque para fechar`}
                    >
                        <Ionicons name={tc.icon} size={22} color={tc.iconColor} importantForAccessibility="no" />
                        <Text style={[styles.toastText, { color: themeColors.text }]} numberOfLines={2}>
                            {config.message}
                        </Text>
                        {config.actionLabel && config.onAction ? (
                            <TouchableOpacity
                                onPress={() => {
                                    config.onAction?.();
                                    dismiss();
                                }}
                                style={[styles.actionBtn, { backgroundColor: themeColors.textMuted + '20' }]}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={config.actionLabel}
                            >
                                <Text style={[styles.actionBtnText, { color: themeColors.primary }]}>{config.actionLabel}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Ionicons name="close" size={18} color={themeColors.textMuted} importantForAccessibility="no" />
                        )}
                    </TouchableOpacity>
                </Animated.View>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        zIndex: theme.zIndex.toast,
        borderRadius: borderRadius.md,
        shadowColor: '#020617',
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
        lineHeight: 20,
    },
    actionBtn: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: borderRadius.sm,
    },
    actionBtnText: {
        fontSize: 13,
        fontFamily: typography.fontFamily.semibold,
        fontWeight: '600',
    },
});
