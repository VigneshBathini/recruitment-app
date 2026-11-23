import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import axios from 'axios';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { JobButton, JobPageHeader, JobState, JobStatusBadge, jobCardStyle } from '@/components/job-management-ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getRequirements, type Requirement } from '@/services/requirement.service';
import { createJobDescriptionFromRequirement, getJobDescriptions, type JobDescription } from '@/services/job-descriptions.service';

function errorMessage(error: unknown) { return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'Unable to load job descriptions.' : error instanceof Error ? error.message : 'Unable to load job descriptions.'; }

export default function JobDescriptionsScreen() {
  const router = useRouter(); const theme = useTheme(); const { width } = useWindowDimensions();
  const [jobs, setJobs] = useState<JobDescription[]>([]); const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true); const [creating, setCreating] = useState<number | null>(null); const [error, setError] = useState(''); const [requirementError, setRequirementError] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]); const [canLoad, setCanLoad] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const context = await getCurrentOrganizationUser(); const currentPermissions = context.permissions ?? []; setPermissions(currentPermissions);
      const mayView = ['job.view', 'job.manage', 'job.approve'].some((permission) => currentPermissions.includes(permission)); setCanLoad(mayView);
      if (!mayView) { setJobs([]); setRequirements([]); return; }
      const jobData = await getJobDescriptions(); setJobs(jobData);
      if (currentPermissions.includes('job.manage') && (currentPermissions.includes('requirement.view') || currentPermissions.includes('requirement.manage'))) {
        try { setRequirements((await getRequirements()).filter((requirement) => requirement.status === 'APPROVED' && !jobData.some((job) => Number(job.requirement_id) === Number(requirement.id)))); setRequirementError(''); }
        catch (problem) { setRequirementError(errorMessage(problem)); }
      } else { setRequirements([]); setRequirementError(currentPermissions.includes('job.manage') ? 'Requirement viewing permission is needed to find approved requirements.' : ''); }
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const create = async (requirement: Requirement) => { setCreating(requirement.id); setError(''); try { const job = await createJobDescriptionFromRequirement(requirement.id); router.push({ pathname: '/job-description-details', params: { jobId: String(job.id) } } as never); } catch (problem) { setError(errorMessage(problem)); } finally { setCreating(null); } };
  const visibleJobs = permissions.includes('job.approve') && !permissions.includes('job.manage') ? jobs.filter((job) => job.status === 'PENDING_APPROVAL') : jobs;
  const wide = width >= 760;
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.page}>
      <JobPageHeader title="Job descriptions" subtitle="Create, review, and publish approved hiring content." onBack={() => router.back()} />
      {permissions.includes('job.manage') ? <View style={[styles.intro, { backgroundColor: theme.primaryMuted }]}><View style={styles.introCopy}><ThemedText style={styles.introTitle}>Build from an approved requirement</ThemedText><ThemedText style={[styles.introText, { color: theme.textSecondary }]}>Each approved requirement can have one JD draft. Edit it, then send it through your organization’s approval workflow.</ThemedText></View><ThemedText style={[styles.count, { color: theme.primary }]}>{requirements.length} ready</ThemedText></View> : null}
      {!canLoad ? <JobState empty="Your role does not have permission to view job descriptions." /> : <>
        <JobState loading={loading} error={!loading && error ? error : undefined} onRetry={() => void load()} />
        {!loading && !error ? <>
          {permissions.includes('job.manage') ? <View style={styles.section}><ThemedText style={styles.sectionTitle}>Approved requirements</ThemedText>
            {requirementError ? <JobState error={requirementError} onRetry={() => void load()} /> : null}
            {!requirementError && requirements.length === 0 ? <JobState empty="No approved requirements are available for a new JD." /> : null}
            <View style={styles.grid}>{requirements.map((requirement) => <View key={requirement.id} style={[jobCardStyle(theme.backgroundElement, theme.border), { width: wide ? '48.8%' : '100%' }]}>
              <ThemedText style={styles.cardTitle}>{requirement.title}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{requirement.department_name ?? requirement.location} · {requirement.openings} opening{requirement.openings === 1 ? '' : 's'}</ThemedText>
              <JobButton label={creating === requirement.id ? 'Creating…' : 'Create JD draft'} disabled={creating !== null} onPress={() => void create(requirement)} />
            </View>)}</View>
          </View> : null}
          <View style={styles.section}><ThemedText style={styles.sectionTitle}>{permissions.includes('job.approve') && !permissions.includes('job.manage') ? 'Pending JD approvals' : 'Job descriptions'}</ThemedText>
            {visibleJobs.length === 0 ? <JobState empty={permissions.includes('job.approve') && !permissions.includes('job.manage') ? 'There are no job descriptions waiting for your approval.' : 'No job descriptions yet.'} /> : <View style={styles.grid}>{visibleJobs.map((job) => <Pressable accessibilityRole="button" key={job.id} onPress={() => router.push({ pathname: '/job-description-details', params: { jobId: String(job.id) } } as never)} style={({ pressed }) => [jobCardStyle(theme.backgroundElement, theme.border), styles.jobCard, { width: wide ? '48.8%' : '100%', opacity: pressed ? 0.75 : 1 }]}>
              <View style={styles.jobTop}><View style={{ flex: 1, gap: 5 }}><ThemedText style={styles.cardTitle}>{job.title}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>Requirement #{job.requirement_id}{job.requirement_title ? ` · ${job.requirement_title}` : ''}</ThemedText></View><JobStatusBadge status={job.status} /></View>
              <ThemedText numberOfLines={3} style={{ color: theme.textSecondary, lineHeight: 20 }}>{job.jd_content?.trim() || 'JD content is not written yet.'}</ThemedText><ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Open job description  ›</ThemedText>
            </Pressable>)}</View>}
          </View>
        </> : null}
      </>}
    </View>
  </ScrollView>{loading ? <ActivityIndicator style={styles.hiddenSpinner} color={theme.primary} /> : null}</ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five }, page: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four }, intro: { padding: Spacing.three, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 }, introCopy: { flex: 1, gap: 7 }, introTitle: { fontSize: 16, fontWeight: '800' }, introText: { fontSize: 13, lineHeight: 20 }, count: { fontSize: 12, fontWeight: '800' }, section: { gap: 13 }, sectionTitle: { fontSize: 19, fontWeight: '800' }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, cardTitle: { fontSize: 16, fontWeight: '800' }, jobCard: { gap: 13 }, jobTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, hiddenSpinner: { position: 'absolute', width: 1, height: 1, opacity: 0 } });
