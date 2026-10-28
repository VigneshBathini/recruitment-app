/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#172033',
    background: '#F5F7FB',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EEF0FF',
    textSecondary: '#667085',
    border: '#E4E8F0',
    primary: '#4F46E5',
    primaryText: '#FFFFFF',
    primaryMuted: '#EEEEFF',
    success: '#16794A',
    successBackground: '#E9F8EF',
    danger: '#B42318',
    dangerBackground: '#FEE4E2',
  },
  dark: {
    text: '#F3F5FC',
    background: '#10131D',
    backgroundElement: '#191E2B',
    backgroundSelected: '#292D4A',
    textSecondary: '#A5AEC1',
    border: '#2B3243',
    primary: '#8B86FF',
    primaryText: '#111326',
    primaryMuted: '#292D4A',
    success: '#75D6A4',
    successBackground: '#19392D',
    danger: '#FDA29B',
    dangerBackground: '#442624',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 1120;
