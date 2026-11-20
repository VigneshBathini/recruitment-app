import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getInterviews, scheduleInterview, type Interview } from '@/services/interview-management.service';
import { useTheme } from '@/hooks/use-theme';

const Input = ({ value, onChangeText, placeholder, keyboardType }: any) => <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} style={styles.input} />;

export default function Interviews() {
  const theme = useTheme();
  const [items, setItems] = useState<Interview[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [app, setApp] = useState(''); const [type, setType] = useState('VIDEO'); const [title, setTitle] = useState('');
  const [date, setDate] = useState(''); const [duration, setDuration] = useState('30'); const [url, setUrl] = useState('');
  const [location, setLocation] = useState(''); const [panel, setPanel] = useState('');
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [interviews, user] = await Promise.all([getInterviews(), getCurrentOrganizationUser()]);
      setItems(interviews); setCanManage(user.permissions.includes('interview.manage')); setError('');
    } catch (cause) { setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Could not load interviews' : 'Could not load interviews'); }
    finally { setBusy(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function create() {
    try {
      await scheduleInterview({ application_id: Number(app), interview_type: type, title, scheduled_at: date, duration_minutes: Number(duration), meeting_url: url || undefined, location: location || undefined, panel_member_ids: panel.split(',').map((value) => Number(value.trim())).filter(Boolean) });
      setTitle(''); setError(''); await load();
    } catch (cause) { setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Could not schedule' : 'Could not schedule'); }
  }
  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}>
    <Text style={[styles.title, { color: theme.text }]}>Interview management</Text>
    {canManage ? <><Text style={{ color: theme.textSecondary }}>Schedule an interview for a shortlisted application. Enter active interviewer user IDs separated by commas.</Text><View style={[styles.form, { borderColor: theme.border }]}>
      <Input value={app} onChangeText={setApp} placeholder="Shortlisted application ID" keyboardType="numeric" /><Input value={type} onChangeText={setType} placeholder="Interview type" /><Input value={title} onChangeText={setTitle} placeholder="Title" /><Input value={date} onChangeText={setDate} placeholder="Date/time (ISO 8601)" /><Input value={duration} onChangeText={setDuration} placeholder="Duration in minutes" keyboardType="numeric" /><Input value={url} onChangeText={setUrl} placeholder="Meeting URL (optional)" /><Input value={location} onChangeText={setLocation} placeholder="Location (optional)" /><Input value={panel} onChangeText={setPanel} placeholder="Interviewer user IDs, comma separated" />
      <Pressable onPress={() => void create()} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Schedule interview</Text></Pressable>
    </View></> : <Text style={{ color: theme.textSecondary }}>Organization interviews are available in read-only mode.</Text>}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <Text style={[styles.title, { color: theme.text }]}>Interviews</Text>
    {busy ? <ActivityIndicator color={theme.primary} /> : items.map((interview) => <Pressable key={interview.id} onPress={() => router.push({ pathname: '/interview-details', params: { id: String(interview.id) } } as never)} style={[styles.card, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <Text style={{ color: theme.text, fontWeight: '700' }}>{interview.title} · {interview.candidate_first_name} {interview.candidate_last_name ?? ''}</Text>
      <Text style={{ color: theme.textSecondary }}>{interview.job_title} · {new Date(interview.scheduled_at).toLocaleString()} · {interview.status}</Text>
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { padding: 20, gap: 14, flexGrow: 1 }, title: { fontSize: 24, fontWeight: '800' }, form: { gap: 9, padding: 14, borderWidth: 1, borderRadius: 14 }, input: { minHeight: 44, borderWidth: 1, borderColor: '#D5D9E2', borderRadius: 9, paddingHorizontal: 12, color: '#202533' }, button: { padding: 13, borderRadius: 9, alignItems: 'center' }, card: { padding: 15, borderWidth: 1, borderRadius: 12, gap: 5 }, error: { color: '#B42318' } });
