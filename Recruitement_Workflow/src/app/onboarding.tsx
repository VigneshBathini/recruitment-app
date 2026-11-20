import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isAxiosError } from 'axios';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { getOnboardingDashboard, getOnboardingRecords, initiateOnboarding, type OnboardingDashboard, type OnboardingRecord } from '@/services/onboarding-management.service';

const statuses = ['', 'INITIATED', 'IN_PROGRESS', 'READY_TO_JOIN', 'COMPLETED', 'CANCELLED'];

export default function OnboardingScreen() {
  const theme = useTheme();
  const [records, setRecords] = useState<OnboardingRecord[]>([]);
  const [dashboard, setDashboard] = useState<OnboardingDashboard | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [offerId, setOfferId] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true); setError('');
    try {
      const [counts, items] = await Promise.all([getOnboardingDashboard(), getOnboardingRecords({ search, status: filter || undefined })]);
      setDashboard(counts); setRecords(items);
    } catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? 'Unable to load onboarding records.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [search, filter]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function initiate() {
    const id = Number(offerId);
    if (!Number.isSafeInteger(id) || id <= 0) { setError('Enter a valid accepted offer ID.'); return; }
    setBusy(true); setError('');
    try { const created = await initiateOnboarding({ offer_id: id, ...(joinDate.trim() ? { target_join_date: joinDate.trim() } : {}) }); setOfferId(''); setJoinDate(''); await load(true); router.push({ pathname: '/onboarding-details', params: { onboardingId: String(created.id) } }); }
    catch (problem) { setError((isAxiosError(problem) ? problem.response?.data?.message : null) ?? 'Unable to initiate onboarding.'); }
    finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}>
    <View style={styles.page}>
      <View style={styles.header}><View><Text style={[styles.eyebrow, { color: theme.primary }]}>PEOPLE OPERATIONS</Text><Text style={[styles.title, { color: theme.text }]}>Onboarding</Text></View><Pressable onPress={() => router.push('/recruiter-dashboard')} style={[styles.outline, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Dashboard</Text></Pressable></View>
      {dashboard ? <View style={styles.stats}>{[['Total', dashboard.total], ...statuses.slice(1).map((status) => [status.replace(/_/g, ' '), dashboard.onboarding_by_status[status] ?? 0] as [string, number])].map(([label, value]) => <View key={label} style={[styles.stat, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={[styles.statValue, { color: theme.primary }]}>{value}</Text><Text style={{ color: theme.textSecondary }}>{label}</Text></View>)}</View> : null}
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={[styles.sectionTitle, { color: theme.text }]}>Start onboarding</Text><Text style={{ color: theme.textSecondary }}>Provide an offer ID. Only an ACCEPTED offer can be used.</Text><TextInput keyboardType="number-pad" value={offerId} onChangeText={setOfferId} placeholder="Accepted offer ID" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><TextInput value={joinDate} onChangeText={setJoinDate} placeholder="Target joining date (YYYY-MM-DD, optional)" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><Pressable disabled={busy} onPress={() => void initiate()} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>{busy ? 'Starting…' : 'Initiate onboarding'}</Text></Pressable></View>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={[styles.sectionTitle, { color: theme.text }]}>Onboarding records</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search candidate, email, job, offer" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{statuses.map((status) => <Pressable key={status || 'all'} onPress={() => setFilter(status)} style={[styles.filter, { borderColor: filter === status ? theme.primary : theme.border, backgroundColor: filter === status ? theme.primaryMuted : 'transparent' }]}><Text style={{ color: filter === status ? theme.primary : theme.text }}>{status || 'All'}</Text></Pressable>)}</ScrollView>
        {loading ? <ActivityIndicator color={theme.primary} /> : error ? <Text style={styles.error}>{error}</Text> : records.length === 0 ? <Text style={{ color: theme.textSecondary }}>No onboarding records found.</Text> : <View style={styles.list}>{records.map((record) => <Pressable key={record.id} onPress={() => router.push({ pathname: '/onboarding-details', params: { onboardingId: String(record.id) } })} style={[styles.record, { borderColor: theme.border }]}><Text style={[styles.recordTitle, { color: theme.text }]}>{record.candidate_first_name} {record.candidate_last_name ?? ''} · {record.job_title}</Text><Text style={{ color: theme.textSecondary }}>{record.candidate_email} · Offer {record.offer_id}</Text><Text style={{ color: theme.primary, fontWeight: '700' }}>{record.status.replace(/_/g, ' ')}</Text></Pressable>)}</View>}
      </View>
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 1060, alignSelf: 'center', gap: 18 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 28, fontWeight: '800', marginTop: 5 }, outline: { borderWidth: 1, borderRadius: 10, padding: 11 }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, stat: { flexGrow: 1, minWidth: 105, borderWidth: 1, borderRadius: 12, padding: 13, gap: 5 }, statValue: { fontSize: 22, fontWeight: '800' }, card: { borderWidth: 1, borderRadius: 17, padding: 18, gap: 12 }, sectionTitle: { fontSize: 18, fontWeight: '800' }, input: { borderWidth: 1, borderRadius: 9, padding: 11 }, button: { borderRadius: 9, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 11 }, filters: { gap: 8 }, filter: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 }, list: { gap: 10 }, record: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 5 }, recordTitle: { fontWeight: '700', fontSize: 15 }, error: { color: '#B42318' } });
