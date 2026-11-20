import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { decideOnApplication, getApplicationReview, type ApplicationReview } from '@/services/application-management.service';

const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string) => new Date(value).toLocaleString();

export default function ApplicationReviewDetails() {
  const theme = useTheme();
  const { applicationId: rawId } = useLocalSearchParams<{ applicationId: string }>();
  const id = Number(rawId);
  const [application, setApplication] = useState<ApplicationReview | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canDecide, setCanDecide] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const [result, user] = await Promise.all([getApplicationReview(id), getCurrentOrganizationUser()]); setApplication(result); setComment(result.decision_comments ?? ''); setCanDecide(user.permissions.includes('application.decision')); setError(''); }
    catch (cause) { setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Unable to load review' : 'Unable to load review'); }
    finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function submit(decision: 'SELECTED' | 'REJECTED') {
    if (!comment.trim()) { setError('A decision comment is required.'); return; }
    setBusy(true); setError('');
    try { setApplication(await decideOnApplication(id, decision, comment.trim())); }
    catch (cause) { setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Unable to record decision' : 'Unable to record decision'); }
    finally { setBusy(false); }
  }
  const card = { backgroundColor: theme.backgroundElement, borderColor: theme.border };
  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}>
    <Pressable onPress={() => router.back()}><Text style={{ color: theme.primary, fontWeight: '700' }}>← Review queue</Text></Pressable>
    {loading ? <ActivityIndicator color={theme.primary} /> : application ? <>
      <View style={[styles.card, card]}><Text style={[styles.title, { color: theme.text }]}>{application.first_name} {application.last_name ?? ''}</Text><Text style={{ color: theme.textSecondary }}>{application.email} · {application.job_title}</Text><Text style={{ color: theme.textSecondary }}>Application status: {label(application.status)} · Stage: {label(application.current_stage)}</Text></View>
      <View style={[styles.card, card]}><Text style={[styles.heading, { color: theme.text }]}>Completed interviews and feedback</Text>
        {application.completed_interviews.map((interview) => <View key={interview.id} style={[styles.interview, { borderColor: theme.border }]}>
          <Text style={[styles.name, { color: theme.text }]}>{interview.title} · {label(interview.interview_type)}</Text><Text style={{ color: theme.textSecondary }}>{date(interview.scheduled_at)}</Text>
          {interview.feedback.length ? interview.feedback.map((feedback) => <View key={feedback.id} style={[styles.feedback, { borderColor: theme.border }]}>
            <Text style={[styles.name, { color: theme.text }]}>{feedback.interviewer_first_name} {feedback.interviewer_last_name ?? ''}</Text>
            <Text style={{ color: theme.text }}>Rating: {feedback.rating}</Text>
            <Text style={{ color: theme.text }}>Recommendation: {feedback.recommendation ? label(feedback.recommendation) : '—'}</Text>
            <Text style={{ color: theme.text }}>Strengths: {feedback.strengths || '—'}</Text><Text style={{ color: theme.text }}>Weaknesses: {feedback.weaknesses || '—'}</Text><Text style={{ color: theme.text }}>Comments: {feedback.comments || '—'}</Text>
          </View>) : <Text style={{ color: theme.textSecondary }}>No feedback submitted.</Text>}
          <Pressable onPress={() => router.push({ pathname: '/interview-details', params: { id: String(interview.id) } } as never)}><Text style={{ color: theme.primary, fontWeight: '700' }}>View interview</Text></Pressable>
        </View>)}
      </View>
      {application.decision ? <View style={[styles.card, card]}><Text style={[styles.heading, { color: theme.text }]}>Decision: {label(application.decision)}</Text><Text style={{ color: theme.textSecondary }}>Decision maker: {application.decision_by_name || `User ${application.decision_by ?? '—'}`}</Text><Text style={{ color: theme.textSecondary }}>Decision date: {application.decision_at ? date(application.decision_at) : '—'}</Text><Text style={{ color: theme.text }}>{application.decision_comments}</Text></View> : canDecide ? <View style={[styles.card, card]}><Text style={[styles.heading, { color: theme.text }]}>Record application decision</Text><Text style={{ color: theme.textSecondary }}>Selected means advancing to the next recruitment stage; it does not mean hired.</Text><TextInput value={comment} onChangeText={setComment} multiline maxLength={5000} placeholder="Required decision comment" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><View style={styles.actions}><Pressable disabled={busy || !comment.trim()} onPress={() => void submit('SELECTED')} style={[styles.select, { backgroundColor: theme.primary }, (busy || !comment.trim()) && styles.disabled]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Select</Text></Pressable><Pressable disabled={busy || !comment.trim()} onPress={() => void submit('REJECTED')} style={[styles.reject, (busy || !comment.trim()) && styles.disabled]}><Text style={{ color: '#B42318', fontWeight: '700' }}>Reject</Text></Pressable></View></View> : <Text style={{ color: theme.textSecondary }}>You can review this application but do not have permission to record a decision.</Text>}
    </> : null}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 22, gap: 14 }, title: { fontSize: 24, fontWeight: '800' }, heading: { fontSize: 18, fontWeight: '800' }, name: { fontSize: 15, fontWeight: '700' }, card: { borderWidth: 1, borderRadius: 15, padding: 17, gap: 11 }, interview: { borderTopWidth: 1, paddingTop: 12, gap: 9 }, feedback: { borderWidth: 1, borderRadius: 11, padding: 12, gap: 5 }, input: { minHeight: 90, borderWidth: 1, borderRadius: 10, padding: 11, textAlignVertical: 'top' }, actions: { flexDirection: 'row', gap: 10 }, select: { padding: 13, borderRadius: 9, alignItems: 'center', minWidth: 100 }, reject: { padding: 12, borderRadius: 9, borderWidth: 1, borderColor: '#B42318', alignItems: 'center', minWidth: 100 }, disabled: { opacity: 0.45 }, error: { color: '#B42318' } });
