import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isAxiosError } from 'axios';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { getMyOnboarding } from '@/services/candidate-onboarding.service';
import type { OnboardingRecord } from '@/services/onboarding-management.service';

function dateLabel(value: string | null) { return value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString() : 'Not set'; }

export default function CandidateOnboardingScreen() {
  const theme = useTheme();
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try { setRecords(await getMyOnboarding()); }
    catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? 'Unable to load onboarding.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}>
    <View style={styles.page}>
      <View style={styles.header}><View style={styles.heading}><Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text><Text style={[styles.title, { color: theme.text }]}>My onboarding</Text></View><Pressable onPress={() => router.push('/candidate-dashboard')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Dashboard</Text></Pressable></View>
      {loading ? <View style={styles.state}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading onboarding…</Text></View> : error ? <Text style={styles.error}>{error}</Text> : records.length === 0 ? <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={{ color: theme.textSecondary }}>No onboarding record is available yet.</Text></View> : <View style={styles.list}>{records.map((record) => <Pressable key={record.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/candidate-onboarding-details', params: { onboardingId: String(record.id) } })} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Text style={[styles.jobTitle, { color: theme.text }]}>{record.job_title}</Text><Text style={[styles.status, { color: theme.primary }]}>{record.status.replace(/_/g, ' ')}</Text><Text style={{ color: theme.textSecondary }}>Joining date: {dateLabel(record.target_join_date)}</Text><Text style={{ color: theme.primary, fontWeight: '700' }}>View tasks and documents</Text>
      </Pressable>)}</View>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 22 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, heading: { flex: 1, gap: 7 }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 28, fontWeight: '800' }, outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, state: { minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 10 }, list: { gap: 12 }, card: { borderWidth: 1, borderRadius: 17, padding: 18, gap: 11 }, jobTitle: { fontSize: 18, fontWeight: '700' }, status: { fontWeight: '800' }, error: { color: '#B42318' } });
