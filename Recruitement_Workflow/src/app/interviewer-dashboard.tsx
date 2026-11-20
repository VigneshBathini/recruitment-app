import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getInterviews, type Interview } from '@/services/interview-management.service';
import { logoutUser } from '@/services/auth.service';

function scheduleParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: 'Date unavailable', time: 'Time unavailable' };
  return {
    date: date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

export default function InterviewerDashboard() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [rows, setRows] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const wide = width >= 760;

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setRows(await getInterviews());
    } catch {
      setError('Unable to load your assigned interviews. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      router.replace('/login');
    } catch {
      Alert.alert('Sign out failed', 'Unable to sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  const metrics = [
    { label: 'Total assigned', value: rows.length },
    { label: 'Scheduled', value: rows.filter((item) => item.status === 'SCHEDULED').length },
    { label: 'Completed', value: rows.filter((item) => item.status === 'COMPLETED').length },
    { label: 'Cancelled', value: rows.filter((item) => item.status === 'CANCELLED').length },
  ];
  const metricWidth = wide ? '23.5%' : '48%';

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}
      >
        <View style={styles.page}>
          <View style={styles.header}>
            <View style={styles.brandLockup}>
              <View style={[styles.brandMark, { backgroundColor: theme.primary }]}><ThemedText style={[styles.brandMarkText, { color: theme.primaryText }]}>R</ThemedText></View>
              <View><ThemedText style={styles.brand}>Recruitment</ThemedText><ThemedText style={[styles.caption, { color: theme.textSecondary }]}>WORKFLOW PLATFORM</ThemedText></View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Sign out" disabled={signingOut} onPress={() => void signOut()} style={[styles.signOut, { borderColor: theme.border }]}>
              {signingOut ? <ActivityIndicator size="small" color={theme.primary} /> : <ThemedText>Sign out</ThemedText>}
            </Pressable>
          </View>

          <View style={styles.hero}>
            <ThemedText style={styles.eyebrow}>INTERVIEWER WORKSPACE</ThemedText>
            <ThemedText style={styles.title}>My interviews</ThemedText>
            <ThemedText style={styles.subtitle}>Review your assigned interviews and open a record to view details or submit feedback.</ThemedText>
          </View>

          <View style={styles.sectionHeading}>
            <View style={styles.headingCopy}>
              <ThemedText style={styles.sectionTitle}>Interview overview</ThemedText>
              <ThemedText style={[styles.sectionCaption, { color: theme.textSecondary }]}>Counts reflect interviews assigned to you.</ThemedText>
            </View>
            <Pressable accessibilityRole="button" disabled={loading || refreshing} onPress={() => void load(true)} style={[styles.refreshButton, { borderColor: theme.border }]}>
              <ThemedText>{loading || refreshing ? 'Refreshing…' : 'Refresh'}</ThemedText>
            </Pressable>
          </View>

          {loading && rows.length === 0 ? (
            <View style={styles.state}><ActivityIndicator color={theme.primary} /><ThemedText style={{ color: theme.textSecondary }}>Loading assigned interviews…</ThemedText></View>
          ) : null}

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: theme.dangerBackground }]}>
              <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retryButton}><ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Try again</ThemedText></Pressable>
            </View>
          ) : null}

          {!loading && !error && rows.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText style={styles.emptyTitle}>No assigned interviews</ThemedText>
              <ThemedText style={[styles.sectionCaption, { color: theme.textSecondary }]}>Interviews assigned to you will appear here.</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => void load(true)} style={[styles.refreshButton, { borderColor: theme.border }]}><ThemedText>Refresh list</ThemedText></Pressable>
            </View>
          ) : null}

          {!loading && !error ? (
            <View style={styles.metrics}>
              {metrics.map((metric) => <ThemedView key={metric.label} style={[styles.metricCard, { width: metricWidth, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText style={[styles.metricValue, { color: theme.primary }]}>{metric.value}</ThemedText>
                <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>{metric.label}</ThemedText>
              </ThemedView>)}
            </View>
          ) : null}

          {rows.length > 0 ? <>
            <View style={styles.listSection}>
              <View><ThemedText style={styles.sectionTitle}>Assigned interview list</ThemedText><ThemedText style={[styles.sectionCaption, { color: theme.textSecondary }]}>Select an interview to view its panel, details, and feedback.</ThemedText></View>
              {rows.map((interview) => {
                const schedule = scheduleParts(interview.scheduled_at);
                const statusColor = interview.status === 'COMPLETED' ? theme.success : interview.status === 'CANCELLED' ? theme.textSecondary : theme.primary;
                return <Pressable
                  key={interview.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/interview-details', params: { id: String(interview.id) } } as never)}
                  style={({ pressed }) => [styles.interviewCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}
                >
                  <View style={styles.interviewTop}>
                    <View style={styles.interviewCopy}>
                      <ThemedText style={styles.interviewTitle}>{interview.title}</ThemedText>
                      <ThemedText style={[styles.interviewMeta, { color: theme.textSecondary }]}>Candidate: {interview.candidate_first_name} {interview.candidate_last_name ?? ''}</ThemedText>
                      <ThemedText style={[styles.interviewMeta, { color: theme.textSecondary }]}>Job: {interview.job_title}</ThemedText>
                    </View>
                    <ThemedText style={[styles.status, { color: statusColor }]}>{interview.status.replace(/_/g, ' ')}</ThemedText>
                  </View>
                  <View style={[styles.schedule, { borderTopColor: theme.border }]}>
                    <ThemedText style={[styles.interviewMeta, { color: theme.textSecondary }]}>{schedule.date}</ThemedText>
                    <ThemedText style={[styles.interviewMeta, { color: theme.textSecondary }]}>{schedule.time}</ThemedText>
                  </View>
                </Pressable>;
              })}
            </View>
          </> : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five },
  page: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontSize: 22, fontWeight: '800' },
  brand: { fontSize: 16, lineHeight: 19, fontWeight: '700' },
  caption: { fontSize: 9, lineHeight: 14, letterSpacing: 1.15, fontWeight: '700' },
  signOut: { minHeight: 42, paddingHorizontal: 15, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 22, padding: 25, backgroundColor: '#1C2340', gap: 9 },
  eyebrow: { color: '#BFC2FF', fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  title: { color: '#FFFFFF', fontSize: 29, lineHeight: 36, fontWeight: '800' },
  subtitle: { color: '#C4C9DB', fontSize: 14, lineHeight: 21, maxWidth: 680 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: 19, lineHeight: 25, fontWeight: '800' },
  sectionCaption: { fontSize: 13, lineHeight: 19 },
  refreshButton: { minHeight: 40, paddingHorizontal: 13, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  metricCard: { minHeight: 104, borderWidth: 1, borderRadius: 15, padding: 15, justifyContent: 'center', gap: 6 },
  metricValue: { fontSize: 26, fontWeight: '800' },
  metricLabel: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  state: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 11 },
  errorCard: { borderRadius: 14, padding: 16, gap: 11 },
  retryButton: { alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 10 },
  emptyCard: { minHeight: 150, borderWidth: 1, borderRadius: 15, padding: 20, gap: 9, justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  listSection: { gap: 13 },
  interviewCard: { borderWidth: 1, borderRadius: 15, padding: 16, gap: 12 },
  interviewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  interviewCopy: { flex: 1, gap: 5 },
  interviewTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  interviewMeta: { fontSize: 13, lineHeight: 19 },
  status: { fontSize: 11, lineHeight: 16, fontWeight: '800', textAlign: 'right' },
  schedule: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  pressed: { opacity: 0.72 },
});
