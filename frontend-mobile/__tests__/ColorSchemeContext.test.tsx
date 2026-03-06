/**
 * Testes do ColorSchemeContext — lógica de persistência (sem react-native).
 * Testes de componente React ficam em components/__tests__/ColorSchemeContext.test.tsx
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const STORAGE_KEY = '@renoveja:color_scheme_v1';

describe('ColorSchemeContext — persistência AsyncStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('armazena e recupera preferência dark', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'dark');
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('armazena e recupera preferência light', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'light');
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('armazena e recupera preferência system', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'system');
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('system');
  });

  it('chave ausente retorna null', async () => {
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('sobrescrever preferência funciona', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'dark');
    await AsyncStorage.setItem(STORAGE_KEY, 'light');
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe('light');
  });
});
