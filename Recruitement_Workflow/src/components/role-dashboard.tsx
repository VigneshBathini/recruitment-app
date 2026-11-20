import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser, logoutUser } from '@/services/auth.service';
import type { OrganizationContext } from '@/services/token.service';
import { getPendingRequirements, getRequirements } from '@/services/requirement.service';
import type { Requirement } from '@/services/requirement.service';
import { getApplicationCounts, getApplications, getApplicationReviewQueue } from '@/services/application-management.service';
import type { ApplicationCounts, ManagedApplication, ReviewQueueItem } from '@/services/application-management.service';

const modules = [
  { title: 'Requirements', key: 'requirement', permission: 'requirement.view', icon: 'R' },
  { title: 'Jobs', key: 'job', permission: 'job.view', icon: 'J' },
  { title: 'Candidates', key: 'candidate', permission: 'candidate.view', icon: 'C' },
  { title: 'Applications', key: 'application', permission: 'application.view', icon: 'A' },
  { title: 'Application review', key: 'application-review', permission: 'application.review', icon: 'D' },
  { title: 'Interviews', key: 'interview', permission: 'interview.view', icon: 'I' },
  { title: 'Offers', key: 'offer', permission: 'offer.view', icon: 'O' },
  { title: 'Onboarding', key: 'onboarding', permission: 'onboarding.view', icon: 'N' },
];

type RecruiterData = {
  counts: ApplicationCounts;
  rejected: number;
  recent: ManagedApplication[];
};

