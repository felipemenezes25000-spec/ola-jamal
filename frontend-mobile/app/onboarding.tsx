import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { gradients, spacing, borderRadius } from '../lib/theme';
import { useAppTheme } from '../lib/ui/useAppTheme';
import type { DesignColors } from '../lib/designSystem';
import { markOnboardingDone } from '../lib/onboarding';
import { haptics } from '../lib/haptics';

const { width: SCREEN_W } = Dimensions.get('window');

interface Step {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
}

function makeSteps(colors: DesignColors): Step[] {
  return [
    {
      icon: 'heart-outline',
      iconColor: colors.primary,
      title: 'Bem-vindo à RenoveJá+',
      subtitle:
        'Sua saúde em dia, sem sair de casa. Solicite receitas, exames e consultas médicas com praticidade e segurança.',
    },
    {
      icon: 'document-text-outline',
      iconColor: colors.success,
      title: 'Solicitações em minutos',
      subtitle:
        'Envie sua solicitação com foto da receita ou descrição dos sintomas. Nossos médicos analisam e respondem rapidamente.',
    },
    {
      icon: 'shield-checkmark-outline',
      iconColor: colors.accent,
      title: 'Seguro e confiável',
      subtitle:
        'Documentos assinados digitalmente por médicos certificados. Receitas e laudos com validade jurídica.',
    },
    {
      icon: 'notifications-outline',
      iconColor: colors.warning,
      title: 'Acompanhe em tempo real',
      subtitle:
        'Receba notificações a cada etapa: aprovação, assinatura e entrega do documento final.',
    },
  ];
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const STEPS = useMemo(() => makeSteps(colors), [colors]);
  const [currentStep, setCurrentStep] = useState(0);

  const isLast = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  const goNext = async () => {
    haptics.selection();
    if (isLast) {
      await markOnboardingDone();
      router.replace('/(auth)/login');
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const skip = async () => {
    haptics.light();
    await markOnboardingDone();
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={gradients.patientHeader as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.topGradient, { paddingTop: insets.top + 16 }]}
      >
        {/* Skip */}
        {!isLast && (
          <Pressable
            style={styles.skipBtn}
            onPress={skip}
            accessibilityRole="button"
            accessibilityLabel="Pular introdução"
          >
            <Text style={styles.skipText}>Pular</Text>
          </Pressable>
        )}

        {/* Ícone central */}
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { backgroundColor: step.iconColor + '20' }]}>
            <Ionicons name={step.icon} size={52} color={step.iconColor} />
          </View>
        </View>
      </LinearGradient>

      {/* Conteúdo */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>

        {/* Dots */}
        <View style={styles.dots} accessibilityLabel={`Passo ${currentStep + 1} de ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentStep && styles.dotActive]}
            />
          ))}
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaBtn,
            pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
          ]}
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Começar a usar o aplicativo' : 'Próximo passo'}
        >
          <Text style={styles.ctaText}>
            {isLast ? 'Começar' : 'Próximo'}
          </Text>
          <Ionicons
            name={isLast ? 'rocket-outline' : 'arrow-forward'}
            size={18}
            color={colors.white}
          />
        </Pressable>

        {/* Login link */}
        <Text style={styles.loginHint}>
          Já tem conta?{' '}
          <Text
            style={styles.loginLink}
            onPress={async () => {
              await markOnboardingDone();
              router.replace('/(auth)/login');
            }}
            accessibilityRole="link"
          >
            Entrar
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topGradient: {
    alignItems: 'center',
    paddingBottom: 40,
    minHeight: 280,
    justifyContent: 'flex-end',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  skipText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 32,
    gap: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: SCREEN_W - 80,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    minHeight: 54,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  loginHint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  loginLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  });
}
