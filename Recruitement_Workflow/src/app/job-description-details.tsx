import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import axios from 'axios';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { JobButton, JobPageHeader, JobState, JobStatusBadge, jobCardStyle } from '@/components/job-management-ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { approveJobDescription, getJobDescription, getJobDescriptionApprovalHistory, getJobDescriptionWorkflows, publishJobDescription, rejectJobDescription, submitJobDescription, updateJobDescription, type ApprovalRequest, type JobDescription, type JobWorkflow } from '@/services/job-descriptions.service';

function errorMessage(error: unknown) { return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'Unable to load the job description.' : error instanceof Error ? error.message : 'Unable to load the job description.'; }

export default function JobDescriptionDetailsScreen() {
  const router = useRouter(); const theme = useTheme(); const { width } = useWindowDimensions(); const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = Number(Array.isArray(params.jobId) ? params.jobId[0] : params.jobId);
  const [job, setJob] = useState<JobDescription | null>(null); const [history, setHistory] = useState<ApprovalRequest[]>([]); const [workflows, setWorkflows] = useState<JobWorkflow[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [actionError, setActionError] = useState(''); const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [selectedWorkflow, setSelectedWorkflow] = useState(''); const [comments, setComments] = useState('');
  const load = useCallback(async () => {
    if (!Number.isSafeInteger(jobId) || jobId <= 0) { setError('A valid job description was not provided.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const context = await getCurrentOrganizationUser(); const userPermissions = context.permissions ?? []; setPermissions(userPermissions);
      const mayView = ['job.view', 'job.manage', 'job.approve'].some((permission) => userPermissions.includes(permission));
      if (!mayView) throw new Error('Your role does not have permission to view job descriptions.');
      const item = await getJobDescription(jobId); setJob(item); setTitle(item.title); setContent(item.jd_content ?? '');
      if (userPermissions.includes('job.view') || userPermissions.includes('job.approve')) {
        const approvalHistory = await getJobDescriptionApprovalHistory(jobId); setHistory(approvalHistory.requests ?? []);
      } else setHistory([]);
      if (userPermissions.includes('job.manage') && ['DRAFT', 'REJECTED'].includes(item.status)) {
        const available = await getJobDescriptionWorkflows(); setWorkflows(available); setSelectedWorkflow((current) => current || String(item.workflow_id ?? available[0]?.id ?? ''));
      } else setWorkflows([]);
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setLoading(false); }
  }, [jobId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const activeRequest = useMemo(() => history.find((request) => request.status === 'PENDING') ?? null, [history]);
  const latestRequest = history[0]; const latestRejection = [...history].flatMap((request) => request.actions ?? []).reverse().find((action) => action.action === 'REJECTED' && action.comments?.trim());
  const canEdit = permissions.includes('job.manage') && !!job && ['DRAFT', 'REJECTED'].includes(job.status);
  const canApprove = permissions.includes('job.approve') && job?.status === 'PENDING_APPROVAL' && !!activeRequest;
  const doAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setSaving(true); setActionError('');
    try { await action(); setComments(''); await load(); Alert.alert('Updated', successMessage); }
    catch (problem) { setActionError(errorMessage(problem)); }
    finally { setSaving(false); }
  };
  const save = () => doAction(async () => { const result = await updateJobDescription(jobId, { title: title.trim(), jd_content: content.trim() }); setJob(result); }, 'The JD draft has been saved.');
  const submit = () => {
    if (!selectedWorkflow) { setActionError('Choose an active approval workflow before submitting.'); return; }
    void doAction(() => submitJobDescription(jobId, Number(selectedWorkflow)), 'The JD was sent for approval.');
  };
  const approve = () => { if (activeRequest) void doAction(() => approveJobDescription(jobId, activeRequest.current_step, comments.trim() || undefined), 'Your approval decision was recorded.'); };
  const reject = () => { if (!activeRequest) return; if (!comments.trim()) { setActionError('Add a comment explaining why this JD is being rejected.'); return; } void doAction(() => rejectJobDescription(jobId, activeRequest.current_step, comments.trim()), 'The JD was returned to the recruiter with your comments.'); };
  const publish = () => void doAction(() => publishJobDescription(jobId), 'The approved JD has been published.');
  const wide = width >= 760;

  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.page}>
    <JobPageHeader title={job?.title || 'Job description'} subtitle="Review JD content, approval history, and publishing status." onBack={() => router.back()} />
    <JobState loading={loading} error={!loading && error ? error : undefined} onRetry={() => void load()} />
    {!loading && !error && job ? <>
      <View style={[jobCardStyle(theme.backgroundElement, theme.border), styles.summary]}>
        <View style={styles.summaryTop}><View style={styles.summaryCopy}><ThemedText style={styles.label}>JOB DESCRIPTION</ThemedText><ThemedText style={styles.jobTitle}>{job.title}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>Requirement #{job.requirement_id}{job.requirement_title ? ` · ${job.requirement_title}` : ''}</ThemedText></View><JobStatusBadge status={job.status} /></View>
        {job.published_at ? <ThemedText style={{ color: theme.success }}>Published {new Date(job.published_at).toLocaleString()}</ThemedText> : null}
      </View>

      {latestRejection ? <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]}><ThemedText style={{ fontWeight: '800', color: theme.danger }}>Latest rejection feedback</ThemedText><ThemedText style={{ color: theme.text }}>{latestRejection.comments}</ThemedText><ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{latestRejection.approver_name ?? 'Approver'}{latestRejection.action_at ? ` · ${new Date(latestRejection.action_at).toLocaleString()}` : ''}</ThemedText></View> : null}

      <View style={[styles.columns, wide && styles.wideColumns]}>
        <View style={[jobCardStyle(theme.backgroundElement, theme.border), styles.mainColumn, wide && { flex: 1.4 }]}>
          <ThemedText style={styles.sectionTitle}>{canEdit ? 'Edit job description' : 'Job description'}</ThemedText>
          {canEdit ? <>
            <ThemedText style={styles.fieldLabel}>Job title</ThemedText><TextInput accessibilityLabel="Job title" value={title} onChangeText={setTitle} placeholder="Job title" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
            <ThemedText style={styles.fieldLabel}>Description</ThemedText><TextInput accessibilityLabel="Job description content" value={content} onChangeText={setContent} multiline textAlignVertical="top" placeholder="Describe the role, responsibilities, and qualifications…" placeholderTextColor={theme.textSecondary} style={[styles.input, styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
            <ThemedText style={[styles.fieldHint, { color: theme.textSecondary }]}>Use clear responsibilities and qualifications. This content is shown to candidates after publishing.</ThemedText>
            <View style={styles.actions}><JobButton label={saving ? 'Saving…' : 'Save draft'} disabled={saving || !title.trim() || !content.trim()} onPress={save} />
              {workflows.length ? <View style={{ flex: 1, minWidth: 180 }}><ThemedText style={styles.fieldLabel}>Approval workflow</ThemedText><View style={[styles.pickerWrap, { borderColor: theme.border, backgroundColor: theme.background }]}><Picker selectedValue={selectedWorkflow} onValueChange={(value) => setSelectedWorkflow(String(value))} style={{ color: theme.text }}><Picker.Item label="Select workflow" value="" />{workflows.map((workflow) => <Picker.Item key={workflow.id} label={workflow.name} value={String(workflow.id)} />)}</Picker></View></View> : null}
              <JobButton label={saving ? 'Submitting…' : 'Submit for approval'} disabled={saving || !title.trim() || !content.trim() || !workflows.length} onPress={submit} />
            </View>
            {!workflows.length ? <ThemedText style={{ color: theme.textSecondary }}>No active JD approval workflow is available. Ask an organization administrator to configure one.</ThemedText> : null}
          </> : <ThemedText style={[styles.body, { color: theme.textSecondary }]}>{job.jd_content?.trim() || 'No JD content has been added yet.'}</ThemedText>}
        </View>

        <View style={[jobCardStyle(theme.backgroundElement, theme.border), styles.sideColumn, wide && { flex: 1 }]}>
          <ThemedText style={styles.sectionTitle}>Approval progress</ThemedText>
          {history.length ? history.map((request) => <View key={request.id} style={[styles.request, { borderColor: theme.border }]}>
            <View style={styles.requestTop}><ThemedText style={styles.requestTitle}>{request.workflow_name ?? 'Approval workflow'}</ThemedText><JobStatusBadge status={request.status} /></View>
            {request.status === 'PENDING' ? <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Awaiting step {request.current_step}</ThemedText> : null}
            {(request.actions ?? []).map((action) => <View key={action.id} style={styles.actionRow}><View style={[styles.dot, { backgroundColor: action.action === 'REJECTED' ? theme.danger : theme.success }]} /><View style={{ flex: 1, gap: 3 }}><ThemedText style={{ fontWeight: '700' }}>Step {action.step_order} · {action.action.replace(/_/g, ' ')}</ThemedText><ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{action.approver_name ?? 'Approver'}{action.action_at ? ` · ${new Date(action.action_at).toLocaleString()}` : ''}</ThemedText>{action.comments ? <ThemedText style={{ color: theme.text, lineHeight: 19 }}>{action.comments}</ThemedText> : null}</View></View>)}
          </View>) : <ThemedText style={{ color: theme.textSecondary }}>{permissions.includes('job.view') || permissions.includes('job.approve') ? 'No approval request has been created yet.' : 'Approval history requires job viewing permission.'}</ThemedText>}
          {latestRequest?.status === 'APPROVED' && job.status === 'APPROVED' && permissions.includes('job.publish') ? <View style={styles.approvalAction}><ThemedText style={{ color: theme.success, fontWeight: '700' }}>All approval steps are complete.</ThemedText><JobButton label={saving ? 'Publishing…' : 'Publish job description'} disabled={saving} onPress={publish} /></View> : null}
          {canApprove ? <View style={styles.approvalAction}><ThemedText style={{ color: theme.textSecondary }}>Review the JD, then approve this step or return it with comments.</ThemedText><ThemedText style={styles.fieldLabel}>Comments</ThemedText><TextInput accessibilityLabel="Approval comments" value={comments} onChangeText={setComments} multiline textAlignVertical="top" placeholder="Add review notes or rejection reason" placeholderTextColor={theme.textSecondary} style={[styles.input, styles.commentInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} /><View style={styles.actions}><JobButton label={saving ? 'Saving…' : 'Approve step'} disabled={saving} onPress={approve} /><JobButton label={saving ? 'Saving…' : 'Reject with comments'} variant="danger" disabled={saving || !comments.trim()} onPress={reject} /></View></View> : null}
          {actionError ? <ThemedText style={{ color: theme.danger }}>{actionError}</ThemedText> : null}
        </View>
      </View>
    </> : null}
  </View></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five }, page: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four }, summary: { gap: 12 }, summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, summaryCopy: { flex: 1, gap: 7 }, label: { color: '#667085', fontSize: 10, fontWeight: '800', letterSpacing: 1 }, jobTitle: { fontSize: 23, lineHeight: 30, fontWeight: '800' }, notice: { padding: 16, borderRadius: 14, gap: 7 }, columns: { gap: Spacing.three }, wideColumns: { flexDirection: 'row', alignItems: 'flex-start' }, mainColumn: { flex: 1, gap: 12 }, sideColumn: { flex: 1, gap: 14 }, sectionTitle: { fontSize: 18, fontWeight: '800' }, fieldLabel: { fontSize: 13, fontWeight: '700' }, fieldHint: { fontSize: 12, lineHeight: 18 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 }, textarea: { minHeight: 250 }, commentInput: { minHeight: 100 }, actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }, pickerWrap: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' }, body: { fontSize: 14, lineHeight: 23, minHeight: 140 }, request: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 13, gap: 10 }, requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, requestTitle: { fontWeight: '800', flex: 1 }, actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, dot: { width: 9, height: 9, borderRadius: 9, marginTop: 5 }, approvalAction: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E4E8F0', paddingTop: 13, gap: 10 } });
