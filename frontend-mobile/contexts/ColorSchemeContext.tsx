import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ColorScheme } from '../lib/designSystem';

const STORAGE_KEY = '@renoveja:color_scheme_v1';

type ColorSchemePreference = 'system' | 'light' | 'dark';

interface ColorSchemeContextValue {
  /** Scheme efetivo aplicado (nunca 'system'). */
  colorScheme: ColorScheme;
  /** Preferência do usuário (pode ser 'system'). */
  preference: ColorSchemePreference;
  setPreference: (pref: ColorSchemePreference) => void;
  isDark: boolean;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(undefined);

export function ColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? 'light';
  const [preference, setPreferenceState] = useState<ColorSchemePreference>('light');
  // Carregar preferência persistida (default: light para melhor legibilidade)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
        // Se nunca salvou, mantém 'light' (já é o default do useState)
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((pref: ColorSchemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref).catch(() => {});
  }, []);

  const colorScheme: ColorScheme = useMemo(() => {
    if (preference === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
    return preference;
  }, [preference, systemScheme]);

  const value = useMemo(
    () => ({ colorScheme, preference, setPreference, isDark: colorScheme === 'dark' }),
    [colorScheme, preference, setPreference]
  );

  return (
    <ColorSchemeContext.Provider value={value}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorSchemeContext(): ColorSchemeContextValue {
  const ctx = useContext(ColorSchemeContext);
  // Fallback seguro fora do provider (ex: storybook, testes)
  return ctx ?? { colorScheme: 'light', preference: 'system', setPreference: () => {}, isDark: false };
}
