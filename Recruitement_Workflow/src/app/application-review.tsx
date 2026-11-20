import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getApplicationReviewQueue, type ReviewQueueItem } from '@/services/application-management.service';

export default function ApplicationReviewQueue() {
  const theme = useTheme();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getApplicationReviewQueue()); setError(''); }
    catch (cause) { setError(isAxiosError(cause) ? cause.response?.data?.message ?? 'Unable to load review queue' : 'Unable to load review queue'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <ScrollView contentContainerStyle={[styles.page, { backgroundColor: theme.background }]}>
    <Pressable onPress={() => router.back()}><Text style={{ color: theme.primary, fontWeight: '700' }}>← Dashboard</Text></Pressable>
    <Text style={[styles.title, { color: theme.text }]}>Application review</Text>
    <Text style={{ color: theme.textSecondary }}>Shortlisted applications with completed interviews.</Text>
    {loading ? <ActivityIndicator color={theme.primary} /> : error ? <Text style={styles.error}>{error}</Text> : items.length === 0 ? <Text style={{ color: theme.textSecondary }}>No applications are awaiting review.</Text> : items.map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: '/application-review-details', params: { applicationId: String(item.id) } } as never)} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.name, { color: theme.text }]}>{item.first_name} {item.last_name ?? ''}</Text>
      <Text style={{ color: theme.textSecondary }}>{item.job_title} · {item.email}</Text>
      <Text style={{ color: theme.textSecondary }}>Status: {item.status} · Completed interviews: {item.completed_interview_count}</Text>
      <Text style={{ color: theme.textSecondary }}>Feedback: {item.feedback_available ? 'Available' : 'Not submitted'}</Text>
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ page: { flexGrow: 1, padding: 22, gap: 14 }, title: { fontSize: 26, fontWeight: '800' }, card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6 }, name: { fontSize: 17, fontWeight: '700' }, error: { color: '#B42318' } });
