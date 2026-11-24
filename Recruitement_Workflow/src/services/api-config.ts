import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiBaseUrl } from './api-config.mjs';

function getConfiguredApiUrl(): string | undefined {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (process.env.NODE_ENV === 'production' || Platform.OS === 'web') return configured;
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(configured)) return configured;

  // Expo's dev-server host lets physical devices and emulators reach the
  // developer machine without committing a machine-specific LAN address.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    try {
      const host = new URL(`http://${hostUri}`).hostname;
      if (host) return `http://${host}:5000/api`;
    } catch {
      // Fall back to the configured localhost URL if Expo does not expose a valid dev host.
    }
  }
  return configured;
}

export const API_BASE_URL = resolveApiBaseUrl(getConfiguredApiUrl());
