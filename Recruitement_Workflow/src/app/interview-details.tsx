import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { completeInterview, getInterview, getInterviewHistory, sendInterviewFeedback, updateInterview, type Interview, type InterviewHistoryItem } from '@/services/interview-management.service';

export default function InterviewDetails() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Interview | null>(null);
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [canViewHistory, setCanViewHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const [error, setError] = useState('');
  const [rating, setRating] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [comments, setComments] = useState('');

  const load = useCallback(async () => {
    try {
      const [interview, user] = await Promise.all([getInterview(Number(id)), getCurrentOrganizationUser()]);
      const role = user.role_name.toLowerCase();
      const assigned = interview.panel_members.some((member) => Number(member.id) === Number(user.id));
      setItem(interview);
      const historyAllowed = (role === 'recruiter' || role === 'hiring manager') && user.permissions.includes('interview.view');
      setCanViewHistory(historyAllowed);
      setHistory(historyAllowed ? await getInterviewHistory(Number(id)) : []);
      setCanComplete(
        (role === 'recruiter' && user.permissions.includes('interview.manage')) ||
        (role === 'interviewer' && assigned && user.permissions.includes('interview.feedback')),
      );
      setError('');
    } catch (cause) {
      setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Unable to load interview' : 'Unable to load interview');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function complete() {
    setCompleting(true);
    setError('');
    try {
      setItem(await completeInterview(Number(id)));
      await load();
    } catch (cause) {
      setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Unable to complete interview' : 'Unable to complete interview');
    } finally {
      setCompleting(false);
    }
  }

  async function feedback() {
    try {
      await sendInterviewFeedback(Number(id), { rating: Number(rating), recommendation, strengths, weaknesses, comments });
      setError('Feedback submitted');
      await load();
    } catch (cause) {
      setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Unable to submit feedback' : 'Unable to submit feedback');
    }
  }

  async function cancel() {
    try {
      setItem(await updateInterview(Number(id), { status: 'CANCELLED' }));
      await load();
    } catch (cause) {
      setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Unable to cancel' : 'Unable to cancel');
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.primary} />;

  return (
    <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}>
      <Pressable onPress={() => router.back()}><Text style={{ color: theme.primary }}>Back</Text></Pressable>
      {item && <>
        <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
        <Text style={{ color: theme.text }}>{item.candidate_first_name} {item.candidate_last_name ?? ''} · {item.job_title}</Text>
        <Text style={{ color: theme.textSecondary }}>{item.interview_type} · {new Date(item.scheduled_at).toLocaleString()} · {item.duration_minutes} min · {item.status}</Text>
        <Text style={{ color: theme.textSecondary }}>{item.meeting_url ?? item.location ?? ''}</Text>
        <Text style={[styles.heading, { color: theme.text }]}>Panel members</Text>
        {item.panel_members.map((member) => <Text key={member.id} style={{ color: theme.text }}>{member.first_name} {member.last_name ?? ''} · {member.email}</Text>)}
        {item.status === 'SCHEDULED' && canComplete && <Pressable disabled={completing} onPress={() => void complete()} style={[styles.button, { backgroundColor: theme.primary }, completing && styles.disabled]}>
          {completing ? <ActivityIndicator color={theme.primaryText} /> : <Text style={{ color: theme.primaryText, fontWeight: '700' }}>Mark Completed</Text>}
        </Pressable>}
        {item.status !== 'CANCELLED' && <Pressable onPress={() => void cancel()} style={styles.cancel}><Text style={{ color: '#B42318' }}>Cancel interview</Text></Pressable>}
        {item.status === 'COMPLETED' && <>
          <Text style={[styles.heading, { color: theme.text }]}>Submit feedback</Text>
          {[
            ['Rating (1–5)', rating, setRating],
            ['Recommendation', recommendation, setRecommendation],
            ['Strengths', strengths, setStrengths],
            ['Weaknesses', weaknesses, setWeaknesses],
            ['Comments', comments, setComments],
          ].map(([label, value, setter]: any) => <TextInput key={label} placeholder={label} value={value} onChangeText={setter} style={styles.input} />)}
          <Pressable onPress={() => void feedback()} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Submit feedback</Text></Pressable>
        </>}
        <Text style={{ color: theme.textSecondary }}>Feedback records: {item.feedback.length}</Text>
        {canViewHistory ? <>
          <Text style={[styles.heading, { color: theme.text }]}>Interview history</Text>
          {history.length ? history.map((entry) => <View key={entry.id} style={styles.historyItem}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>{entry.action.replace(/_/g, ' ')}</Text>
            <Text style={{ color: theme.textSecondary }}>{entry.previous_value ? `${entry.previous_value} → ` : ''}{entry.new_value ?? ''}</Text>
            <Text style={{ color: theme.textSecondary }}>{entry.actor_name || entry.actor_type} · {new Date(entry.created_at).toLocaleString()}</Text>
          </View>) : <Text style={{ color: theme.textSecondary }}>No interview history yet.</Text>}
        </> : null}
      </>}
      {!!error && <Text style={error === 'Feedback submitted' ? { color: theme.primary } : styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 12, flexGrow: 1 },
  title: { fontSize: 25, fontWeight: '800' },
  heading: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#D5D9E2', borderRadius: 9, padding: 12, color: '#202533' },
  button: { padding: 13, borderRadius: 9, alignItems: 'center' },
  cancel: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#B42318', borderRadius: 9, padding: 11 },
  historyItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D5D9E2', paddingTop: 10, gap: 4 },
  disabled: { opacity: 0.6 },
  error: { color: '#B42318' },
});
