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
import type { ManagedApplication } from '@/services/application-management.service';
import { createManagementOffer, decideOfferApproval, getManagementOffer, getOfferApplication, getOfferWorkflows, issueManagementOffer, submitManagementOffer, updateManagementOffer, type ManagementOffer, type OfferApprovalRequest, type OfferTermsInput, type OfferWorkflow } from '@/services/management-offers.service';

type Form = { annual_ctc: string; currency: string; employment_type: string; work_location: string; start_date: string; expiry_date: string; offer_letter_url: string };
const blankForm: Form = { annual_ctc: '', currency: '', employment_type: '', work_location: '', start_date: '', expiry_date: '', offer_letter_url: '' };
function asDate(value?: string | null) { return value ? String(value).slice(0, 10) : ''; }
function errorMessage(error: unknown) { return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'Unable to load the offer.' : error instanceof Error ? error.message : 'Unable to load the offer.'; }
function terms(form: Form): OfferTermsInput { return { annual_ctc: form.annual_ctc.trim(), currency: form.currency.trim().toUpperCase(), employment_type: form.employment_type.trim(), work_location: form.work_location.trim() || null, start_date: form.start_date.trim(), expiry_date: form.expiry_date.trim() || null, offer_letter_url: form.offer_letter_url.trim() || null }; }

