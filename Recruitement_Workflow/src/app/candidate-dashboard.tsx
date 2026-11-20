import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getCandidateProfile, type CandidateProfile } from '@/services/candidate-auth.service';
import { removeCandidateToken } from '@/services/candidate-session.service';

export default function CandidateDashboardScreen() {
  const theme = useTheme();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      setProfile(await getCandidateProfile());
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        await removeCandidateToken();
        router.replace('/candidate-login');
        return;
      }
      const message = isAxiosError(error) ? error.response?.data?.message : null;
      setErrorMessage(message ?? 'Unable to load your candidate profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadProfile(); }, [loadProfile]));

  async function signOut() {
    await removeCandidateToken();
    router.replace('/candidate-login');
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text>
            <Text style={[styles.title, { color: theme.text }]}>Your dashboard</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={[styles.signOut, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text }}>Sign out</Text>
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={theme.primary} /> : errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : profile ? (
          <View style={styles.profile}>
            <Text style={[styles.welcome, { color: theme.text }]}>Welcome, {profile.first_name}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>{profile.email}</Text>
            {profile.organization_slug ? <Text style={[styles.detail, { color: theme.textSecondary }]}>Organization: {profile.organization_slug}</Text> : null}
            <Text style={[styles.note, { color: theme.textSecondary }]}>Explore published openings from your organization and apply when you find the right fit.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-jobs')} style={[styles.jobsButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.jobsButtonText, { color: theme.primaryText }]}>Browse published jobs</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-applications')} style={[styles.applicationsButton, { borderColor: theme.border }]}>
              <Text style={[styles.applicationsButtonText, { color: theme.text }]}>My applications</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-offers')} style={[styles.applicationsButton, { borderColor: theme.border }]}>
              <Text style={[styles.applicationsButtonText, { color: theme.text }]}>My offers</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-onboarding')} style={[styles.applicationsButton, { borderColor: theme.border }]}>
              <Text style={[styles.applicationsButtonText, { color: theme.text }]}>My onboarding</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 760, alignSelf: 'center', borderWidth: 1, borderRadius: 22, padding: 24, gap: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '800' },
  signOut: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  profile: { gap: 9 },
  welcome: { fontSize: 20, fontWeight: '700' },
  detail: { fontSize: 14 },
  note: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  jobsButton: { alignSelf: 'flex-start', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 13, marginTop: 10 },
  jobsButtonText: { fontSize: 14, fontWeight: '700' },
  applicationsButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 13 },
  applicationsButtonText: { fontSize: 14, fontWeight: '700' },
  error: { color: '#B42318', fontSize: 14 },
});
