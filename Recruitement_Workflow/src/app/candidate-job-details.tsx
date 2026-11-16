import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getCandidateOrganizationSlug } from '@/services/candidate-session.service';
import { applyToPublishedJob, getPublishedJob, type PublishedJob } from '@/services/candidate-jobs.service';

function formatPublishedDate(value: string | null) {
  if (!value) return 'Recently published';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently published' : `Published ${date.toLocaleDateString()}`;
}

export default function CandidateJobDetailsScreen() {
  const theme = useTheme();
  const { jobId: rawJobId } = useLocalSearchParams<{ jobId: string }>();
  const jobId = Number(rawJobId);
  const [job, setJob] = useState<PublishedJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  const loadJob = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      if (!Number.isSafeInteger(jobId) || jobId <= 0) throw new Error('Invalid job ID.');
      const organizationSlug = await getCandidateOrganizationSlug();
      if (!organizationSlug) throw new Error('Your organization session is missing. Sign in again to view this job.');
      setJob(await getPublishedJob(organizationSlug, jobId));
    } catch (error) {
      const message = isAxiosError(error) ? error.response?.data?.message : null;
      setErrorMessage(message ?? (error instanceof Error ? error.message : 'Unable to load job details.'));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useFocusEffect(useCallback(() => { void loadJob(); }, [loadJob]));

  async function apply() {
    setApplying(true);
    setApplicationMessage('');
    try {
      await applyToPublishedJob(jobId);
      setApplicationMessage('Your application has been submitted successfully.');
      setAlreadyApplied(true);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setAlreadyApplied(true);
        setApplicationMessage(error.response.data?.message ?? 'You have already applied to this job.');
      } else {
        const message = isAxiosError(error) ? error.response?.data?.message : null;
        setApplicationMessage(message ?? 'Unable to submit your application. Check your connection and try again.');
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <View style={styles.page}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backLink}>
          <Text style={[styles.backText, { color: theme.primary }]}>← Back to jobs</Text>
        </Pressable>
        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading job details…</Text></View> : errorMessage ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={styles.error}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadJob()} style={[styles.button, { backgroundColor: theme.primary }]}>
              <Text style={[styles.buttonText, { color: theme.primaryText }]}>Try again</Text>
            </Pressable>
          </View>
        ) : job ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>PUBLISHED OPPORTUNITY</Text>
            <Text style={[styles.title, { color: theme.text }]}>{job.title}</Text>
            <Text style={[styles.date, { color: theme.textSecondary }]}>{formatPublishedDate(job.published_at)}</Text>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <Text style={[styles.description, { color: theme.text }]}>{job.jd_content}</Text>
            {applicationMessage ? <Text accessibilityRole="alert" style={alreadyApplied ? [styles.success, { color: theme.primary }] : styles.error}>{applicationMessage}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void apply()}
              disabled={applying || alreadyApplied}
              style={[styles.button, { backgroundColor: alreadyApplied ? theme.border : theme.primary }, (applying || alreadyApplied) && styles.disabled]}
            >
              {applying ? <ActivityIndicator color={theme.primaryText} /> : <Text style={[styles.buttonText, { color: theme.primaryText }]}>{alreadyApplied ? 'Application submitted' : 'Apply for this job'}</Text>}
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22 },
  page: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 16 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 7 },
  backText: { fontSize: 14, fontWeight: '700' },
  state: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: { borderWidth: 1, borderRadius: 19, padding: 24, gap: 16 },
  eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '800' },
  date: { fontSize: 13 },
  divider: { height: 1, marginVertical: 2 },
  description: { fontSize: 15, lineHeight: 24 },
  button: { minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 5 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.7 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 21 },
  success: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
});
