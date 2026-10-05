/**
 * Charte graphique de l'application
 * 60% Blanc / 30% Bleu / 10% Vert
 * Police : Nunito
 */

import '@/global.css';

import { Platform } from 'react-native';

// 🎨 Palette de couleurs
const Palette = {
  // 60% — Blanc et nuances claires
  white: '#FFFFFF',
  offWhite: '#F7F9FC',
  lightGray: '#EEF2F7',

  // 30% — Bleus (interface, accents principaux)
  blueLight: '#5B9BD5',
  blue: '#2E6FB7',
  blueDark: '#1E4D82',
  blueSoft: '#D6E4F0',

  // 10% — Vert (validation, statut actif)
  green: '#2ECC71',
  greenDark: '#27AE60',
  greenSoft: '#D5F4E6',

  // Neutres (texte, bordures)
  textPrimary: '#1A1A1A',
  textSecondary: '#5A6472',
  textLight: '#9CA3AF',
  border: '#E2E8F0',

  // États
  error: '#E74C3C',
  warning: '#F39C12',
} as const;

// 🌗 Thème clair (le seul utilisé pour l'instant)
export const Colors = {
  light: {
    // Fonds
    background: Palette.white,
    backgroundElement: Palette.offWhite,
    backgroundSelected: Palette.blueSoft,

    // Textes
    text: Palette.textPrimary,
    textSecondary: Palette.textSecondary,

    // Accents
    primary: Palette.blue,
    primaryDark: Palette.blueDark,
    primaryLight: Palette.blueLight,
    success: Palette.green,
    successDark: Palette.greenDark,

    // Bordures
    border: Palette.border,

    // États
    error: Palette.error,
    warning: Palette.warning,
  },
  dark: {
    // On garde les mêmes pour l'instant (on gèrera le mode sombre plus tard)
    background: Palette.white,
    backgroundElement: Palette.offWhite,
    backgroundSelected: Palette.blueSoft,
    text: Palette.textPrimary,
    textSecondary: Palette.textSecondary,
    primary: Palette.blue,
    primaryDark: Palette.blueDark,
    primaryLight: Palette.blueLight,
    success: Palette.green,
    successDark: Palette.greenDark,
    border: Palette.border,
    error: Palette.error,
    warning: Palette.warning,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// 🔤 Polices Nunito (A9)
export const Fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
} as const;

// 📏 Espacements
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
export const MaxContentWidth = 800;