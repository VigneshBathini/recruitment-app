import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getCandidateOrganizationSlug } from '@/services/candidate-session.service';
import { getPublishedJobs, type PublishedJob } from '@/services/candidate-jobs.service';

function formatPublishedDate(value: string | null) {
  if (!value) return 'Recently published';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently published' : `Published ${date.toLocaleDateString()}`;
}

function jobExcerpt(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}…` : normalized;
}

export default function CandidateJobsScreen() {
  const theme = useTheme();
  const [jobs, setJobs] = useState<PublishedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadJobs = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage('');
    try {
      const organizationSlug = await getCandidateOrganizationSlug();
      if (!organizationSlug) {
        setErrorMessage('Your organization session is missing. Sign in again to browse its jobs.');
        setJobs([]);
        return;
      }
      setJobs(await getPublishedJobs(organizationSlug));
    } catch (error) {
      const message = isAxiosError(error) ? error.response?.data?.message : null;
      setErrorMessage(message ?? 'Unable to load published jobs. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadJobs(); }, [loadJobs]));

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadJobs(true)} tintColor={theme.primary} />}
    >
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text>
            <Text style={[styles.title, { color: theme.text }]}>Published jobs</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Opportunities published by your organization.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-dashboard')} style={[styles.backButton, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text }}>Dashboard</Text>
          </Pressable>
        </View>

        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading jobs…</Text></View> : errorMessage ? (
          <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={styles.error}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadJobs()} style={[styles.actionButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.actionText, { color: theme.primaryText }]}>Try again</Text>
            </Pressable>
          </View>
        ) : jobs.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No published jobs yet</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Check back later for new opportunities.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {jobs.map((job) => (
              <Pressable
                accessibilityRole="button"
                key={job.id}
                onPress={() => router.push({ pathname: '/candidate-job-details', params: { jobId: String(job.id) } })}
                style={({ pressed }) => [styles.jobCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.jobTitle, { color: theme.text }]}>{job.title}</Text>
                <Text style={[styles.excerpt, { color: theme.textSecondary }]}>{jobExcerpt(job.jd_content)}</Text>
                <Text style={[styles.date, { color: theme.primary }]}>{formatPublishedDate(job.published_at)}</Text>
                <Text style={[styles.viewLink, { color: theme.primary }]}>View details →</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22 },
  page: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  heading: { flex: 1, gap: 7 },
  eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  backButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateCard: { borderWidth: 1, borderRadius: 18, padding: 24, gap: 14, alignItems: 'flex-start' },
  error: { color: '#B42318', fontSize: 14, lineHeight: 21 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  actionButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10 },
  actionText: { fontSize: 14, fontWeight: '700' },
  list: { gap: 13 },
  jobCard: { borderWidth: 1, borderRadius: 17, padding: 19, gap: 10 },
  jobTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  excerpt: { fontSize: 14, lineHeight: 21 },
  date: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  viewLink: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  pressed: { opacity: 0.75 },
});