export function RoleDashboard({ role }: { role: 'Recruiter' | 'Hiring Manager' | 'Interviewer' }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [context, setContext] = useState<OrganizationContext | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [recruiterData, setRecruiterData] = useState<RecruiterData | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const wide = width >= 760;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const current = await getCurrentOrganizationUser();
      const permissions = current.permissions;
      setContext(current);
      const canViewRequirements = permissions.includes('requirement.view') || permissions.includes('requirement.manage');
      const canApproveRequirements = permissions.includes('requirement.approve');
      const canViewApplications = permissions.includes('application.view');
      const canReviewApplications = permissions.includes('application.review');

      const [requirementRows, nextRecruiterData, nextReviewQueue] = await Promise.all([
        canViewRequirements
          ? getRequirements()
          : canApproveRequirements
            ? getPendingRequirements()
            : Promise.resolve([] as Requirement[]),
        role === 'Recruiter' && canViewApplications
          ? Promise.all([
            getApplicationCounts(),
            getApplications({ page: 1, page_size: 5 }),
            getApplications({ status: 'REJECTED', page: 1, page_size: 1 }),
          ]).then(([counts, recent, rejected]) => ({ counts, recent: recent.items, rejected: rejected.total }))
          : Promise.resolve(null),
        role === 'Hiring Manager' && canReviewApplications
          ? getApplicationReviewQueue()
          : Promise.resolve([] as ReviewQueueItem[]),
      ]);

      setRequirements(requirementRows);
      setRecruiterData(nextRecruiterData);
      setReviewQueue(nextReviewQueue);
    } catch (problem) {
      console.error('Unable to load dashboard data:', problem);
      setError('Unable to load dashboard data. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useFocusEffect(useCallback(() => { void loadDashboard(); }, [loadDashboard]));

  const permittedModules = modules.filter((item) => context?.permissions.some((permission) =>
    permission === item.permission || permission === `${item.key}.manage` || permission === `${item.key}.approve` || (item.key === 'onboarding' && (permission === 'onboarding.document.review' || permission === 'onboarding.complete')),
  ));
  const canListRequirements = context?.permissions.includes('requirement.view') || context?.permissions.includes('requirement.manage');
  const requirementMetrics = [
    { label: 'Approved requirements', value: canListRequirements ? String(requirements.filter((item) => item.status === 'APPROVED').length) : '—' },
    { label: 'Pending approval', value: String(requirements.filter((item) => item.status === 'PENDING_APPROVAL').length) },
  ];
  const recruiterMetrics = recruiterData ? [
    { label: 'Total applications', value: String(recruiterData.counts.total) },
    { label: 'Screening', value: String(recruiterData.counts.screening) },
    { label: 'Shortlisted', value: String(recruiterData.counts.shortlisted) },
    { label: 'Rejected', value: String(recruiterData.rejected) },
    { label: 'Hired', value: String(recruiterData.counts.hired) },
  ] : [];
  const feedbackAvailableCount = reviewQueue.filter((item) => item.feedback_available).length;
  const completedInterviewCount = reviewQueue.reduce((sum, item) => sum + item.completed_interview_count, 0);
  const canShowRequirements = context?.permissions.some((permission) => ['requirement.view', 'requirement.manage', 'requirement.approve'].includes(permission));
  const renderMetricSection = (title: string, metrics: { label: string; value: string }[]) => {
    const cardWidth = !wide ? '48%' : metrics.length >= 5 ? '18.5%' : metrics.length === 4 ? '23.5%' : metrics.length === 3 ? '31.5%' : '48%';
    return <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.stats}>{metrics.map((metric) => <View key={metric.label} style={[styles.statCard, { width: cardWidth, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <ThemedText style={[styles.statValue, { color: theme.primary }]}>{metric.value}</ThemedText><ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{metric.label}</ThemedText>
      </View>)}</View>
    </View>;
  };

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.top}>
            <View><ThemedText style={styles.brand}>Recruitment</ThemedText><ThemedText style={[styles.caption, { color: theme.textSecondary }]}>WORKFLOW PLATFORM</ThemedText></View>
            <Pressable onPress={() => void logoutUser().then(() => router.replace('/login'))} style={[styles.signOut, { borderColor: theme.border }]}><ThemedText>Sign out</ThemedText></Pressable>
          </View>
          <View style={styles.hero}>
            <ThemedText style={styles.eyebrow}>{role.toUpperCase()} WORKSPACE</ThemedText>
            <ThemedText style={styles.title}>Welcome{context ? ` to ${context.name}` : ''}</ThemedText>
            <ThemedText style={styles.subtitle}>Your recruitment work, priorities, and team tools in one place.</ThemedText>
          </View>

          {loading ? <View style={styles.state}><ActivityIndicator color={theme.primary} /><ThemedText style={{ color: theme.textSecondary }}>Loading dashboard…</ThemedText></View> : error ? (
            <View style={[styles.errorCard, { backgroundColor: theme.dangerBackground }]}>
              <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => void loadDashboard()} style={[styles.retryButton, { borderColor: theme.border }]}><ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Try again</ThemedText></Pressable>
            </View>
          ) : <>
            {canShowRequirements ? <>
              {renderMetricSection('Requirement overview', requirementMetrics)}
              {requirements.length === 0 ? <ThemedText style={[styles.empty, { color: theme.textSecondary }]}>{canListRequirements ? 'No requirements yet.' : 'No requirements are awaiting approval.'}</ThemedText> : null}
            </> : null}
            {role === 'Recruiter' && context?.permissions.includes('application.view') ? <>
              {renderMetricSection('Application pipeline', recruiterMetrics)}
              <View style={styles.section}>
                <View><ThemedText style={styles.sectionTitle}>Recent applications</ThemedText><ThemedText style={[styles.sectionCaption, { color: theme.textSecondary }]}>Latest applications in your organization.</ThemedText></View>
                {recruiterData?.recent.length ? recruiterData.recent.map((application) => (
                  <Pressable key={application.id} onPress={() => router.push({ pathname: '/application-details', params: { applicationId: String(application.id) } } as never)} style={[styles.recentCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <View style={styles.recentCopy}><ThemedText style={styles.moduleTitle}>{application.first_name} {application.last_name ?? ''}</ThemedText><ThemedText style={[styles.moduleDescription, { color: theme.textSecondary }]}>{application.job_title} · Applied {new Date(application.applied_at).toLocaleDateString()}</ThemedText></View>
                    <ThemedText style={[styles.badge, { color: theme.primary }]}>{application.status.replace(/_/g, ' ')}</ThemedText>
                  </Pressable>
                )) : <ThemedText style={[styles.empty, { color: theme.textSecondary }]}>No applications yet.</ThemedText>}
              </View>
            </> : null}
            {role === 'Hiring Manager' && context?.permissions.includes('application.review') ? <>
              {renderMetricSection('Application review', [
                { label: 'Awaiting review', value: String(reviewQueue.length) },
                { label: 'With feedback', value: String(feedbackAvailableCount) },
                { label: 'Completed interviews in queue', value: String(completedInterviewCount) },
              ])}
              <View style={styles.section}>
                <View><ThemedText style={styles.sectionTitle}>Applications awaiting review</ThemedText><ThemedText style={[styles.sectionCaption, { color: theme.textSecondary }]}>Completed interview and feedback availability from the review queue.</ThemedText></View>
                {reviewQueue.length ? reviewQueue.slice(0, 5).map((application) => (
                  <Pressable key={application.id} onPress={() => router.push({ pathname: '/application-review-details', params: { applicationId: String(application.id) } } as never)} style={[styles.recentCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <View style={styles.recentCopy}><ThemedText style={styles.moduleTitle}>{application.first_name} {application.last_name ?? ''}</ThemedText><ThemedText style={[styles.moduleDescription, { color: theme.textSecondary }]}>{application.job_title} · {application.completed_interview_count} completed interview{application.completed_interview_count === 1 ? '' : 's'}</ThemedText></View>
                    <ThemedText style={[styles.badge, { color: application.feedback_available ? theme.success : theme.textSecondary }]}>{application.feedback_available ? 'Feedback available' : 'No feedback'}</ThemedText>
                  </Pressable>
                )) : <ThemedText style={[styles.empty, { color: theme.textSecondary }]}>No applications are awaiting review.</ThemedText>}
              </View>
            </> : null}
          </>}

          <View style={styles.section}>
            <View><ThemedText style={styles.sectionTitle}>Recruitment modules</ThemedText><ThemedText style={[styles.sectionCaption, { color: theme.textSecondary }]}>Available modules follow your organization role permissions.</ThemedText></View>
            {!loading && !error && permittedModules.length === 0 ? <ThemedText style={[styles.empty, { color: theme.textSecondary }]}>No recruitment modules are enabled for this role yet.</ThemedText> : null}
            <View style={styles.grid}>{permittedModules.map((item) => <Pressable key={item.key} onPress={() => item.key === 'requirement' ? router.push('/requirements') : item.key === 'application' ? router.push('/applications') : item.key === 'application-review' ? router.push('/application-review') : item.key === 'interview' ? router.push((role === 'Interviewer' ? '/interviewer-dashboard' : '/interviews') as never) : item.key === 'onboarding' ? router.push('/onboarding') : router.push({ pathname: '/module', params: { key: item.key, title: item.title } } as never)} style={({ pressed }) => [styles.module, { width: wide ? '48.5%' : '100%', backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
              <View style={[styles.icon, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.iconText, { color: theme.primary }]}>{item.icon}</ThemedText></View>
              <View style={styles.moduleCopy}><ThemedText style={styles.moduleTitle}>{item.title}</ThemedText><ThemedText style={[styles.moduleDescription, { color: theme.textSecondary }]}>{item.key === 'requirement' ? 'Review and manage hiring needs' : `Open ${item.title.toLowerCase()} workspace`}</ThemedText></View><ThemedText style={{ color: theme.textSecondary }}>↗</ThemedText>
            </Pressable>)}</View>
          </View>
          <Pressable onPress={() => router.push('/explore')}><ThemedText style={[styles.lifecycle, { color: theme.primary }]}>Explore the recruitment lifecycle</ThemedText></Pressable>
          <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>Recruitment Workflow · {context?.slug ?? 'Organization workspace'}</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );

}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five }, page: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: Spacing.four },
  top: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { fontSize: 18, fontWeight: '800' }, caption: { fontSize: 9, letterSpacing: 1.1, fontWeight: '700' }, signOut: { paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderRadius: 11 },
  hero: { borderRadius: 22, padding: 26, backgroundColor: '#1C2340', gap: 10 }, eyebrow: { color: '#BFC2FF', fontSize: 10, letterSpacing: 1.1, fontWeight: '800' }, title: { color: '#FFFFFF', fontSize: 30, lineHeight: 37, fontWeight: '800' }, subtitle: { color: '#C4C9DB', fontSize: 14, lineHeight: 21 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, statCard: { minHeight: 104, borderRadius: 16, borderWidth: 1, padding: 15, justifyContent: 'center', gap: 7 }, statValue: { fontSize: 25, fontWeight: '800' }, statLabel: { fontSize: 12, fontWeight: '600' },
  section: { gap: 13 }, sectionTitle: { fontSize: 20, fontWeight: '800' }, sectionCaption: { fontSize: 13, marginTop: 4 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, module: { minHeight: 100, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 }, icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, iconText: { fontSize: 18, fontWeight: '800' }, moduleCopy: { flex: 1, gap: 5 }, moduleTitle: { fontSize: 15, fontWeight: '700' }, moduleDescription: { fontSize: 12 },
  recentCard: { minHeight: 72, borderWidth: 1, borderRadius: 13, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, recentCopy: { flex: 1, gap: 5 }, badge: { fontSize: 11, fontWeight: '700', textAlign: 'right' }, state: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 10 }, errorCard: { padding: 16, borderRadius: 14, gap: 12 }, retryButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 9 }, empty: { padding: 16, borderRadius: 12, backgroundColor: '#FFFFFF' }, pressed: { opacity: 0.7 }, lifecycle: { fontSize: 13, fontWeight: '700' }, footer: { textAlign: 'center', fontSize: 11 },
});
