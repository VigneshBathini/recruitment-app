import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getApplicationCounts, getApplications, type ApplicationCounts, type ApplicationFilters, type ApplicationPage } from '@/services/application-management.service';

const statuses = ['ALL', 'APPLIED', 'SCREENING', 'SHORTLISTED', 'REJECTED'];
const stages = ['ALL', 'SCREENING', 'PHONE_SCREEN', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'OFFER'];
const label = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ApplicationsScreen() {
  const theme = useTheme();
  const [counts, setCounts] = useState<ApplicationCounts | null>(null);
  const [result, setResult] = useState<ApplicationPage | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<ApplicationFilters>({ page: 1, page_size: 10 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (nextFilters = filters, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [dashboard, page] = await Promise.all([getApplicationCounts(), getApplications(nextFilters)]);
      setCounts(dashboard);
      setResult(page);
      setFilters(nextFilters);
    } catch (cause) {
      const message = isAxiosError(cause) ? cause.response?.data?.message : null;
      setError(message ?? 'Unable to load applications. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function updateFilter(key: 'status' | 'stage', value: string) {
    const next = { ...filters, page: 1, [key]: value === 'ALL' ? undefined : value };
    void load(next);
  }

  const cardStyle = { backgroundColor: theme.backgroundElement, borderColor: theme.border };
  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(filters, true)} tintColor={theme.primary} />}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.heading}><Text style={[styles.eyebrow, { color: theme.primary }]}>RECRUITER WORKSPACE</Text><Text style={[styles.title, { color: theme.text }]}>Applications</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Review candidate applications for your organization.</Text></View>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Back</Text></Pressable>
        </View>
        <View style={styles.stats}>
          {([['Total', counts?.total], ['New', counts?.new], ['Screening', counts?.screening], ['Shortlisted', counts?.shortlisted]] as const).map(([name, value]) => (
            <View key={name} style={[styles.stat, cardStyle]}><Text style={[styles.statValue, { color: theme.primary }]}>{loading ? '…' : value ?? 0}</Text><Text style={[styles.statLabel, { color: theme.textSecondary }]}>{name}</Text></View>
          ))}
        </View>
        <View style={[styles.filterCard, cardStyle]}>
          <View style={styles.searchRow}>
            <TextInput value={searchInput} onChangeText={setSearchInput} onSubmitEditing={() => void load({ ...filters, search: searchInput.trim() || undefined, page: 1 })} placeholder="Search candidate or job" placeholderTextColor={theme.textSecondary} returnKeyType="search" style={[styles.search, { color: theme.text, borderColor: theme.border }]} />
            <Pressable accessibilityRole="button" onPress={() => void load({ ...filters, search: searchInput.trim() || undefined, page: 1 })} style={[styles.primaryButton, { backgroundColor: theme.primary }]}><Text style={[styles.primaryText, { color: theme.primaryText }]}>Search</Text></Pressable>
          </View>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Status</Text>
          <View style={styles.chips}>{statuses.map((value) => <Pressable key={value} accessibilityRole="button" onPress={() => updateFilter('status', value)} style={[styles.chip, { borderColor: (filters.status ?? 'ALL') === value ? theme.primary : theme.border, backgroundColor: (filters.status ?? 'ALL') === value ? theme.primaryMuted : theme.backgroundElement }]}><Text style={{ color: (filters.status ?? 'ALL') === value ? theme.primary : theme.text }}>{label(value)}</Text></Pressable>)}</View>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Screening stage</Text>
          <View style={styles.chips}>{stages.map((value) => <Pressable key={value} accessibilityRole="button" onPress={() => updateFilter('stage', value)} style={[styles.chip, { borderColor: (filters.stage ?? 'ALL') === value ? theme.primary : theme.border, backgroundColor: (filters.stage ?? 'ALL') === value ? theme.primaryMuted : theme.backgroundElement }]}><Text style={{ color: (filters.stage ?? 'ALL') === value ? theme.primary : theme.text }}>{label(value)}</Text></Pressable>)}</View>
        </View>
        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading applications…</Text></View> : error ? (
          <View style={[styles.stateCard, cardStyle]}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={[styles.primaryButton, { backgroundColor: theme.primary }]}><Text style={[styles.primaryText, { color: theme.primaryText }]}>Try again</Text></Pressable></View>
        ) : result?.items.length ? (
          <View style={styles.list}>{result.items.map((application) => <Pressable key={application.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/application-details', params: { applicationId: String(application.id) } })} style={({ pressed }) => [styles.applicationCard, cardStyle, pressed && styles.pressed]}>
            <View style={styles.appHead}><Text style={[styles.jobTitle, { color: theme.text }]}>{application.job_title}</Text><Text style={[styles.badge, { color: theme.primary, backgroundColor: theme.primaryMuted }]}>{label(application.status)}</Text></View>
            <Text style={[styles.candidate, { color: theme.text }]}>{application.first_name} {application.last_name ?? ''}</Text><Text style={[styles.meta, { color: theme.textSecondary }]}>{application.email}</Text>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>Stage: {label(application.current_stage || 'APPLICATION')} · Applied {new Date(application.applied_at).toLocaleDateString()}</Text>
          </Pressable>)}</View>
        ) : <View style={[styles.stateCard, cardStyle]}><Text style={[styles.emptyTitle, { color: theme.text }]}>No applications found</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Adjust your search or filters to see other applications.</Text></View>}
        {result && result.total_pages > 1 ? <View style={styles.pagination}>
          <Pressable accessibilityRole="button" disabled={filters.page === 1 || loading} onPress={() => void load({ ...filters, page: (filters.page ?? 1) - 1 })} style={[styles.outlineButton, { borderColor: theme.border }, (filters.page === 1 || loading) && styles.disabled]}><Text style={{ color: theme.text }}>Previous</Text></Pressable>
          <Text style={{ color: theme.textSecondary }}>Page {result.page} of {result.total_pages} · {result.total} total</Text>
          <Pressable accessibilityRole="button" disabled={result.page >= result.total_pages || loading} onPress={() => void load({ ...filters, page: result.page + 1 })} style={[styles.outlineButton, { borderColor: theme.border }, (result.page >= result.total_pages || loading) && styles.disabled]}><Text style={{ color: theme.text }}>Next</Text></Pressable>
        </View> : result ? <Text style={[styles.total, { color: theme.textSecondary }]}>{result.total} application{result.total === 1 ? '' : 's'}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 1020, alignSelf: 'center', gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 }, heading: { flex: 1, gap: 6 }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 28, fontWeight: '800' }, subtitle: { fontSize: 14, lineHeight: 21 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, stat: { flexGrow: 1, flexBasis: '22%', minWidth: 130, borderWidth: 1, borderRadius: 15, padding: 16, gap: 6 }, statValue: { fontSize: 24, fontWeight: '800' }, statLabel: { fontSize: 12, fontWeight: '600' },
  filterCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 }, searchRow: { flexDirection: 'row', gap: 9 }, search: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 }, filterLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  primaryButton: { alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }, primaryText: { fontWeight: '700', fontSize: 13 }, outlineButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  state: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 }, stateCard: { borderWidth: 1, borderRadius: 15, padding: 21, gap: 12 }, error: { color: '#B42318', lineHeight: 21 }, emptyTitle: { fontSize: 17, fontWeight: '700' }, list: { gap: 10 }, applicationCard: { borderWidth: 1, borderRadius: 15, padding: 17, gap: 7 }, appHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, jobTitle: { flex: 1, fontSize: 16, fontWeight: '700' }, badge: { borderRadius: 15, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '700' }, candidate: { fontSize: 14, fontWeight: '600' }, meta: { fontSize: 12 }, pressed: { opacity: 0.72 }, disabled: { opacity: 0.5 }, pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, total: { fontSize: 12, textAlign: 'center' },
});
