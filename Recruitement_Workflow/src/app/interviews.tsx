import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getInterviews, scheduleInterview, type Interview } from '@/services/interview-management.service';
import { useTheme } from '@/hooks/use-theme';

const interviewTypes = ['VIDEO', 'PHONE', 'IN_PERSON'] as const;

export default function Interviews() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const [items, setItems] = useState<Interview[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [app, setApp] = useState('');
  const [type, setType] = useState<(typeof interviewTypes)[number]>('VIDEO');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('30');
  const [url, setUrl] = useState('');
  const [location, setLocation] = useState('');
  const [panel, setPanel] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [interviews, user] = await Promise.all([getInterviews(), getCurrentOrganizationUser()]);
      setItems(interviews);
      setCanManage(user.permissions.includes('interview.manage'));
      setError('');
    } catch (cause) {
      setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Could not load interviews.' : 'Could not load interviews.');
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function create() {
    setError('');
    setSuccess('');
    const applicationId = Number(app.trim());
    const durationMinutes = Number(duration.trim());
    const scheduledAt = new Date(date.trim());
    const panelIds = panel.split(',').map((value) => Number(value.trim())).filter((value) => Number.isSafeInteger(value) && value > 0);

    if (!Number.isSafeInteger(applicationId) || applicationId < 1) return setError('Enter a valid shortlisted application ID.');
    if (!title.trim()) return setError('Enter an interview title.');
    if (!date.trim() || Number.isNaN(scheduledAt.getTime())) return setError('Enter a valid date and time, for example 2026-12-15T10:30:00+05:30.');
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) return setError('Duration must be between 1 and 1440 minutes.');
    if (!panelIds.length) return setError('Enter at least one active interviewer user ID.');
    if (type === 'VIDEO' && url.trim() && !/^https?:\/\//i.test(url.trim())) return setError('Meeting URL must start with http:// or https://.');
    if (type === 'IN_PERSON' && !location.trim()) return setError('Enter the interview location.');

    setSaving(true);
    try {
      await scheduleInterview({
        application_id: applicationId,
        interview_type: type,
        title: title.trim(),
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: durationMinutes,
        meeting_url: url.trim() || undefined,
        location: location.trim() || undefined,
        panel_member_ids: panelIds,
      });
      setApp(''); setTitle(''); setDate(''); setUrl(''); setLocation(''); setPanel('');
      setSuccess('Interview scheduled successfully.');
      await load();
    } catch (cause) {
      setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Could not schedule the interview.' : 'Could not schedule the interview.');
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, value: string, onChangeText: (value: string) => void, placeholder: string, options: { keyboardType?: 'numeric' | 'default'; helper?: string; autoCapitalize?: 'none' | 'sentences' } = {}) {
    return <View style={[styles.field, compact && styles.fullField]} key={label}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={options.keyboardType}
        autoCapitalize={options.autoCapitalize}
        autoCorrect={false}
        editable={!saving}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
      />
      {options.helper ? <Text style={[styles.helper, { color: theme.textSecondary }]}>{options.helper}</Text> : null}
    </View>;
  }

  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>PEOPLE OPERATIONS</Text>
          <Text style={[styles.title, { color: theme.text }]}>Interview management</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Schedule interviews and keep each candidate conversation on track.</Text>
        </View>
        <View style={[styles.countBadge, { backgroundColor: theme.primaryMuted }]}><Text style={[styles.count, { color: theme.primary }]}>{items.length}</Text><Text style={[styles.countLabel, { color: theme.primary }]}>interviews</Text></View>
      </View>

      {canManage ? <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Schedule an interview</Text>
            <Text style={[styles.helper, { color: theme.textSecondary }]}>Use a shortlisted application and assign at least one active interviewer.</Text>
          </View>
          <View style={[styles.stepBadge, { backgroundColor: theme.primaryMuted }]}><Text style={[styles.stepBadgeText, { color: theme.primary }]}>NEW</Text></View>
        </View>

        <View style={styles.fields}>
          {field('Shortlisted application ID', app, setApp, 'e.g. 104', { keyboardType: 'numeric' })}
          {field('Interview title', title, setTitle, 'e.g. Product design interview')}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.text }]}>Interview format</Text>
            <View style={styles.typeRow}>{interviewTypes.map((option) => {
              const selected = type === option;
              return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setType(option)} style={[styles.typeChip, { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primaryMuted : theme.background }]}>
                <Text style={[styles.typeText, { color: selected ? theme.primary : theme.text }]}>{option.replace('_', ' ')}</Text>
              </Pressable>;
            })}</View>
          </View>
          {field('Date and time', date, setDate, '2026-12-15T10:30:00+05:30', { helper: 'Use ISO 8601 and include your time zone offset.' })}
          {field('Duration (minutes)', duration, setDuration, '30', { keyboardType: 'numeric' })}
          {field('Interviewer user IDs', panel, setPanel, 'e.g. 12, 18', { helper: 'Separate multiple active interviewer IDs with commas.', keyboardType: 'numeric' })}
          {type === 'VIDEO' ? field('Meeting link (optional)', url, setUrl, 'https://meet.example.com/…', { helper: 'Add a secure video meeting URL.', autoCapitalize: 'none' }) : null}
          {type === 'IN_PERSON' ? field('Location', location, setLocation, 'Office, room, or address') : null}
          {type === 'PHONE' ? field('Additional location or dial-in (optional)', location, setLocation, 'Phone or dial-in details') : null}
        </View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {!!success && <Text accessibilityRole="alert" style={[styles.success, { color: theme.primary }]}>{success}</Text>}
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void create()} style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, (pressed || saving) && styles.buttonPressed]}>
          {saving ? <ActivityIndicator color={theme.primaryText} /> : <Text style={[styles.buttonText, { color: theme.primaryText }]}>Schedule interview</Text>}
        </Pressable>
      </View> : <View style={[styles.notice, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={[styles.helper, { color: theme.textSecondary }]}>You can view interviews, but scheduling requires interview management access.</Text></View>}

      <View style={styles.listHeader}><View><Text style={[styles.sectionTitle, { color: theme.text }]}>Scheduled interviews</Text><Text style={[styles.helper, { color: theme.textSecondary }]}>Open an interview to view its panel and feedback.</Text></View></View>
      {busy ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : items.length ? items.map((interview) => <Pressable key={interview.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/interview-details', params: { id: String(interview.id) } } as never)} style={({ pressed }) => [styles.interviewCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }, pressed && styles.buttonPressed]}>
        <View style={styles.interviewTop}>
          <View style={styles.interviewCopy}>
            <Text style={[styles.interviewTitle, { color: theme.text }]}>{interview.title}</Text>
            <Text style={[styles.candidate, { color: theme.textSecondary }]}>{interview.candidate_first_name} {interview.candidate_last_name ?? ''} · {interview.job_title}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: interview.status === 'SCHEDULED' ? theme.primaryMuted : theme.background }]}><Text style={[styles.statusText, { color: interview.status === 'SCHEDULED' ? theme.primary : theme.textSecondary }]}>{interview.status.replace('_', ' ')}</Text></View>
        </View>
        <View style={styles.metaRow}><Text style={[styles.meta, { color: theme.textSecondary }]}>{new Date(interview.scheduled_at).toLocaleString()}</Text><Text style={[styles.meta, { color: theme.textSecondary }]}>{interview.duration_minutes} min · {interview.interview_type.replace('_', ' ')}</Text></View>
      </Pressable>) : <View style={[styles.empty, { borderColor: theme.border }]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No interviews yet</Text><Text style={[styles.helper, { color: theme.textSecondary }]}>Scheduled interviews will appear here.</Text></View>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 20, paddingBottom: 36 },
  content: { width: '100%', maxWidth: 940, alignSelf: 'center', gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  headerCopy: { flex: 1, gap: 5 },
  eyebrow: { fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  title: { fontSize: 27, lineHeight: 34, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20 },
  countBadge: { minWidth: 72, alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  count: { fontSize: 19, fontWeight: '800' },
  countLabel: { fontSize: 10, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 17 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { fontSize: 19, fontWeight: '800' },
  helper: { fontSize: 12, lineHeight: 18 },
  stepBadge: { borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  stepBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  field: { flexGrow: 1, flexBasis: '46%', minWidth: 230, gap: 7 },
  fullField: { minWidth: '100%' },
  label: { fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, fontSize: 14 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 13 },
  typeText: { fontSize: 12, fontWeight: '700' },
  error: { color: '#B42318', fontSize: 13, lineHeight: 19 },
  success: { fontSize: 13, fontWeight: '700' },
  button: { minHeight: 49, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonPressed: { opacity: 0.72 },
  buttonText: { fontSize: 14, fontWeight: '800' },
  notice: { borderWidth: 1, borderRadius: 14, padding: 15 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  loader: { marginVertical: 14 },
  interviewCard: { borderWidth: 1, borderRadius: 15, padding: 16, gap: 13 },
  interviewTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  interviewCopy: { flex: 1, gap: 5 },
  interviewTitle: { fontSize: 15, fontWeight: '800' },
  candidate: { fontSize: 13, lineHeight: 19 },
  statusPill: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { fontSize: 10, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  meta: { fontSize: 12 },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 20, alignItems: 'center', gap: 5 },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
});
