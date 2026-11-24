import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import axios from 'axios';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { JobButton, JobPageHeader, JobState, JobStatusBadge, jobCardStyle } from '@/components/job-management-ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getManagementOffers, getSelectedApplications, type ManagementOffer } from '@/services/management-offers.service';
import type { ManagedApplication } from '@/services/application-management.service';

function errorMessage(error: unknown) { return axios.isAxiosError<{ message?: string }>(error) ? error.response?.data?.message ?? 'Unable to load offer management.' : error instanceof Error ? error.message : 'Unable to load offer management.'; }
function candidateName(candidate: ManagedApplication) { return `${candidate.first_name} ${candidate.last_name ?? ''}`.trim(); }

export default function OffersScreen() {
  const router = useRouter(); const theme = useTheme(); const { width } = useWindowDimensions();
  const [offers, setOffers] = useState<ManagementOffer[]>([]); const [selectedCandidates, setSelectedCandidates] = useState<ManagedApplication[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [applicationError, setApplicationError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const load = useCallback(async () => {
    setLoading(true); setError(''); setApplicationError('');
    try {
      const context = await getCurrentOrganizationUser(); const userPermissions = context.permissions ?? []; setPermissions(userPermissions);
      if (!['offer.view', 'offer.manage', 'offer.approve', 'offer.issue'].some((permission) => userPermissions.includes(permission))) { throw new Error('Your role does not have permission to view offers.'); }
      if (!userPermissions.includes('offer.view')) { setOffers([]); setError('Offer viewing permission is required to load this list. Ask your organization administrator for offer.view access.'); return; }
      const offerData = await getManagementOffers(); setOffers(offerData);
      if (userPermissions.includes('offer.manage') && userPermissions.includes('application.view')) {
        try { const applications = await getSelectedApplications(); const activeApplicationIds = new Set(offerData.filter((offer) => !['REJECTED'].includes(offer.status)).map((offer) => Number(offer.application_id))); setSelectedCandidates(applications.filter((application) => !activeApplicationIds.has(Number(application.id)))); }
        catch (problem) { setSelectedCandidates([]); setApplicationError(errorMessage(problem)); }
      } else setSelectedCandidates([]);
    } catch (problem) { setError(errorMessage(problem)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const wide = width >= 760;
  const visibleOffers = permissions.includes('offer.approve') && !permissions.includes('offer.manage') ? offers.filter((offer) => offer.status === 'PENDING_APPROVAL') : offers;
  const filteredOffers = statusFilter === 'ALL' ? visibleOffers : visibleOffers.filter((offer) => offer.status === statusFilter);
  return <ThemedView style={styles.screen}><ScrollView contentContainerStyle={styles.content}><View style={styles.page}>
    <JobPageHeader title="Offer management" subtitle="Prepare offers for selected candidates, route them for approval, and track candidate responses." onBack={() => router.back()} />
    <JobState loading={loading} error={!loading && error ? error : undefined} onRetry={() => void load()} />
    {!loading && !error ? <>
      {permissions.includes('offer.manage') ? <View style={[styles.summary, { backgroundColor: theme.primaryMuted }]}><View style={{ flex: 1, gap: 6 }}><ThemedText style={styles.summaryTitle}>Selected candidates</ThemedText><ThemedText style={{ color: theme.textSecondary, lineHeight: 20 }}>Create an offer for a selected candidate who does not have an active offer. Rejected offers can be revised from their offer record.</ThemedText></View><ThemedText style={{ color: theme.primary, fontWeight: '800' }}>{selectedCandidates.length} ready</ThemedText></View> : null}
      {permissions.includes('offer.manage') ? <View style={styles.section}><ThemedText style={styles.sectionTitle}>Ready for an offer</ThemedText>
        {applicationError ? <JobState error={applicationError} onRetry={() => void load()} /> : null}
        {!applicationError && selectedCandidates.length === 0 ? <JobState empty="No selected candidates are currently available for a new offer." /> : null}
        <View style={styles.grid}>{selectedCandidates.map((application) => <View key={application.id} style={[jobCardStyle(theme.backgroundElement, theme.border), { width: wide ? '48.8%' : '100%' }]}>
          <View style={styles.person}><View style={[styles.avatar, { backgroundColor: theme.primaryMuted }]}><ThemedText style={{ color: theme.primary, fontWeight: '800' }}>{candidateName(application).split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</ThemedText></View><View style={{ flex: 1, gap: 4 }}><ThemedText style={styles.cardTitle}>{candidateName(application)}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{application.email}</ThemedText></View></View>
          <ThemedText style={{ color: theme.textSecondary }}>{application.job_title} · Application #{application.id}</ThemedText>
          <JobButton label="Create offer" onPress={() => router.push({ pathname: '/offer-details', params: { applicationId: String(application.id) } } as never)} />
        </View>)}</View>
      </View> : null}
      <View style={styles.section}><ThemedText style={styles.sectionTitle}>{permissions.includes('offer.approve') && !permissions.includes('offer.manage') ? 'Pending approvals' : 'Offers'}</ThemedText>
        <View style={styles.filters}>{['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ISSUED', 'EXPIRED', 'ACCEPTED', 'DECLINED'].map((status) => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: statusFilter === status }} onPress={() => setStatusFilter(status)} style={[styles.filter, { borderColor: statusFilter === status ? theme.primary : theme.border, backgroundColor: statusFilter === status ? theme.primaryMuted : theme.backgroundElement }]}><ThemedText style={{ color: statusFilter === status ? theme.primary : theme.textSecondary, fontWeight: '700', fontSize: 12 }}>{status === 'ALL' ? 'All statuses' : status.replace(/_/g, ' ')}</ThemedText></Pressable>)}</View>
        {filteredOffers.length === 0 ? <JobState empty={visibleOffers.length === 0 ? (permissions.includes('offer.approve') && !permissions.includes('offer.manage') ? 'There are no offers awaiting your approval.' : 'No offers yet.') : `No ${statusFilter.toLowerCase().replace(/_/g, ' ')} offers.`} /> : <View style={styles.grid}>{filteredOffers.map((offer) => {
          const candidate = offer.candidate ? `${offer.candidate.first_name} ${offer.candidate.last_name ?? ''}`.trim() : `${offer.candidate_first_name ?? ''} ${offer.candidate_last_name ?? ''}`.trim();
          return <Pressable accessibilityRole="button" key={offer.id} onPress={() => router.push({ pathname: '/offer-details', params: { offerId: String(offer.id) } } as never)} style={({ pressed }) => [jobCardStyle(theme.backgroundElement, theme.border), styles.offerCard, { width: wide ? '48.8%' : '100%', opacity: pressed ? 0.75 : 1 }]}>
            <View style={styles.offerTop}><View style={{ flex: 1, gap: 5 }}><ThemedText style={styles.cardTitle}>{candidate || `Application #${offer.application_id}`}</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{offer.job?.title ?? offer.job_title} · #{offer.id}</ThemedText></View><JobStatusBadge status={offer.status} /></View>
            <ThemedText style={{ color: theme.textSecondary }}>{offer.currency} {Number(offer.annual_ctc).toLocaleString()} · Starts {new Date(offer.start_date).toLocaleDateString()}</ThemedText>
            <ThemedText style={{ color: offer.expiry_date && new Date(`${offer.expiry_date}T00:00:00`) < new Date() ? theme.danger : theme.textSecondary }}>Expires {offer.expiry_date ? new Date(`${offer.expiry_date}T00:00:00`).toLocaleDateString() : 'No deadline'}</ThemedText>
            {offer.candidate_responded_at ? <ThemedText style={{ color: theme.success, fontWeight: '700' }}>Candidate response · {offer.status}{offer.candidate_response_comments ? `: ${offer.candidate_response_comments}` : ''}</ThemedText> : offer.status === 'ISSUED' ? <ThemedText style={{ color: theme.primary }}>Awaiting candidate response</ThemedText> : null}
            <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Open offer  ›</ThemedText>
          </Pressable>;
        })}</View>}
      </View>
    </> : null}
  </View></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five }, page: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four }, summary: { padding: Spacing.three, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }, summaryTitle: { fontSize: 16, fontWeight: '800' }, section: { gap: 13 }, sectionTitle: { fontSize: 19, fontWeight: '800' }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filter: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, person: { flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, cardTitle: { fontSize: 15, fontWeight: '800' }, offerCard: { gap: 11 }, offerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 } });
