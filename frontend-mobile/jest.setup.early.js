/**
 * Setup executado antes do framework de testes (setupFiles).
 * Mock de AsyncStorage para evitar "NativeModule: AsyncStorage is null" em testes RN.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
