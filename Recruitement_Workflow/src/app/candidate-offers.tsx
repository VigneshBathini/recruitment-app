import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getMyOffers, type CandidateOffer } from '@/services/candidate-offers.service';

function displayStatus(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CandidateOffersScreen() {
  const theme = useTheme();
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setErrorMessage('');
    try { setOffers(await getMyOffers()); }
    catch (error) {
      setErrorMessage((isAxiosError(error) ? error.response?.data?.message : null) ?? 'Unable to load your offers.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text>
            <Text style={[styles.title, { color: theme.text }]}>My offers</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Review your offer terms and respond to issued offers.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-dashboard')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Dashboard</Text></Pressable>
        </View>
        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading offers…</Text></View>
          : errorMessage ? <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={styles.error}>{errorMessage}</Text><Pressable onPress={() => void load()} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={{ color: theme.primaryText, fontWeight: '700' }}>Try again</Text></Pressable></View>
            : offers.length === 0 ? <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={[styles.subtitle, { color: theme.text }]}>No offers available yet.</Text></View>
              : <View style={styles.list}>{offers.map((offer) => <Pressable key={offer.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/candidate-offer-details', params: { offerId: String(offer.id) } })} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Text style={[styles.jobTitle, { color: theme.text }]}>{offer.job_title}</Text>
                <Text style={{ color: theme.textSecondary }}>Annual CTC: {offer.currency} {offer.annual_ctc}</Text>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>{displayStatus(offer.status)}</Text>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>View offer details</Text>
              </Pressable>)}</View>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, heading: { flex: 1, gap: 7 },
  eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 28, fontWeight: '800' }, subtitle: { fontSize: 14, lineHeight: 21 },
  outlineButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  list: { gap: 13 }, card: { borderWidth: 1, borderRadius: 17, padding: 19, gap: 12 }, jobTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  button: { alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10 }, error: { color: '#B42318' },
});
