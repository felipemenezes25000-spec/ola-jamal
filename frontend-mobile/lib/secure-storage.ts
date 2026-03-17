/**
 * secure-storage.ts — Secure token storage using expo-secure-store.
 *
 * FIX M1: Migrates auth token from plain AsyncStorage (XSS-accessible on web,
 * readable by any code on device) to OS-level secure storage (Keychain on iOS,
 * EncryptedSharedPreferences on Android).
 *
 * Falls back to AsyncStorage on web/Expo Go where SecureStore is unavailable.
 * On first read, auto-migrates tokens stored in AsyncStorage to SecureStore.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isExpoGo } from './expo-go';

// SecureStore is not available in Expo Go or on web
let SecureStore: typeof import('expo-secure-store') | null = null;
if (!isExpoGo && Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module
    SecureStore = require('expo-secure-store');
  } catch {
    // Module not available — fall back to AsyncStorage
  }
}

/**
 * Reads a value from secure storage, with auto-migration from AsyncStorage.
 * If the value exists in AsyncStorage but not in SecureStore, it migrates it.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (!SecureStore) {
    return AsyncStorage.getItem(key);
  }

  try {
    const secureValue = await SecureStore.getItemAsync(key);
    if (secureValue) return secureValue;

    // Auto-migrate from AsyncStorage on first access
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue) {
      await SecureStore.setItemAsync(key, legacyValue);
      await AsyncStorage.removeItem(key);
      return legacyValue;
    }

    return null;
  } catch {
    // SecureStore failed (e.g., device locked) — fall back to AsyncStorage
    return AsyncStorage.getItem(key);
  }
}

/**
 * Stores a value in secure storage (and removes from AsyncStorage if migrating).
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (!SecureStore) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
    // Clean up legacy AsyncStorage entry if it exists
    await AsyncStorage.removeItem(key).catch(() => {});
  } catch {
    // SecureStore failed — fall back to AsyncStorage
    await AsyncStorage.setItem(key, value);
  }
}

/**
 * Removes a value from both secure storage and AsyncStorage.
 */
export async function removeSecureItem(key: string): Promise<void> {
  const promises: Promise<void>[] = [
    AsyncStorage.removeItem(key).catch(() => {}),
  ];
  if (SecureStore) {
    promises.push(SecureStore.deleteItemAsync(key).catch(() => {}));
  }
  await Promise.all(promises);
}
