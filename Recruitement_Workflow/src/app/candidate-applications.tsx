import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { isAxiosError } from 'axios';
import { useTheme } from '@/hooks/use-theme';
import { getMyApplications, withdrawMyApplication, type CandidateApplication } from '@/services/candidate-jobs.service';

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function displayValue(value: string | null | undefined) {
  if (!value) return 'Not assigned';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CandidateApplicationsScreen() {
  const theme = useTheme();
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [withdrawalId, setWithdrawalId] = useState<number | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalError, setWithdrawalError] = useState('');
  const [withdrawalBusy, setWithdrawalBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const loadApplications = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage('');
    try {
      // The candidate API attaches the session JWT; the backend scopes this query
      // to the candidate and organization IDs in that token.
      setApplications(await getMyApplications());
    } catch (error) {
      const message = isAxiosError(error) ? error.response?.data?.message : null;
      setErrorMessage(message ?? 'Unable to load your applications. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadApplications(); }, [loadApplications]));

  async function submitWithdrawal() {
    if (!withdrawalId || !withdrawalReason.trim()) {
      setWithdrawalError('Enter a reason before withdrawing.');
      return;
    }
    setWithdrawalBusy(true);
    setWithdrawalError('');
    try {
      await withdrawMyApplication(withdrawalId, withdrawalReason.trim());
      setWithdrawalId(null);
      setWithdrawalReason('');
      setNotice('Your application has been withdrawn. Its recruitment history has been preserved.');
      await loadApplications(true);
    } catch (cause) {
      const message = isAxiosError(cause) ? cause.response?.data?.message : null;
      setWithdrawalError(message ?? 'Unable to withdraw this application. Please try again.');
    } finally { setWithdrawalBusy(false); }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadApplications(true)} tintColor={theme.primary} />}
    >
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text>
            <Text style={[styles.title, { color: theme.text }]}>My applications</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Track the status and progress of your applications.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-dashboard')} style={[styles.headerButton, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text }}>Dashboard</Text>
          </Pressable>
        </View>

        {notice ? <Text style={[styles.notice, { color: theme.primary }]}>{notice}</Text> : null}

        {loading ? (
          <View style={styles.state}><ActivityIndicator size="large" color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading applications…</Text></View>
        ) : errorMessage ? (
          <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={styles.error}>{errorMessage}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadApplications()} style={[styles.actionButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.actionText, { color: theme.primaryText }]}>Try again</Text>
            </Pressable>
          </View>
        ) : applications.length === 0 ? (
          <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No applications yet</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>When you apply to a published job, it will appear here.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-jobs')} style={[styles.actionButton, { backgroundColor: theme.primary }]}>
              <Text style={[styles.actionText, { color: theme.primaryText }]}>Browse jobs</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {applications.map((application) => (
              <View key={application.id} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Text style={[styles.jobTitle, { color: theme.text }]}>{application.job_title}</Text>
                <View style={styles.statusRow}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Status</Text>
                  <Text style={[styles.status, { color: theme.primary }]}>{displayValue(application.status)}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Current stage</Text>
                  <Text style={[styles.value, { color: theme.text }]}>{displayValue(application.current_stage)}</Text>
                </View>
                <View style={styles.dates}>
                  <Text style={[styles.date, { color: theme.textSecondary }]}>Applied {formatDate(application.applied_at)}</Text>
                  <Text style={[styles.date, { color: theme.textSecondary }]}>Updated {formatDate(application.updated_at)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/candidate-job-details', params: { jobId: String(application.job_id) } })}
                  style={[styles.detailsButton, { borderColor: theme.border }]}
                >
                  <Text style={[styles.detailsText, { color: theme.primary }]}>View job details</Text>
                </Pressable>
                {application.has_accepted_offer === true || Number(application.has_accepted_offer) === 1 ? <Text style={[styles.withdrawInfo, { color: theme.textSecondary }]}>Offer accepted. Contact the recruiter to record a withdrawal.</Text> : null}
                {!(application.has_accepted_offer === true || Number(application.has_accepted_offer) === 1) && !['WITHDRAWN', 'REJECTED', 'HIRED'].includes(application.status) ? <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Withdraw application for ${application.job_title}`}
                  onPress={() => { setWithdrawalId(application.id); setWithdrawalReason(''); setWithdrawalError(''); }}
                  style={[styles.withdrawButton, { borderColor: '#B42318' }]}
                ><Text style={styles.withdrawText}>Withdraw application</Text></Pressable> : null}
              </View>
            ))}
          </View>
        )}
      </View>
      <Modal visible={withdrawalId !== null} transparent animationType="fade" onRequestClose={() => setWithdrawalId(null)}>
        <View style={styles.modalBackdrop}><View style={[styles.modalCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Withdraw this application?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your reason is required and will be recorded with this application. If you have accepted an offer, contact the recruiter to record the withdrawal.</Text>
          <TextInput value={withdrawalReason} onChangeText={setWithdrawalReason} multiline maxLength={5000} accessibilityLabel="Withdrawal reason" placeholder="Why are you withdrawing? (required)" placeholderTextColor={theme.textSecondary} style={[styles.reasonInput, { color: theme.text, borderColor: theme.border }]} />
          {withdrawalError ? <Text accessibilityRole="alert" style={styles.error}>{withdrawalError}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" disabled={withdrawalBusy} onPress={() => setWithdrawalId(null)} style={[styles.cancelButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>Keep application</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={withdrawalBusy || !withdrawalReason.trim()} onPress={() => void submitWithdrawal()} style={[styles.actionButton, { backgroundColor: '#B42318' }, (withdrawalBusy || !withdrawalReason.trim()) && styles.disabled]}>{withdrawalBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Confirm withdrawal</Text>}</Pressable>
          </View>
        </View></View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22 },
  page: { width: '100%', maxWidth: 920, alignSelf: 'center', gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  heading: { flex: 1, gap: 7 },
  eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  headerButton: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  state: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateCard: { borderWidth: 1, borderRadius: 18, padding: 24, gap: 14, alignItems: 'flex-start' },
  error: { color: '#B42318', fontSize: 14, lineHeight: 21 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  actionButton: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 10 },
  actionText: { fontSize: 14, fontWeight: '700' },
  list: { gap: 13 },
  card: { borderWidth: 1, borderRadius: 17, padding: 19, gap: 13 },
  jobTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 13 },
  status: { fontSize: 13, fontWeight: '700' },
  value: { fontSize: 13, fontWeight: '600' },
  dates: { gap: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D0D5DD', paddingTop: 11 },
  date: { fontSize: 12 },
  detailsButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  detailsText: { fontSize: 13, fontWeight: '700' },
  withdrawButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  withdrawText: { color: '#B42318', fontSize: 13, fontWeight: '700' },
  withdrawInfo: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  notice: { fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(16,24,40,0.55)' },
  modalCard: { width: '100%', maxWidth: 480, borderWidth: 1, borderRadius: 18, padding: 22, gap: 14 },
  reasonInput: { minHeight: 100, borderWidth: 1, borderRadius: 10, padding: 12, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9 },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 15 },
  disabled: { opacity: 0.5 },
});
