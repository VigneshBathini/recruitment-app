import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const CANDIDATE_TOKEN_KEY = 'recruitment_candidate_access_token';
const CANDIDATE_ORGANIZATION_SLUG_KEY = 'recruitment_candidate_organization_slug';

export async function saveCandidateToken(token: string, organizationSlug?: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage === 'undefined') throw new Error('Browser session storage is unavailable');
    sessionStorage.setItem(CANDIDATE_TOKEN_KEY, token);
    if (organizationSlug) sessionStorage.setItem(CANDIDATE_ORGANIZATION_SLUG_KEY, organizationSlug);
    return;
  }
  await SecureStore.setItemAsync(CANDIDATE_TOKEN_KEY, token);
  if (organizationSlug) await SecureStore.setItemAsync(CANDIDATE_ORGANIZATION_SLUG_KEY, organizationSlug);
}

export async function getCandidateToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(CANDIDATE_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(CANDIDATE_TOKEN_KEY);
}

export async function getCandidateOrganizationSlug(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(CANDIDATE_ORGANIZATION_SLUG_KEY);
  }
  return SecureStore.getItemAsync(CANDIDATE_ORGANIZATION_SLUG_KEY);
}

export async function removeCandidateToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(CANDIDATE_TOKEN_KEY);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(CANDIDATE_ORGANIZATION_SLUG_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(CANDIDATE_TOKEN_KEY);
  await SecureStore.deleteItemAsync(CANDIDATE_ORGANIZATION_SLUG_KEY);
}
