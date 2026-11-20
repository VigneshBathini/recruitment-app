import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getCandidateProfile, type CandidateProfile } from '@/services/candidate-auth.service';
import { removeCandidateToken } from '@/services/candidate-session.service';
import { getMyApplications, type CandidateApplication } from '@/services/candidate-jobs.service';
import { getMyOffers, type CandidateOffer } from '@/services/candidate-offers.service';
import { getMyOnboarding, getMyOnboardingRecord } from '@/services/candidate-onboarding.service';
import type { OnboardingDocument, OnboardingRecord, OnboardingTask } from '@/services/onboarding-management.service';

type OnboardingDetails = OnboardingRecord & { tasks?: OnboardingTask[]; documents?: OnboardingDocument[] };

function readable(value: string | null | undefined) {
  if (!value) return 'Not set';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CandidateDashboardScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const wide = width >= 760;

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage('');
    try {
      const [nextProfile, nextApplications, nextOffers, onboardingRecords] = await Promise.all([
        getCandidateProfile(), getMyApplications(), getMyOffers(), getMyOnboarding(),
      ]);
      const onboardingDetails = await Promise.all(onboardingRecords.map((record) => getMyOnboardingRecord(record.id)));
      setProfile(nextProfile);
      setApplications(nextApplications);
      setOffers(nextOffers);
      setOnboarding(onboardingDetails as OnboardingDetails[]);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        await removeCandidateToken();
        router.replace('/candidate-login');
        return;
      }
      const message = isAxiosError(error) ? error.response?.data?.message : null;
      setErrorMessage(message ?? 'Unable to load your dashboard. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadDashboard(); }, [loadDashboard]));

  async function signOut() {
    await removeCandidateToken();
    router.replace('/candidate-login');
  }

  const applicationStatuses = applications.reduce<Record<string, number>>((counts, application) => {
    const status = application.status || application.current_stage || 'UNKNOWN';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const stageCounts = applications.reduce<Record<string, number>>((counts, application) => {
    if (!application.current_stage) return counts;
    counts[application.current_stage] = (counts[application.current_stage] ?? 0) + 1;
    return counts;
  }, {});
  const pendingOfferCount = offers.filter((offer) => offer.status === 'ISSUED' && !offer.candidate_responded_at).length;
  const acceptedOfferCount = offers.filter((offer) => offer.status === 'ACCEPTED').length;
  const pendingTaskCount = onboarding.flatMap((record) => record.tasks ?? []).filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS').length;
  const pendingDocumentCount = onboarding.flatMap((record) => record.documents ?? []).filter((document) => document.review_status === 'PENDING').length;
  const metricWidth = wide ? '23.5%' : '48%';
  const hasData = applications.length > 0 || offers.length > 0 || onboarding.length > 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={theme.primary} />}
    >
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text>
            <Text style={[styles.title, { color: theme.text }]}>Your dashboard</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={[styles.outlineButton, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text }}>Sign out</Text>
          </Pressable>
        </View>

        {loading && !profile ? (
          <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading your dashboard…</Text></View>
        ) : errorMessage ? (
          <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={styles.error}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadDashboard()} style={[styles.actionButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.actionText, { color: theme.primaryText }]}>Try again</Text>
            </Pressable>
          </View>
        ) : profile ? (
          <>
            <View style={[styles.profileCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Text style={[styles.welcome, { color: theme.text }]}>Welcome, {profile.first_name}</Text>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>{profile.email}</Text>
              {profile.organization_slug ? <Text style={[styles.detail, { color: theme.textSecondary }]}>Organization: {profile.organization_slug}</Text> : null}
              <Text style={[styles.note, { color: theme.textSecondary }]}>Explore published openings from your organization and apply when you find the right fit.</Text>
              <View style={styles.navigation}>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-jobs')} style={[styles.actionButton, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.actionText, { color: theme.primaryText }]}>Browse published jobs</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-applications')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My applications</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-offers')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My offers</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-onboarding')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My onboarding</Text></Pressable>
              </View>
            </View>

            {!loading && !errorMessage ? (
              <>
                <View style={styles.sectionHeading}>
                  <View style={styles.heading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Your progress</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Summaries for your applications, offers, and onboarding.</Text></View>
                  <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void loadDashboard(true)} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text></Pressable>
                </View>

                <View style={styles.metrics}>
                  {[
                    { label: 'Total applications', value: applications.length },
                    { label: 'Pending offer responses', value: pendingOfferCount },
                    { label: 'Accepted offers', value: acceptedOfferCount },
                    { label: 'Pending onboarding tasks', value: pendingTaskCount },
                    { label: 'Documents awaiting review', value: pendingDocumentCount },
                  ].map((metric) => <View key={metric.label} style={[styles.metricCard, { width: metricWidth, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <Text style={[styles.metricValue, { color: theme.primary }]}>{metric.value}</Text><Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{metric.label}</Text>
                  </View>)}
                </View>

                <View style={[styles.summaryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Applications by status</Text>
                  {Object.keys(applicationStatuses).length ? Object.entries(applicationStatuses).map(([status, count]) => <View key={status} style={styles.countRow}><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(status)}</Text><Text style={[styles.summaryValue, { color: theme.text }]}>{count}</Text></View>) : <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No application status information yet.</Text>}
                  {Object.keys(stageCounts).length ? <><Text style={[styles.subheading, { color: theme.text }]}>Current stage</Text>{Object.entries(stageCounts).map(([stage, count]) => <View key={stage} style={styles.countRow}><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(stage)}</Text><Text style={[styles.summaryValue, { color: theme.text }]}>{count}</Text></View>)}</> : null}
                </View>

                <View style={styles.columns}>
                  <View style={[styles.summaryCard, styles.column, wide ? styles.columnWide : styles.columnNarrow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <View style={styles.cardHeading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Recent applications</Text><Pressable onPress={() => router.push('/candidate-applications')}><Text style={{ color: theme.primary, fontWeight: '700' }}>View all</Text></Pressable></View>
                    {applications.slice(0, 4).map((application) => <Pressable key={application.id} onPress={() => router.push({ pathname: '/candidate-job-details', params: { jobId: String(application.job_id) } })} style={[styles.listItem, { borderTopColor: theme.border }]}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{application.job_title}</Text><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(application.status)} · Applied {formatDate(application.applied_at)}</Text>
                    </Pressable>)}
                    {applications.length === 0 ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No applications yet. Browse jobs to get started.</Text> : null}
                  </View>

                  <View style={[styles.summaryCard, styles.column, wide ? styles.columnWide : styles.columnNarrow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <View style={styles.cardHeading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Offers</Text><Pressable onPress={() => router.push('/candidate-offers')}><Text style={{ color: theme.primary, fontWeight: '700' }}>View all</Text></Pressable></View>
                    {offers.slice(0, 3).map((offer) => <Pressable key={offer.id} onPress={() => router.push({ pathname: '/candidate-offer-details', params: { offerId: String(offer.id) } })} style={[styles.listItem, { borderTopColor: theme.border }]}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{offer.job_title}</Text><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(offer.status)} · {offer.currency} {offer.annual_ctc}</Text>
                    </Pressable>)}
                    {offers.length === 0 ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No offers are available yet.</Text> : null}
                  </View>
                </View>

                <View style={[styles.summaryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <View style={styles.cardHeading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Onboarding</Text><Pressable onPress={() => router.push('/candidate-onboarding')}><Text style={{ color: theme.primary, fontWeight: '700' }}>View all</Text></Pressable></View>
                  {onboarding.length ? onboarding.map((record) => {
                    const tasks = record.tasks ?? [];
                    const pendingTasks = tasks.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS').length;
                    const waitingDocuments = (record.documents ?? []).filter((document) => document.review_status === 'PENDING').length;
                    return <Pressable key={record.id} onPress={() => router.push({ pathname: '/candidate-onboarding-details', params: { onboardingId: String(record.id) } })} style={[styles.listItem, { borderTopColor: theme.border }]}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{record.job_title} · {readable(record.status)}</Text>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Joining date: {formatDate(record.target_join_date)} · {pendingTasks} pending tasks · {waitingDocuments} documents awaiting review</Text>
                    </Pressable>;
                  }) : <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Onboarding progress will appear here when a record is available.</Text>}
                </View>

                {!hasData ? <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>No recruitment activity yet</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Browse published jobs to find an opportunity and track your progress here.</Text></View> : null}
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, paddingBottom: 36 },
  page: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  heading: { flex: 1, gap: 6 },
  eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  outlineButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  state: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateCard: { borderWidth: 1, borderRadius: 17, padding: 20, gap: 12 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 21 },
  profileCard: { borderWidth: 1, borderRadius: 20, padding: 22, gap: 9 },
  welcome: { fontSize: 21, fontWeight: '700' },
  detail: { fontSize: 14 },
  note: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  actionButton: { minHeight: 42, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 11 },
  actionText: { fontSize: 14, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  metricCard: { minHeight: 100, borderWidth: 1, borderRadius: 15, padding: 15, justifyContent: 'center', gap: 6 },
  metricValue: { fontSize: 25, fontWeight: '800' },
  metricLabel: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  summaryCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 11 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  summaryLabel: { fontSize: 13, lineHeight: 19 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  subheading: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  column: { flexGrow: 1 },
  columnWide: { flexBasis: 320 },
  columnNarrow: { flexBasis: '100%' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  listItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, gap: 4 },
  itemTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
});
