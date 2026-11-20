import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { isAxiosError } from 'axios';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { getMyOffer, respondToMyOffer, type CandidateOffer } from '@/services/candidate-offers.service';

function dateLabel(value: string | null) {
  if (!value) return 'Not specified';
  const date = value.slice(0, 10);
  const [year, month, day] = date.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day).toLocaleDateString() : value;
}

export default function CandidateOfferDetailsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ offerId?: string }>();
  const offerId = Number(params.offerId);
  const [offer, setOffer] = useState<CandidateOffer | null>(null);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!Number.isSafeInteger(offerId) || offerId <= 0) { setErrorMessage('Invalid offer ID.'); setLoading(false); return; }
    refresh ? setRefreshing(true) : setLoading(true);
    setErrorMessage('');
    try { setOffer(await getMyOffer(offerId)); }
    catch (error) { setErrorMessage((isAxiosError(error) ? error.response?.data?.message : null) ?? 'Unable to load this offer.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [offerId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function respond(action: 'accept' | 'decline') {
    if (!offer || offer.status !== 'ISSUED') return;
    setSubmitting(true);
    setErrorMessage('');
    try { setOffer(await respondToMyOffer(offer.id, action, comments)); }
    catch (error) { setErrorMessage((isAxiosError(error) ? error.response?.data?.message : null) ?? 'Unable to submit your response. Refresh and try again.'); }
    finally { setSubmitting(false); }
  }

  return (
    <ScrollView contentContainerStyle={[styles.content, { backgroundColor: theme.background }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={theme.primary} />}>
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.heading}><Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text><Text style={[styles.title, { color: theme.text }]}>Offer details</Text></View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-offers')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My offers</Text></Pressable>
        </View>
        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading offer…</Text></View>
          : !offer ? <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={styles.error}>{errorMessage || 'Offer not found.'}</Text></View>
            : <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Text style={[styles.jobTitle, { color: theme.text }]}>{offer.job_title}</Text>
              <Text style={[styles.status, { color: theme.primary }]}>{offer.status.replace(/_/g, ' ')}</Text>
              <View style={styles.term}><Text style={[styles.label, { color: theme.textSecondary }]}>Annual CTC</Text><Text style={[styles.value, { color: theme.text }]}>{offer.currency} {offer.annual_ctc}</Text></View>
              <View style={styles.term}><Text style={[styles.label, { color: theme.textSecondary }]}>Employment type</Text><Text style={[styles.value, { color: theme.text }]}>{offer.employment_type}</Text></View>
              <View style={styles.term}><Text style={[styles.label, { color: theme.textSecondary }]}>Work location</Text><Text style={[styles.value, { color: theme.text }]}>{offer.work_location || 'Not specified'}</Text></View>
              <View style={styles.term}><Text style={[styles.label, { color: theme.textSecondary }]}>Start date</Text><Text style={[styles.value, { color: theme.text }]}>{dateLabel(offer.start_date)}</Text></View>
              <View style={styles.term}><Text style={[styles.label, { color: theme.textSecondary }]}>Expiry date</Text><Text style={[styles.value, { color: theme.text }]}>{dateLabel(offer.expiry_date)}</Text></View>
              <View style={styles.term}><Text style={[styles.label, { color: theme.textSecondary }]}>Issued</Text><Text style={[styles.value, { color: theme.text }]}>{dateLabel(offer.issued_at)}</Text></View>
              {offer.offer_letter_url ? <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(offer.offer_letter_url!)}><Text style={[styles.link, { color: theme.primary }]}>Open offer letter</Text></Pressable> : null}
              {offer.candidate_responded_at ? <View style={styles.response}><Text style={[styles.label, { color: theme.textSecondary }]}>Response date: {dateLabel(offer.candidate_responded_at)}</Text><Text style={[styles.value, { color: theme.text }]}>Comments: {offer.candidate_response_comments || 'None'}</Text></View> : null}
              {offer.status === 'ISSUED' ? <View style={styles.responseForm}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Comments (optional)</Text>
                <TextInput value={comments} onChangeText={setComments} multiline maxLength={5000} placeholder="Add a comment" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
                {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void respond('accept')} style={[styles.action, { backgroundColor: theme.primary, opacity: submitting ? 0.6 : 1 }]}><Text style={[styles.actionText, { color: theme.primaryText }]}>{submitting ? 'Submitting…' : 'Accept offer'}</Text></Pressable>
                  <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void respond('decline')} style={[styles.action, styles.decline, { borderColor: theme.border, opacity: submitting ? 0.6 : 1 }]}><Text style={[styles.actionText, { color: theme.text }]}>Decline offer</Text></Pressable>
                </View>
              </View> : null}
            </View>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22 }, page: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 24 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  heading: { flex: 1, gap: 7 }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' }, title: { fontSize: 28, fontWeight: '800' },
  outlineButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }, state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 22, gap: 16 }, jobTitle: { fontSize: 21, fontWeight: '800' }, status: { fontSize: 14, fontWeight: '800' }, term: { gap: 5 }, label: { fontSize: 13 }, value: { fontSize: 15, fontWeight: '600' },
  link: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' }, response: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D0D5DD', paddingTop: 14 }, responseForm: { gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D0D5DD', paddingTop: 16 },
  input: { minHeight: 90, borderWidth: 1, borderRadius: 10, padding: 12, textAlignVertical: 'top' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, action: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 }, decline: { borderWidth: 1 }, actionText: { fontSize: 14, fontWeight: '700' }, error: { color: '#B42318' },
});
