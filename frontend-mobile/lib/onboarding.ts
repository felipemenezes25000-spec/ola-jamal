import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@renoveja:onboarding_done_v1';

export async function isOnboardingDone(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return true; // em caso de erro de leitura, não bloquear o usuário
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {
    // silencioso — não crítico
  }
}