export default function OfferDetailsScreen() {
  const router = useRouter(); const theme = useTheme(); const { width } = useWindowDimensions(); const params = useLocalSearchParams<{ offerId?: string | string[]; applicationId?: string | string[] }>();
  const offerId = Number(Array.isArray(params.offerId) ? params.offerId[0] : params.offerId); const applicationId = Number(Array.isArray(params.applicationId) ? params.applicationId[0] : params.applicationId);
  const editingExisting = Number.isSafeInteger(offerId) && offerId > 0;
  const [offer, setOffer] = useState<ManagementOffer | null>(null); const [application, setApplication] = useState<ManagedApplication | null>(null); const [history, setHistory] = useState<OfferApprovalRequest[]>([]); const [workflows, setWorkflows] = useState<OfferWorkflow[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]); const [form, setForm] = useState<Form>(blankForm); const [selectedWorkflow, setSelectedWorkflow] = useState(''); const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [actionError, setActionError] = useState(''); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if ((editingExisting && !Number.isSafeInteger(offerId)) || (!editingExisting && (!Number.isSafeInteger(applicationId) || applicationId <= 0))) { setError('A valid offer or selected application was not provided.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const context = await getCurrentOrganizationUser(); const userPermissions = context.permissions ?? []; setPermissions(userPermissions);
      if (!['offer.view', 'offer.manage', 'offer.approve', 'offer.issue'].some((permission) => userPermissions.includes(permission))) throw new Error('Your role does not have permission to view offers.');
      if (editingExisting) {
        const data = await getManagementOffer(offerId); setOffer(data); setApplication(null);
        const approvalHistory = data.approval_history ?? []; setHistory(approvalHistory);
        setForm({ annual_ctc: String(data.annual_ctc ?? ''), currency: data.currency ?? '', employment_type: data.employment_type ?? '', work_location: data.work_location ?? '', start_date: asDate(data.start_date), expiry_date: asDate(data.expiry_date), offer_letter_url: data.offer_letter_url ?? '' });
        if (userPermissions.includes('offer.manage') && ['DRAFT', 'REJECTED'].includes(data.status)) {
          const available = await getOfferWorkflows(); setWorkflows(available); setSelectedWorkflow((current) => current || String(available[0]?.id ?? ''));
        } else setWorkflows([]);
      } else {
        if (!userPermissions.includes('offer.manage')) throw new Error('Offer management permission is required to create an offer.');
        const selectedApplication = await getOfferApplication(applicationId);
        if (selectedApplication.decision !== 'SELECTED') throw new Error('Offers can only be created for selected candidates.');
        setApplication(selectedApplication); setOffer(null); setHistory([]); setForm(blankForm);
        const available = await getOfferWorkflows(); setWorkflows(available); setSelectedWorkflow((current) => current || String(available[0]?.id ?? ''));
      }
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setLoading(false); }
  }, [applicationId, editingExisting, offerId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const activeRequest = useMemo(() => history.find((request) => request.status === 'PENDING') ?? null, [history]);
  const rejectedAction = [...history].flatMap((request) => request.actions ?? []).reverse().find((action) => action.action === 'REJECTED' && action.comments?.trim());
  const canEdit = permissions.includes('offer.manage') && (!offer || ['DRAFT', 'REJECTED'].includes(offer.status));
  const canApprove = permissions.includes('offer.approve') && offer?.status === 'PENDING_APPROVAL' && !!activeRequest;
  const setField = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const doAction = async (action: () => Promise<unknown>, message: string) => { setSaving(true); setActionError(''); try { await action(); setComments(''); await load(); Alert.alert('Updated', message); } catch (problem) { setActionError(errorMessage(problem)); } finally { setSaving(false); } };
  const validForm = !!form.annual_ctc.trim() && !!form.currency.trim() && !!form.employment_type.trim() && !!form.start_date.trim();
  const save = () => doAction(async () => {
    const input = terms(form);
    if (offer) { await updateManagementOffer(offer.id, input); }
    else { const created = await createManagementOffer({ ...input, application_id: applicationId }); router.replace({ pathname: '/offer-details', params: { offerId: String(created.id) } } as never); }
  }, offer ? 'Offer draft saved.' : 'Offer draft created.');
  const submit = () => { if (!selectedWorkflow) { setActionError('Select an active offer approval workflow.'); return; } if (offer) void doAction(() => submitManagementOffer(offer.id, Number(selectedWorkflow)), 'Offer submitted for approval.'); else void doAction(async () => { const created = await createManagementOffer({ ...terms(form), application_id: applicationId }); await submitManagementOffer(created.id, Number(selectedWorkflow)); router.replace({ pathname: '/offer-details', params: { offerId: String(created.id) } } as never); }, 'Offer submitted for approval.'); };
  const approve = () => { if (activeRequest) void doAction(() => decideOfferApproval(activeRequest.id, 'approve', activeRequest.current_step, comments.trim() || undefined), 'Approval decision recorded.'); };
  const reject = () => { if (!activeRequest) return; if (!comments.trim()) { setActionError('Add comments explaining why the offer is being rejected.'); return; } void doAction(() => decideOfferApproval(activeRequest.id, 'reject', activeRequest.current_step, comments.trim()), 'Offer rejected with comments.'); };
  const issue = () => { if (offer) void doAction(() => issueManagementOffer(offer.id), 'The offer has been issued to the candidate.'); };
  const wide = width >= 760; const candidate = offer?.candidate ?? (application ? { first_name: application.first_name, last_name: application.last_name, email: application.email } : null); const jobTitle = offer?.job?.title ?? offer?.job_title ?? application?.job_title;
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.page}>
    <JobPageHeader title={offer ? `Offer for ${candidate?.first_name ?? 'candidate'}` : 'Create candidate offer'} subtitle="Review offer terms, approval history, and candidate response." onBack={() => router.back()} />
    <JobState loading={loading} error={!loading && error ? error : undefined} onRetry={() => void load()} />
    {!loading && !error ? <>
      <View style={[jobCardStyle(theme.backgroundElement, theme.border), styles.summary]}><View style={styles.candidateBlock}><ThemedText style={styles.candidateName}>{candidate ? `${candidate.first_name} ${candidate.last_name ?? ''}`.trim() : `Application #${applicationId}`}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{candidate?.email}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{jobTitle} · Application #{offer?.application_id ?? applicationId}</ThemedText></View>{offer ? <JobStatusBadge status={offer.status} /> : null}</View>
      {rejectedAction ? <View style={[styles.notice, { backgroundColor: theme.dangerBackground }]}><ThemedText style={{ color: theme.danger, fontWeight: '800' }}>Approval feedback</ThemedText><ThemedText>{rejectedAction.comments}</ThemedText><ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{rejectedAction.approver_name ?? 'Approver'}{rejectedAction.action_at ? ` · ${new Date(rejectedAction.action_at).toLocaleString()}` : ''}</ThemedText></View> : null}
      <View style={[styles.columns, wide && styles.wideColumns]}>
        <View style={[jobCardStyle(theme.backgroundElement, theme.border), styles.mainColumn, wide && { flex: 1.35 }]}>
          <ThemedText style={styles.sectionTitle}>{canEdit ? 'Offer terms' : 'Offer details'}</ThemedText>
          {canEdit ? <>
            <ThemedText style={styles.fieldLabel}>Annual compensation</ThemedText><View style={styles.row}><TextInput accessibilityLabel="Annual compensation" keyboardType="decimal-pad" value={form.annual_ctc} onChangeText={(value) => setField('annual_ctc', value)} placeholder="Annual amount" placeholderTextColor={theme.textSecondary} style={[styles.input, styles.flexInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} /><TextInput accessibilityLabel="Currency code" autoCapitalize="characters" maxLength={3} value={form.currency} onChangeText={(value) => setField('currency', value)} placeholder="USD" placeholderTextColor={theme.textSecondary} style={[styles.input, styles.currencyInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} /></View>
            <ThemedText style={styles.fieldLabel}>Employment type</ThemedText><TextInput accessibilityLabel="Employment type" value={form.employment_type} onChangeText={(value) => setField('employment_type', value)} placeholder="Full-time" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
            <ThemedText style={styles.fieldLabel}>Work location</ThemedText><TextInput accessibilityLabel="Work location" value={form.work_location} onChangeText={(value) => setField('work_location', value)} placeholder="Office, hybrid, or remote location" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
            <View style={styles.row}><View style={styles.flexInput}><ThemedText style={styles.fieldLabel}>Start date</ThemedText><TextInput accessibilityLabel="Start date in YYYY-MM-DD format" value={form.start_date} onChangeText={(value) => setField('start_date', value)} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} /></View><View style={styles.flexInput}><ThemedText style={styles.fieldLabel}>Expiry date (optional)</ThemedText><TextInput accessibilityLabel="Expiry date in YYYY-MM-DD format" value={form.expiry_date} onChangeText={(value) => setField('expiry_date', value)} placeholder="YYYY-MM-DD" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} /></View></View>
            <ThemedText style={styles.fieldLabel}>Offer letter URL (optional)</ThemedText><TextInput accessibilityLabel="Offer letter URL" autoCapitalize="none" keyboardType="url" value={form.offer_letter_url} onChangeText={(value) => setField('offer_letter_url', value)} placeholder="https://…" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} />
            <ThemedText style={[styles.hint, { color: theme.textSecondary }]}>Enter dates as YYYY-MM-DD. The expiry date must be later than the start date.</ThemedText>
            <View style={styles.actions}><JobButton label={saving ? 'Saving…' : 'Save draft'} disabled={saving || !validForm} onPress={save} />
              {workflows.length ? <View style={styles.workflow}><ThemedText style={styles.fieldLabel}>Approval workflow</ThemedText><View style={[styles.pickerWrap, { borderColor: theme.border, backgroundColor: theme.background }]}><Picker selectedValue={selectedWorkflow} onValueChange={(value) => setSelectedWorkflow(String(value))} style={{ color: theme.text }}><Picker.Item label="Select workflow" value="" />{workflows.map((workflow) => <Picker.Item key={workflow.id} label={workflow.name} value={String(workflow.id)} />)}</Picker></View></View> : null}
              <JobButton label={saving ? 'Submitting…' : 'Submit for approval'} disabled={saving || !validForm || !workflows.length} onPress={submit} />
            </View>
            {!workflows.length ? <ThemedText style={{ color: theme.textSecondary }}>No active offer approval workflow is available.</ThemedText> : null}
          </> : <View style={styles.readOnly}><Detail label="Annual compensation" value={`${offer?.currency ?? ''} ${Number(offer?.annual_ctc ?? 0).toLocaleString()}`} /><Detail label="Employment type" value={offer?.employment_type} /><Detail label="Work location" value={offer?.work_location} /><Detail label="Start date" value={offer?.start_date ? new Date(`${asDate(offer.start_date)}T00:00:00`).toLocaleDateString() : undefined} /><Detail label="Expiry" value={offer?.expiry_date ? new Date(`${asDate(offer.expiry_date)}T00:00:00`).toLocaleDateString() : 'No expiry date'} />{offer?.offer_letter_url ? <Detail label="Offer letter" value={offer.offer_letter_url} /> : null}
            {offer?.issued_at ? <Detail label="Issued" value={new Date(offer.issued_at).toLocaleString()} /> : null}{offer?.candidate_responded_at ? <Detail label="Candidate response" value={`${offer.status}${offer.candidate_response_comments ? ` · ${offer.candidate_response_comments}` : ''}`} /> : offer?.status === 'ISSUED' ? <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Awaiting candidate response</ThemedText> : null}
          </View>}
          {offer && canEdit && offer.status === 'DRAFT' ? null : null}
          {offer?.status === 'APPROVED' && permissions.includes('offer.issue') ? <View style={styles.issue}><ThemedText style={{ color: theme.success, fontWeight: '700' }}>Approval is complete. You can issue this offer to the candidate.</ThemedText><JobButton label={saving ? 'Issuing…' : 'Issue offer'} disabled={saving} onPress={issue} /></View> : null}
        </View>
        <View style={[jobCardStyle(theme.backgroundElement, theme.border), styles.sideColumn, wide && { flex: 1 }]}>
          <ThemedText style={styles.sectionTitle}>Approval history</ThemedText>
          {history.length ? history.map((request) => <View key={request.id} style={[styles.request, { borderColor: theme.border }]}><View style={styles.requestTop}><ThemedText style={{ fontWeight: '800', flex: 1 }}>{request.workflow_name ?? 'Offer approval'}</ThemedText><JobStatusBadge status={request.status} /></View>
            {request.status === 'PENDING' ? <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Awaiting approval step {request.current_step}</ThemedText> : null}
            {(request.actions ?? []).map((action) => <View key={action.id} style={styles.actionRow}><View style={[styles.dot, { backgroundColor: action.action === 'REJECTED' ? theme.danger : theme.success }]} /><View style={{ flex: 1, gap: 3 }}><ThemedText style={{ fontWeight: '700' }}>Step {action.step_order} · {action.action}</ThemedText><ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{action.approver_name ?? 'Approver'}{action.action_at ? ` · ${new Date(action.action_at).toLocaleString()}` : ''}</ThemedText>{action.comments ? <ThemedText style={{ lineHeight: 19 }}>{action.comments}</ThemedText> : null}</View></View>)}
          </View>) : <ThemedText style={{ color: theme.textSecondary }}>No approval request has been created yet.</ThemedText>}
          {canApprove ? <View style={styles.approval}><ThemedText style={{ color: theme.textSecondary }}>Review offer terms and record a decision for the current workflow step.</ThemedText><ThemedText style={styles.fieldLabel}>Comments</ThemedText><TextInput accessibilityLabel="Offer approval comments" value={comments} onChangeText={setComments} multiline textAlignVertical="top" placeholder="Add notes or explain the rejection" placeholderTextColor={theme.textSecondary} style={[styles.input, styles.commentInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]} /><View style={styles.actions}><JobButton label={saving ? 'Saving…' : 'Approve step'} disabled={saving} onPress={approve} /><JobButton label="Reject with comments" variant="danger" disabled={saving || !comments.trim()} onPress={reject} /></View></View> : null}
          {actionError ? <ThemedText style={{ color: theme.danger }}>{actionError}</ThemedText> : null}
        </View>
      </View>
    </> : null}
  </View></ScrollView></ThemedView>;
}

