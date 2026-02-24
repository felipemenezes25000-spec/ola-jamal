import React, { useEffect } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';

// Shared animation value — all skeletons shimmer in sync using a single JS animation loop.
const sharedShimmer = new Animated.Value(0);
let animationStarted = false;

function ensureAnimationStarted() {
    if (animationStarted) return;
    animationStarted = true;
    Animated.loop(
        Animated.sequence([
            Animated.timing(sharedShimmer, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: false,
            }),
            Animated.timing(sharedShimmer, {
                toValue: 0,
                duration: 1000,
                useNativeDriver: false,
            }),
        ])
    ).start();
}

const sharedBg = sharedShimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E2EDF6', '#F0F9FF'],
});

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export function SkeletonLoader({
    width = '100%',
    height = 16,
    borderRadius = 8,
    style,
}: SkeletonProps) {
    useEffect(() => { ensureAnimationStarted(); }, []);

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: sharedBg,
                },
                style,
            ]}
        />
    );
}

/** Pre-built skeleton cards for common patterns */
export function SkeletonCard({ style }: { style?: ViewStyle }) {
    return (
        <View style={[skStyles.card, style]}>
            <View style={skStyles.row}>
                <SkeletonLoader width={44} height={44} borderRadius={12} />
                <View style={skStyles.textCol}>
                    <SkeletonLoader width="70%" height={14} />
                    <SkeletonLoader width="50%" height={12} style={{ marginTop: 8 }} />
                </View>
                <SkeletonLoader width={60} height={24} borderRadius={12} />
            </View>
        </View>
    );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
    return (
        <View style={skStyles.list}>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} />
            ))}
        </View>
    );
}

const skStyles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        marginBottom: 8,
        shadowColor: '#0077B6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    textCol: {
        flex: 1,
    },
    list: {
        gap: 8,
    },
});
