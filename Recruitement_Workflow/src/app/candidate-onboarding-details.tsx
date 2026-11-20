import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isAxiosError } from 'axios';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { chooseOnboardingDocument, getMyOnboardingRecord, updateMyOnboardingTask, uploadMyOnboardingDocument } from '@/services/candidate-onboarding.service';
import type { OnboardingRecord, OnboardingTask } from '@/services/onboarding-management.service';

function dateLabel(value: string | null) { return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : 'Not set'; }

export default function CandidateOnboardingDetailsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ onboardingId?: string }>();
  const onboardingId = Number(params.onboardingId);
  const [record, setRecord] = useState<OnboardingRecord | null>(null);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [documentType, setDocumentType] = useState('IDENTITY');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    if (!Number.isSafeInteger(onboardingId) || onboardingId <= 0) { setError('Invalid onboarding ID.'); setLoading(false); return; }
    refresh ? setRefreshing(true) : setLoading(true); setError('');
    try { setRecord(await getMyOnboardingRecord(onboardingId)); }
    catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? 'Unable to load onboarding details.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [onboardingId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function updateTask(task: OnboardingTask, status: 'IN_PROGRESS' | 'COMPLETED') {
    setBusy(true); setError('');
    try { await updateMyOnboardingTask(task.id, { status, comments: comments[task.id]?.trim() }); await load(true); }
    catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? 'Unable to update this task.'); }
    finally { setBusy(false); }
  }

  async function uploadDocument() {
    if (!documentType.trim()) { setError('Enter a document type.'); return; }
    setBusy(true); setError('');
    try {
      const result = await chooseOnboardingDocument();
      if (result.canceled || !result.assets[0]) return;
      await uploadMyOnboardingDocument(onboardingId, documentType.trim(), result.assets[0]);
      await load(true);
    } catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? (problem instanceof Error ? problem.message : 'Document upload failed.')); }
    finally { setBusy(false); }
  }

  const cardStyle = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}>
    <View style={styles.page}>
      <View style={styles.header}><View style={styles.heading}><Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text><Text style={[styles.title, { color: theme.text }]}>Onboarding details</Text></View><Pressable onPress={() => router.push('/candidate-onboarding')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My onboarding</Text></Pressable></View>
      {loading ? <View style={styles.state}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading details…</Text></View> : !record ? <Text style={styles.error}>{error || 'Onboarding record not found.'}</Text> : <>
        <View style={cardStyle}><Text style={[styles.jobTitle, { color: theme.text }]}>{record.job_title}</Text><Text style={[styles.status, { color: theme.primary }]}>{record.status.replace(/_/g, ' ')}</Text><Text style={{ color: theme.textSecondary }}>Joining date: {dateLabel(record.target_join_date)}</Text><Text style={{ color: theme.textSecondary }}>Offer: {record.currency} {record.annual_ctc} · {record.employment_type}</Text></View>
        <View style={cardStyle}><Text style={[styles.sectionTitle, { color: theme.text }]}>Assigned tasks</Text>{record.tasks?.length ? record.tasks.map((task) => <View key={task.id} style={styles.item}><Text style={[styles.itemTitle, { color: theme.text }]}>{task.title}</Text>{task.description ? <Text style={{ color: theme.textSecondary }}>{task.description}</Text> : null}<Text style={{ color: theme.primary }}>{task.status.replace(/_/g, ' ')} · Due {dateLabel(task.due_date)}</Text><TextInput value={comments[task.id] ?? task.comments ?? ''} onChangeText={(value) => setComments((current) => ({ ...current, [task.id]: value }))} placeholder="Add a comment" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />{task.status !== 'COMPLETED' && task.status !== 'CANCELLED' ? <View style={styles.actions}>{task.status === 'PENDING' ? <Pressable disabled={busy} onPress={() => void updateTask(task, 'IN_PROGRESS')} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Start task</Text></Pressable> : null}<Pressable disabled={busy} onPress={() => void updateTask(task, 'COMPLETED')} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Complete task</Text></Pressable></View> : null}</View>) : <Text style={{ color: theme.textSecondary }}>No tasks assigned.</Text>}</View>
        <View style={cardStyle}><Text style={[styles.sectionTitle, { color: theme.text }]}>Documents</Text><TextInput value={documentType} onChangeText={setDocumentType} placeholder="Document type (for example IDENTITY)" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><Pressable disabled={busy} onPress={() => void uploadDocument()} style={[styles.button, { backgroundColor: theme.primary, alignSelf: 'flex-start' }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>{busy ? 'Please wait…' : 'Upload or replace document'}</Text></Pressable>{record.documents?.length ? record.documents.map((document) => <View key={document.id} style={styles.document}><Text style={[styles.itemTitle, { color: theme.text }]}>{document.document_type}: {document.file_name}</Text><Text style={{ color: theme.primary, fontWeight: '700' }}>{document.review_status}</Text>{document.reviewed_at ? <Text style={{ color: theme.textSecondary }}>Reviewed {dateLabel(document.reviewed_at)}</Text> : null}{document.rejection_reason ? <Text style={styles.error}>Reason: {document.rejection_reason}</Text> : null}</View>) : <Text style={{ color: theme.textSecondary }}>No documents uploaded.</Text>}</View>
      </>}
      {error && record ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 16 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }, heading: { flex: 1, gap: 7 }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 28, fontWeight: '800' }, outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, state: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 10 }, card: { borderWidth: 1, borderRadius: 17, padding: 19, gap: 13 }, jobTitle: { fontSize: 20, fontWeight: '800' }, status: { fontWeight: '800' }, sectionTitle: { fontSize: 18, fontWeight: '800' }, item: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D0D5DD', paddingTop: 14 }, itemTitle: { fontWeight: '700' }, input: { borderWidth: 1, borderRadius: 9, padding: 10 }, actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, button: { borderRadius: 9, paddingHorizontal: 13, paddingVertical: 10 }, document: { gap: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D0D5DD', paddingTop: 12 }, error: { color: '#B42318' } });