function Detail({ label, value }: { label: string; value?: string | null }) { const theme = useTheme(); return <View style={styles.detail}><ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</ThemedText><ThemedText style={{ fontWeight: '700' }}>{value || 'Not provided'}</ThemedText></View>; }

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five }, page: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four }, summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, candidateBlock: { flex: 1, gap: 6 }, candidateName: { fontSize: 19, fontWeight: '800' }, notice: { padding: 16, borderRadius: 14, gap: 7 }, columns: { gap: Spacing.three }, wideColumns: { flexDirection: 'row', alignItems: 'flex-start' }, mainColumn: { flex: 1, gap: 12 }, sideColumn: { flex: 1, gap: 14 }, sectionTitle: { fontSize: 18, fontWeight: '800' }, fieldLabel: { fontSize: 13, fontWeight: '700' }, input: { minHeight: 45, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 }, row: { flexDirection: 'row', gap: 10 }, flexInput: { flex: 1 }, currencyInput: { width: 94 }, hint: { fontSize: 12, lineHeight: 18 }, actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }, workflow: { flex: 1, minWidth: 180, gap: 5 }, pickerWrap: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' }, readOnly: { gap: 13 }, detail: { gap: 4 }, issue: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E4E8F0', paddingTop: 14, gap: 10 }, request: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 13, gap: 10 }, requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, dot: { width: 9, height: 9, borderRadius: 9, marginTop: 5 }, approval: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#E4E8F0', paddingTop: 13, gap: 10 }, commentInput: { minHeight: 100 } });
