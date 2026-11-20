import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getApplicationDetails, moveApplicationStage, rejectApplication, shortlistApplication, type ManagedApplication } from '@/services/application-management.service';

const stageOptions = ['SCREENING', 'PHONE_SCREEN', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'OFFER'];
const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const displayDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(); };

export default function ApplicationDetailsScreen() {
  const theme = useTheme();
  const { applicationId: rawId } = useLocalSearchParams<{ applicationId: string }>();
  const id = Number(rawId);
  const [application, setApplication] = useState<ManagedApplication | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [comments, setComments] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid application ID.');
      const [details, user] = await Promise.all([getApplicationDetails(id), getCurrentOrganizationUser()]);
      setApplication(details);
      setCanManage(user.permissions.includes('application.manage'));
      setComments(details.decision_comments ?? '');
    } catch (cause) {
      const message = isAxiosError(cause) ? cause.response?.data?.message : null;
      setError(message ?? (cause instanceof Error ? cause.message : 'Unable to load application details.'));
    } finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function perform(action: 'stage' | 'shortlist' | 'reject', stage?: string) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = action === 'stage'
        ? await moveApplicationStage(id, stage!, comments || undefined)
        : action === 'shortlist'
          ? await shortlistApplication(id, comments.trim())
          : await rejectApplication(id, comments.trim());
      setApplication(next);
      setNotice(action === 'stage' ? `Moved to ${label(stage!)}` : action === 'shortlist' ? 'Candidate shortlisted.' : 'Application rejected.');
    } catch (cause) {
      const message = isAxiosError(cause) ? cause.response?.data?.message : null;
      setError(message ?? 'Unable to update this application. Please try again.');
    } finally { setSaving(false); }
  }

  const card = { backgroundColor: theme.backgroundElement, borderColor: theme.border };
  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}>
      <View style={styles.page}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={[styles.back, { color: theme.primary }]}>← Back to applications</Text></Pressable>
        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading application…</Text></View> : error && !application ? (
          <View style={[styles.card, card]}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={[styles.buttonText, { color: theme.primaryText }]}>Try again</Text></Pressable></View>
        ) : application ? <>
          <View style={[styles.card, card]}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>APPLICATION #{application.id}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{application.first_name} {application.last_name ?? ''}</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>{application.email}</Text>
            {application.phone ? <Text style={[styles.text, { color: theme.textSecondary }]}>{application.phone}</Text> : null}
            {application.resume_url ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(application.resume_url!)}><Text style={[styles.link, { color: theme.primary }]}>Open candidate resume</Text></Pressable> : <Text style={[styles.text, { color: theme.textSecondary }]}>No resume provided</Text>}
            <Text style={[styles.text, { color: theme.textSecondary }]}>Candidate since {displayDate(application.candidate_created_at)}</Text>
          </View>
          <View style={[styles.card, card]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Applied job</Text>
            <Text style={[styles.jobTitle, { color: theme.text }]}>{application.job_title}</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>Job status: {label(application.job_status)}</Text>
            <Text style={[styles.description, { color: theme.text }]}>{application.jd_content}</Text>
          </View>
          <View style={[styles.card, card]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Application progress</Text>
            <View style={styles.row}><Text style={[styles.text, { color: theme.textSecondary }]}>Status</Text><Text style={[styles.value, { color: theme.primary }]}>{label(application.status)}</Text></View>
            <View style={styles.row}><Text style={[styles.text, { color: theme.textSecondary }]}>Stage</Text><Text style={[styles.value, { color: theme.text }]}>{label(application.current_stage)}</Text></View>
            <Text style={[styles.text, { color: theme.textSecondary }]}>Applied {displayDate(application.applied_at)}</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>Updated {displayDate(application.updated_at)}</Text>
            {application.decision ? <View style={[styles.commentBox, { borderColor: theme.border }]}><Text style={[styles.text, { color: theme.textSecondary }]}>Decision</Text><Text style={[styles.text, { color: theme.text }]}>{label(application.decision)}</Text></View> : null}
            {application.decision_comments ? <View style={[styles.commentBox, { borderColor: theme.border }]}><Text style={[styles.text, { color: theme.textSecondary }]}>Decision comments</Text><Text style={[styles.text, { color: theme.text }]}>{application.decision_comments}</Text></View> : null}
          </View>
          {canManage && !['SHORTLISTED', 'REJECTED', 'HIRED'].includes(application.status) ? <View style={[styles.card, card]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recruiter actions</Text>
            <Text style={[styles.text, { color: theme.textSecondary }]}>Move through screening stages</Text>
            <View style={styles.stageList}>{stageOptions.map((stage) => <Pressable key={stage} accessibilityRole="button" disabled={saving} onPress={() => void perform('stage', stage)} style={[styles.stageButton, { borderColor: theme.border, backgroundColor: application.current_stage === stage ? theme.primaryMuted : theme.backgroundElement }]}><Text style={{ color: application.current_stage === stage ? theme.primary : theme.text }}>{label(stage)}</Text></Pressable>)}</View>
            <Text style={[styles.text, { color: theme.textSecondary }]}>Comments are required to shortlist or reject.</Text>
            <TextInput value={comments} onChangeText={setComments} multiline maxLength={5000} placeholder="Add screening or decision comments" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={saving || !comments.trim()} onPress={() => void perform('shortlist')} style={[styles.button, { backgroundColor: theme.primary }, (saving || !comments.trim()) && styles.disabled]}>{saving ? <ActivityIndicator color={theme.primaryText} /> : <Text style={[styles.buttonText, { color: theme.primaryText }]}>Shortlist</Text>}</Pressable>
              <Pressable accessibilityRole="button" disabled={saving || !comments.trim()} onPress={() => void perform('reject')} style={[styles.rejectButton, { borderColor: '#B42318' }, (saving || !comments.trim()) && styles.disabled]}><Text style={styles.rejectText}>Reject</Text></Pressable>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {notice ? <Text style={[styles.notice, { color: theme.primary }]}>{notice}</Text> : null}
          </View> : null}
          {error && application ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice && !canManage ? <Text style={{ color: theme.primary }}>{notice}</Text> : null}
        </> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 15 }, back: { fontSize: 14, fontWeight: '700', paddingVertical: 5 }, state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: { borderWidth: 1, borderRadius: 17, padding: 20, gap: 11 }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 24, fontWeight: '800' }, sectionTitle: { fontSize: 17, fontWeight: '700' }, jobTitle: { fontSize: 18, fontWeight: '700' }, text: { fontSize: 13, lineHeight: 20 }, value: { fontSize: 14, fontWeight: '700' }, description: { fontSize: 14, lineHeight: 22, marginTop: 5 }, link: { fontSize: 14, fontWeight: '700' }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, commentBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 5 }, stageList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, stageButton: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 }, input: { minHeight: 90, borderWidth: 1, borderRadius: 10, padding: 11, textAlignVertical: 'top' }, actions: { flexDirection: 'row', gap: 9 }, button: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 16 }, buttonText: { fontSize: 14, fontWeight: '700' }, rejectButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 16 }, rejectText: { color: '#B42318', fontWeight: '700' }, disabled: { opacity: 0.5 }, error: { color: '#B42318', fontSize: 13 }, notice: { fontSize: 13, fontWeight: '600' },
});
