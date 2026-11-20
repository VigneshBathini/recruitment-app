import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isAxiosError } from 'axios';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { getToken } from '@/services/token.service';
import { completeOnboarding, createOnboardingTask, getOnboardingDocumentFile, getOnboardingRecord, reviewOnboardingDocument, updateOnboarding, updateOnboardingTask, type OnboardingRecord, type OnboardingTask, type OnboardingStatus } from '@/services/onboarding-management.service';
import { getCurrentOrganizationUser } from '@/services/auth.service';

function dateLabel(value: string | null) { return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : 'Not set'; }

export default function OnboardingDetailsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ onboardingId?: string }>();
  const id = Number(params.onboardingId);
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [joinDate, setJoinDate] = useState('');
  const [notes, setNotes] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [candidateAssignee, setCandidateAssignee] = useState('');
  const [employeeAssignee, setEmployeeAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskComments, setTaskComments] = useState<Record<number, string>>({});
  const [reviewReasons, setReviewReasons] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canComplete, setCanComplete] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (!Number.isSafeInteger(id) || id <= 0) { setError('Invalid onboarding ID.'); setLoading(false); return; }
    refresh ? setRefreshing(true) : setLoading(true); setError('');
    try { const [item, user] = await Promise.all([getOnboardingRecord(id), getCurrentOrganizationUser()]); setRecord(item); setCanComplete(user.permissions.includes('onboarding.complete')); setJoinDate(item.target_join_date?.slice(0, 10) ?? ''); setNotes(item.notes ?? ''); }
    catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? 'Unable to load onboarding details.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); await load(true); }
    catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? 'Unable to save onboarding changes.'); }
    finally { setBusy(false); }
  }
  function changeStatus(status: OnboardingStatus) { return run(() => updateOnboarding(id, { status })); }
  function confirmJoining() { return run(() => completeOnboarding(id)); }
  async function saveDetails() { await run(() => updateOnboarding(id, { target_join_date: joinDate.trim() || null, notes: notes.trim() || null })); }
  async function addTask() {
    const candidateId = candidateAssignee.trim() ? Number(candidateAssignee) : undefined;
    const userId = employeeAssignee.trim() ? Number(employeeAssignee) : undefined;
    if (!taskTitle.trim() || Boolean(candidateId) === Boolean(userId)) { setError('Enter a title and assign to exactly one candidate or employee.'); return; }
    await run(async () => { await createOnboardingTask(id, { title: taskTitle.trim(), description: taskDescription.trim() || undefined, assigned_to_candidate_id: candidateId, assigned_to_user_id: userId, due_date: taskDueDate.trim() || undefined }); setTaskTitle(''); setTaskDescription(''); setCandidateAssignee(''); setEmployeeAssignee(''); setTaskDueDate(''); });
  }
  async function updateTask(task: OnboardingTask, status: OnboardingTask['status']) { await run(() => updateOnboardingTask(task.id, { status, comments: taskComments[task.id]?.trim() ?? task.comments })); }
  async function reviewDoc(documentId: number, status: 'VERIFIED' | 'REJECTED') {
    const reason = reviewReasons[documentId]?.trim();
    if (status === 'REJECTED' && !reason) { setError('A rejection reason is required.'); return; }
    await run(() => reviewOnboardingDocument(documentId, { review_status: status, rejection_reason: status === 'REJECTED' ? reason : undefined }));
  }
  async function openDocument(documentId: number, fileName: string) {
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired');
      if (Platform.OS === 'web') {
        const response = await getOnboardingDocumentFile(documentId);
        const url = URL.createObjectURL(response.data);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.128:5000/api';
        const target = `${FileSystem.cacheDirectory}${encodeURIComponent(fileName)}`;
        const response = await FileSystem.downloadAsync(`${base}/onboarding/documents/${documentId}/file`, target, { headers: { Authorization: `Bearer ${token}` } });
        if (response.status < 200 || response.status >= 300) throw new Error('Unable to download document');
        await Linking.openURL(response.uri);
      }
    } catch (problem) { setError((problem instanceof Error && problem.message) || 'Unable to open document.'); }
  }

  const cardStyle = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}>
    <View style={styles.page}>
      <View style={styles.header}><View><Text style={[styles.eyebrow, { color: theme.primary }]}>PEOPLE OPERATIONS</Text><Text style={[styles.title, { color: theme.text }]}>Onboarding details</Text></View><Pressable onPress={() => router.push('/onboarding')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Onboarding list</Text></Pressable></View>
      {loading ? <View style={styles.state}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading details…</Text></View> : !record ? <Text style={styles.error}>{error || 'Onboarding record not found.'}</Text> : <>
        <View style={cardStyle}><Text style={[styles.recordTitle, { color: theme.text }]}>{record.candidate_first_name} {record.candidate_last_name ?? ''} · {record.job_title}</Text><Text style={{ color: theme.textSecondary }}>{record.candidate_email} · Application {record.application_id} · Offer {record.offer_id}</Text><Text style={[styles.status, { color: theme.primary }]}>{record.status.replace(/_/g, ' ')}</Text><Text style={{ color: theme.textSecondary }}>Offer: {record.currency} {record.annual_ctc} · {record.employment_type}</Text><Text style={{ color: theme.textSecondary }}>Initiated {dateLabel(record.initiated_at)}</Text>
          {record.status === 'INITIATED' ? <View style={styles.actions}><Pressable disabled={busy} onPress={() => void changeStatus('IN_PROGRESS')} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Start onboarding</Text></Pressable><Pressable disabled={busy} onPress={() => void changeStatus('CANCELLED')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Cancel</Text></Pressable></View> : null}
          {record.status === 'IN_PROGRESS' ? <View style={styles.actions}><Pressable disabled={busy} onPress={() => void changeStatus('READY_TO_JOIN')} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Mark ready to join</Text></Pressable><Pressable disabled={busy} onPress={() => void changeStatus('CANCELLED')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Cancel</Text></Pressable></View> : null}
          {record.status === 'READY_TO_JOIN' && canComplete ? <View style={styles.actions}><Pressable disabled={busy} onPress={() => void confirmJoining()} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Confirm joining</Text></Pressable><Pressable disabled={busy} onPress={() => void changeStatus('CANCELLED')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Cancel</Text></Pressable></View> : null}
          {record.status === 'COMPLETED' ? <Text style={{ color: theme.textSecondary }}>Final hiring completed {dateLabel(record.completed_at ?? null)} | Application {record.application_id} marked HIRED</Text> : null}
        </View>
        {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' ? <View style={cardStyle}><Text style={[styles.sectionTitle, { color: theme.text }]}>Joining details</Text><TextInput value={joinDate} onChangeText={setJoinDate} placeholder="Joining date (YYYY-MM-DD)" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><TextInput value={notes} onChangeText={setNotes} multiline placeholder="HR notes" placeholderTextColor={theme.textSecondary} style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border }]} /><Pressable disabled={busy} onPress={() => void saveDetails()} style={[styles.button, { backgroundColor: theme.primary, alignSelf: 'flex-start' }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Save details</Text></Pressable></View> : null}
        <View style={cardStyle}><Text style={[styles.sectionTitle, { color: theme.text }]}>Tasks</Text>{record.tasks?.length ? record.tasks.map((task) => <View key={task.id} style={[styles.item, { borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>{task.title}</Text>{task.description ? <Text style={{ color: theme.textSecondary }}>{task.description}</Text> : null}<Text style={{ color: theme.textSecondary }}>Assigned to: {task.candidate_assignee_name || task.employee_assignee_name || 'Unassigned'} · Due {dateLabel(task.due_date)}</Text><Text style={{ color: theme.primary, fontWeight: '700' }}>{task.status}</Text><TextInput value={taskComments[task.id] ?? task.comments ?? ''} onChangeText={(value) => setTaskComments((current) => ({ ...current, [task.id]: value }))} placeholder="Task comments" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />{task.status !== 'COMPLETED' && task.status !== 'CANCELLED' ? <View style={styles.actions}>{task.status === 'PENDING' ? <Pressable disabled={busy} onPress={() => void updateTask(task, 'IN_PROGRESS')} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Start</Text></Pressable> : null}<Pressable disabled={busy} onPress={() => void updateTask(task, 'COMPLETED')} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Complete</Text></Pressable></View> : null}</View>) : <Text style={{ color: theme.textSecondary }}>No onboarding tasks.</Text>}
          {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' ? <View style={[styles.item, { borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>Add a task</Text><TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Task title" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><TextInput value={taskDescription} onChangeText={setTaskDescription} placeholder="Description (optional)" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><TextInput keyboardType="number-pad" value={candidateAssignee} onChangeText={setCandidateAssignee} placeholder={`Candidate ID (onboarding candidate ${record.candidate_id})`} placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><TextInput keyboardType="number-pad" value={employeeAssignee} onChangeText={setEmployeeAssignee} placeholder="HR employee user ID" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><TextInput value={taskDueDate} onChangeText={setTaskDueDate} placeholder="Due date (YYYY-MM-DD)" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><Pressable disabled={busy} onPress={() => void addTask()} style={[styles.button, { backgroundColor: theme.primary, alignSelf: 'flex-start' }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Create task</Text></Pressable></View> : null}
        </View>
        <View style={cardStyle}><Text style={[styles.sectionTitle, { color: theme.text }]}>Candidate documents</Text>{record.documents?.length ? record.documents.map((document) => <View key={document.id} style={[styles.item, { borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>{document.document_type} · {document.file_name}</Text><Text style={{ color: theme.primary, fontWeight: '700' }}>{document.review_status}{document.is_primary ? ' · Current' : ''}</Text><Text style={{ color: theme.textSecondary }}>Uploaded {dateLabel(document.uploaded_at)}{document.reviewer_name ? ` · Reviewed by ${document.reviewer_name}` : ''}</Text><Pressable onPress={() => void openDocument(document.id, document.file_name)}><Text style={{ color: theme.primary, fontWeight: '700' }}>Open document</Text></Pressable>{document.rejection_reason ? <Text style={styles.error}>Reason: {document.rejection_reason}</Text> : null}{document.review_status !== 'VERIFIED' ? <><TextInput value={reviewReasons[document.id] ?? ''} onChangeText={(value) => setReviewReasons((current) => ({ ...current, [document.id]: value }))} placeholder="Rejection reason (required to reject)" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><View style={styles.actions}><Pressable disabled={busy} onPress={() => void reviewDoc(document.id, 'VERIFIED')} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Verify</Text></Pressable><Pressable disabled={busy} onPress={() => void reviewDoc(document.id, 'REJECTED')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Reject</Text></Pressable></View></> : null}</View>) : <Text style={{ color: theme.textSecondary }}>No documents uploaded.</Text>}</View>
      </>}
      {error && record ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 1000, alignSelf: 'center', gap: 14 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12 }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 28, fontWeight: '800', marginTop: 5 }, outline: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }, state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 10 }, card: { borderWidth: 1, borderRadius: 17, padding: 18, gap: 12 }, recordTitle: { fontSize: 20, fontWeight: '800' }, status: { fontWeight: '800' }, sectionTitle: { fontSize: 18, fontWeight: '800' }, item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, gap: 8 }, itemTitle: { fontSize: 15, fontWeight: '700' }, input: { borderWidth: 1, borderRadius: 9, padding: 10 }, multiline: { minHeight: 76, textAlignVertical: 'top' }, actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 }, button: { borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10 }, error: { color: '#B42318' } });

