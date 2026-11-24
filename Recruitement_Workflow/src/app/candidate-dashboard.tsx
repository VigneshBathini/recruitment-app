import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { openURL } from 'expo-linking';
import { isAxiosError } from 'axios';
import { chooseResume, openMyResume, uploadMyResume } from '@/services/candidate-resume.service';
import { useTheme } from '@/hooks/use-theme';
import { getCandidateProfile, updateCandidateProfile, type CandidateProfile } from '@/services/candidate-auth.service';
import { removeCandidateToken } from '@/services/candidate-session.service';
import { getMyApplications, type CandidateApplication } from '@/services/candidate-jobs.service';
import { getMyOffers, isOfferExpired, type CandidateOffer } from '@/services/candidate-offers.service';
import { getMyOnboarding, getMyOnboardingRecord } from '@/services/candidate-onboarding.service';
import { getMyInterviews, type CandidateInterview } from '@/services/candidate-interviews.service';
import type { OnboardingDocument, OnboardingRecord, OnboardingTask } from '@/services/onboarding-management.service';

type OnboardingDetails = OnboardingRecord & { tasks?: OnboardingTask[]; documents?: OnboardingDocument[] };

function readable(value: string | null | undefined) {
  if (!value) return 'Not set';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const RECRUITMENT_STAGES = ['APPLIED', 'SCREENING', 'PHONE_SCREEN', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'OFFER', 'HIRED'];

function stageIndex(value: string | null | undefined) {
  const stage = (value || '').toUpperCase();
  if (stage === 'SHORTLISTED') return RECRUITMENT_STAGES.indexOf('SCREENING');
  return RECRUITMENT_STAGES.indexOf(stage);
}

function applicationProgress(application: CandidateApplication) {
  if (application.status === 'REJECTED') return 'Application closed';
  if (application.status === 'HIRED' || application.status === 'SELECTED') return 'Successfully hired';
  const stage = application.current_stage || application.status || 'APPLIED';
  return readable(stage);
}

type DashboardTheme = ReturnType<typeof useTheme>;

function SectionLoading({ theme }: { theme: DashboardTheme }) {
  return <View style={styles.sectionState}><ActivityIndicator size="small" color={theme.primary} /><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Loading…</Text></View>;
}

function SectionError({ message, retry, theme }: { message: string; retry: () => void; theme: DashboardTheme }) {
  return <View style={styles.sectionState}><Text style={styles.error}>{message}</Text><Pressable accessibilityRole="button" onPress={retry} style={[styles.outlineButton, { borderColor: theme.border, alignSelf: 'flex-start' }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>Retry this section</Text></Pressable></View>;
}

export default function CandidateDashboardScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<CandidateApplication[]>([]);
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingDetails[]>([]);
  const [sectionLoading, setSectionLoading] = useState({ profile: true, applications: true, interviews: true, offers: true, onboarding: true });
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeBusy, setResumeBusy] = useState(false);
  const [resumeMessage, setResumeMessage] = useState('');
  const [resumeError, setResumeError] = useState(false);
  const wide = width >= 760;

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    const sections = ['profile', 'applications', 'interviews', 'offers', 'onboarding'] as const;
    setSectionLoading((current) => Object.fromEntries(sections.map((section) => [section, true])) as typeof current);
    setSectionErrors({});
    const load = async (section: typeof sections[number], request: () => Promise<void>) => {
      try { await request(); }
      catch (error) {
        if (isAxiosError(error) && error.response?.status === 401) {
          await removeCandidateToken(); router.replace('/candidate-login'); return;
        }
        const message = isAxiosError(error) ? error.response?.data?.message : null;
        setSectionErrors((current) => ({ ...current, [section]: message ?? `Unable to load ${section}. Check your connection and try again.` }));
      } finally { setSectionLoading((current) => ({ ...current, [section]: false })); }
    };
    await Promise.all([
      load('profile', async () => { const value = await getCandidateProfile(); setProfile(value); setFirstName(value.first_name); setLastName(value.last_name ?? ''); setPhone(value.phone ?? ''); }),
      load('applications', async () => setApplications(await getMyApplications())),
      load('interviews', async () => setInterviews(await getMyInterviews())),
      load('offers', async () => setOffers(await getMyOffers())),
      load('onboarding', async () => { const records = await getMyOnboarding(); setOnboarding(await Promise.all(records.map((record) => getMyOnboardingRecord(record.id))) as OnboardingDetails[]); }),
    ]);
    setRefreshing(false);
  }, []);

  const retrySection = useCallback((section: 'profile' | 'applications' | 'interviews' | 'offers' | 'onboarding') => {
    const actions: Record<typeof section, () => Promise<void>> = {
      profile: async () => { const value = await getCandidateProfile(); setProfile(value); setFirstName(value.first_name); setLastName(value.last_name ?? ''); setPhone(value.phone ?? ''); },
      applications: async () => setApplications(await getMyApplications()),
      interviews: async () => setInterviews(await getMyInterviews()),
      offers: async () => setOffers(await getMyOffers()),
      onboarding: async () => { const records = await getMyOnboarding(); setOnboarding(await Promise.all(records.map((record) => getMyOnboardingRecord(record.id))) as OnboardingDetails[]); },
    };
    setSectionLoading((current) => ({ ...current, [section]: true }));
    setSectionErrors((current) => { const next = { ...current }; delete next[section]; return next; });
    void actions[section]().catch((error) => {
      if (isAxiosError(error) && error.response?.status === 401) { void removeCandidateToken().then(() => router.replace('/candidate-login')); return; }
      const message = isAxiosError(error) ? error.response?.data?.message : null;
      setSectionErrors((current) => ({ ...current, [section]: message ?? `Unable to load ${section}. Check your connection and try again.` }));
    }).finally(() => setSectionLoading((current) => ({ ...current, [section]: false })));
  }, []);

  async function saveProfile() {
    if (!firstName.trim()) { setProfileError(true); setProfileMessage('First name is required.'); return; }
    setProfileSaving(true); setProfileMessage(''); setProfileError(false);
    try {
      const updated = await updateCandidateProfile({ first_name: firstName.trim(), last_name: lastName.trim() || null, phone: phone.trim() || null });
      setProfile(updated); setFirstName(updated.first_name); setLastName(updated.last_name ?? ''); setPhone(updated.phone ?? ''); setProfileEditing(false); setProfileMessage('Profile updated.');
    } catch (error) { setProfileError(true); setProfileMessage(isAxiosError(error) ? error.response?.data?.message ?? 'Unable to update your profile.' : 'Unable to update your profile.'); }
    finally { setProfileSaving(false); }
  }

  useFocusEffect(useCallback(() => { void loadDashboard(); }, [loadDashboard]));

  async function signOut() {
    await removeCandidateToken();
    router.replace('/candidate-login');
  }

  async function selectAndUploadResume() {
    setResumeBusy(true); setResumeMessage(''); setResumeError(false);
    try {
      const selection = await chooseResume();
      if (selection.canceled) return;
      const asset = selection.assets[0];
      if (!asset) return;
      await uploadMyResume(asset);
      setResumeMessage('Your resume was uploaded.');
      await loadDashboard(true);
    } catch (cause) {
      setResumeError(true);
      setResumeMessage(cause instanceof Error ? cause.message : 'Unable to upload your resume. Try again.');
    } finally { setResumeBusy(false); }
  }

  const applicationStatuses = applications.reduce<Record<string, number>>((counts, application) => {
    const status = application.status || application.current_stage || 'UNKNOWN';
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const stageCounts = applications.reduce<Record<string, number>>((counts, application) => {
    if (!application.current_stage) return counts;
    counts[application.current_stage] = (counts[application.current_stage] ?? 0) + 1;
    return counts;
  }, {});
  const pendingOfferCount = offers.filter((offer) => offer.status === 'ISSUED' && !offer.candidate_responded_at && !isOfferExpired(offer.expiry_date)).length;
  const acceptedOfferCount = offers.filter((offer) => offer.status === 'ACCEPTED').length;
  const pendingTaskCount = onboarding.flatMap((record) => record.tasks ?? []).filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS').length;
  const pendingDocumentCount = onboarding.flatMap((record) => record.documents ?? []).filter((document) => document.review_status === 'PENDING').length;
  const metricWidth = wide ? '23.5%' : '48%';
  const hasData = applications.length > 0 || interviews.length > 0 || offers.length > 0 || onboarding.length > 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: theme.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={theme.primary} />}
    >
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text>
            <Text style={[styles.title, { color: theme.text }]}>Your dashboard</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={[styles.outlineButton, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text }}>Sign out</Text>
          </Pressable>
        </View>

        <>
          {sectionLoading.profile && !profile ? <View style={styles.state}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.textSecondary }}>Loading profile…</Text></View> : null}
          {sectionErrors.profile ? <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={styles.error}>{sectionErrors.profile}</Text><Pressable accessibilityRole="button" onPress={() => retrySection('profile')} style={[styles.actionButton, { backgroundColor: theme.primary }]}><Text style={[styles.actionText, { color: theme.primaryText }]}>Retry profile</Text></Pressable></View> : null}
          {profile ? <View style={[styles.profileCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.cardHeading}><Text style={[styles.welcome, { color: theme.text }]}>{profileEditing ? 'Edit your profile' : `Welcome, ${profile.first_name}`}</Text><Pressable accessibilityRole="button" onPress={() => { setProfileEditing((value) => !value); setProfileMessage(''); setProfileError(false); }} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>{profileEditing ? 'Cancel' : 'Edit profile'}</Text></Pressable></View>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>{profile.email}</Text>
              {profile.organization_slug ? <Text style={[styles.detail, { color: theme.textSecondary }]}>Organization: {profile.organization_slug}</Text> : null}
              {profileEditing ? <View style={styles.profileForm}>
                <TextInput accessibilityLabel="First name" value={firstName} onChangeText={setFirstName} placeholder="First name" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
                <TextInput accessibilityLabel="Last name" value={lastName} onChangeText={setLastName} placeholder="Last name" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
                <TextInput accessibilityLabel="Phone" value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, borderColor: theme.border }]} />
                <Pressable accessibilityRole="button" disabled={profileSaving} onPress={() => void saveProfile()} style={[styles.actionButton, { backgroundColor: theme.primary }, profileSaving && styles.disabled]}><Text style={[styles.actionText, { color: theme.primaryText }]}>{profileSaving ? 'Saving…' : 'Save profile'}</Text></Pressable>
                {profileMessage ? <Text accessibilityRole="alert" style={{ color: profileError ? theme.danger : theme.success }}>{profileMessage}</Text> : null}
              </View> : null}
              <View style={[styles.resumePanel, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={styles.resumeCopy}><Text style={[styles.resumeTitle, { color: theme.text }]}>{profile.resume_url ? 'Resume on your profile' : 'Add a resume to your profile'}</Text><Text style={[styles.detail, { color: theme.textSecondary }]}>{profile.resume_url ? 'Your current resume will be attached to new applications.' : 'Upload a PDF, DOC, or DOCX file up to 10 MB. Existing applications keep their submitted copy.'}</Text></View>
                <View style={styles.resumeActions}>
                  {profile.resume_url ? <><Pressable accessibilityRole="button" disabled={resumeBusy} onPress={() => void openMyResume().catch((cause) => { setResumeError(true); setResumeMessage(cause instanceof Error ? cause.message : 'Unable to open resume.'); })} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>Preview resume</Text></Pressable><Pressable accessibilityRole="button" disabled={resumeBusy} onPress={() => void openMyResume(true).catch((cause) => { setResumeError(true); setResumeMessage(cause instanceof Error ? cause.message : 'Unable to download resume.'); })} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.primary, fontWeight: '700' }}>Download resume</Text></Pressable></> : null}
                  <Pressable accessibilityRole="button" disabled={resumeBusy} onPress={() => void selectAndUploadResume()} style={[styles.actionButton, { backgroundColor: theme.primary }, resumeBusy && styles.disabled]}><Text style={[styles.actionText, { color: theme.primaryText }]}>{resumeBusy ? 'Uploading…' : profile.resume_url ? 'Replace resume' : 'Upload resume'}</Text></Pressable>
                </View>
                {resumeMessage ? <Text accessibilityRole="alert" style={{ color: resumeError ? theme.danger : theme.success }}>{resumeMessage}</Text> : null}
              </View>
              <Text style={[styles.note, { color: theme.textSecondary }]}>Explore published openings from your organization and apply when you find the right fit.</Text>
              <View style={styles.navigation}>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-jobs')} style={[styles.actionButton, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.actionText, { color: theme.primaryText }]}>Browse published jobs</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-applications')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My applications</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-offers')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My offers</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push('/candidate-onboarding')} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>My onboarding</Text></Pressable>
              </View>
            </View>
          : null}

            {(
              <>
                <View style={styles.sectionHeading}>
                  <View style={styles.heading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Your progress</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Summaries for your applications, offers, and onboarding.</Text></View>
                  <Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void loadDashboard(true)} style={[styles.outlineButton, { borderColor: theme.border }]}><Text style={{ color: theme.text }}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text></Pressable>
                </View>

                <View style={styles.metrics}>
                  {[
                    { label: 'Total applications', value: applications.length },
                    { label: 'Pending offer responses', value: pendingOfferCount },
                    { label: 'Accepted offers', value: acceptedOfferCount },
                    { label: 'Pending onboarding tasks', value: pendingTaskCount },
                    { label: 'Documents awaiting review', value: pendingDocumentCount },
                  ].map((metric) => <View key={metric.label} style={[styles.metricCard, { width: metricWidth, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <Text style={[styles.metricValue, { color: theme.primary }]}>{metric.value}</Text><Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{metric.label}</Text>
                  </View>)}
                </View>

                <View style={[styles.summaryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Applications by status</Text>
                  {sectionLoading.applications && !applications.length ? <SectionLoading theme={theme} /> : sectionErrors.applications ? <SectionError message={sectionErrors.applications} retry={() => retrySection('applications')} theme={theme} /> : Object.keys(applicationStatuses).length ? Object.entries(applicationStatuses).map(([status, count]) => <View key={status} style={styles.countRow}><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(status)}</Text><Text style={[styles.summaryValue, { color: theme.text }]}>{count}</Text></View>) : <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No application status information yet.</Text>}
                  {Object.keys(stageCounts).length ? <><Text style={[styles.subheading, { color: theme.text }]}>Current stage</Text>{Object.entries(stageCounts).map(([stage, count]) => <View key={stage} style={styles.countRow}><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(stage)}</Text><Text style={[styles.summaryValue, { color: theme.text }]}>{count}</Text></View>)}</> : null}
                </View>

                <View style={styles.columns}>
                  <View style={[styles.summaryCard, styles.column, wide ? styles.columnWide : styles.columnNarrow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Interviews</Text>
                    {sectionLoading.interviews && !interviews.length ? <SectionLoading theme={theme} /> : sectionErrors.interviews ? <SectionError message={sectionErrors.interviews} retry={() => retrySection('interviews')} theme={theme} /> : interviews.length ? interviews.map((interview) => {
                      const scheduledDate = new Date(interview.scheduled_at);
                      const when = Number.isNaN(scheduledDate.getTime()) ? 'Date unavailable' : scheduledDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                      return <View key={interview.id} style={[styles.listItem, { borderTopColor: theme.border }]}>
                        <View style={styles.cardHeading}><Text style={[styles.itemTitle, styles.interviewTitle, { color: theme.text }]}>{interview.job_title}</Text><Text style={[styles.statusPill, { color: theme.primary, backgroundColor: theme.background }]}>{readable(interview.status)}</Text></View>
                        <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(interview.interview_type)} · {when} · {interview.duration_minutes} min</Text>
                        {interview.interviewers.length ? <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Interviewer{interview.interviewers.length === 1 ? '' : 's'}: {interview.interviewers.map((person) => person.name).join(', ')}</Text> : null}
                        {interview.status === 'SCHEDULED' && interview.meeting_url ? <Pressable accessibilityRole="link" accessibilityLabel="Join interview" onPress={() => { if (interview.meeting_url) void openURL(interview.meeting_url); }}><Text style={{ color: theme.primary, fontWeight: '700' }}>Join interview</Text></Pressable> : null}
                        {interview.status === 'SCHEDULED' && !interview.meeting_url && interview.location ? <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Location: {interview.location}</Text> : null}
                        {interview.status === 'CANCELLED' ? <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>This interview was cancelled.</Text> : null}
                      </View>;
                    }) : <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No interviews have been scheduled yet.</Text>}
                  </View>

                  <View style={[styles.summaryCard, styles.column, wide ? styles.columnWide : styles.columnNarrow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <View style={styles.cardHeading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Recent applications</Text><Pressable onPress={() => router.push('/candidate-applications')}><Text style={{ color: theme.primary, fontWeight: '700' }}>View all</Text></Pressable></View>
                    {sectionLoading.applications && !applications.length ? <SectionLoading theme={theme} /> : sectionErrors.applications ? <SectionError message={sectionErrors.applications} retry={() => retrySection('applications')} theme={theme} /> : applications.map((application) => {
                      const stage = application.current_stage || application.status || 'APPLIED';
                      const activeIndex = stageIndex(stage);
                      const terminal = application.status === 'REJECTED' || application.status === 'HIRED';
                      return <View key={application.id} style={[styles.applicationItem, { borderTopColor: theme.border }]}>
                        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/candidate-job-details', params: { jobId: String(application.job_id) } })} style={styles.applicationHeading}>
                          <View style={styles.heading}><Text style={[styles.itemTitle, { color: theme.text }]}>{application.job_title}</Text><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Applied {formatDate(application.applied_at)}</Text></View>
                          <Text style={[styles.statusPill, { color: theme.primary, backgroundColor: theme.background }]}>{applicationProgress(application)}</Text>
                        </Pressable>
                        {application.status === 'REJECTED' ? <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>This application has ended.</Text> : <View accessibilityLabel={`Recruitment progress: ${applicationProgress(application)}`} style={styles.timeline}>
                          {RECRUITMENT_STAGES.map((item, index) => {
                            const done = terminal ? false : index <= activeIndex;
                            const current = !terminal && index === activeIndex;
                            return <View key={item} style={styles.timelineStep}>
                              <View style={[styles.timelineDot, { backgroundColor: done ? theme.primary : theme.border }, current && styles.timelineCurrent]} />
                              <Text numberOfLines={2} style={[styles.timelineLabel, { color: current ? theme.text : theme.textSecondary }]}>{readable(item)}</Text>
                            </View>;
                          })}
                        </View>}
                      </View>;
                    })}
                    {!sectionLoading.applications && !sectionErrors.applications && applications.length === 0 ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No applications yet. Browse jobs to get started.</Text> : null}
                  </View>

                  <View style={[styles.summaryCard, styles.column, wide ? styles.columnWide : styles.columnNarrow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <View style={styles.cardHeading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Offers</Text><Pressable onPress={() => router.push('/candidate-offers')}><Text style={{ color: theme.primary, fontWeight: '700' }}>View all</Text></Pressable></View>
                    {sectionLoading.offers && !offers.length ? <SectionLoading theme={theme} /> : sectionErrors.offers ? <SectionError message={sectionErrors.offers} retry={() => retrySection('offers')} theme={theme} /> : offers.slice(0, 3).map((offer) => <Pressable key={offer.id} onPress={() => router.push({ pathname: '/candidate-offer-details', params: { offerId: String(offer.id) } })} style={[styles.listItem, { borderTopColor: theme.border }]}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{offer.job_title}</Text><Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{readable(offer.status)} · {offer.currency} {offer.annual_ctc}</Text>
                    </Pressable>)}
                    {!sectionLoading.offers && !sectionErrors.offers && offers.length === 0 ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>No offers are available yet.</Text> : null}
                  </View>
                </View>

                <View style={[styles.summaryCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <View style={styles.cardHeading}><Text style={[styles.sectionTitle, { color: theme.text }]}>Onboarding</Text><Pressable onPress={() => router.push('/candidate-onboarding')}><Text style={{ color: theme.primary, fontWeight: '700' }}>View all</Text></Pressable></View>
                  {sectionLoading.onboarding && !onboarding.length ? <SectionLoading theme={theme} /> : sectionErrors.onboarding ? <SectionError message={sectionErrors.onboarding} retry={() => retrySection('onboarding')} theme={theme} /> : onboarding.length ? onboarding.map((record) => {
                    const tasks = record.tasks ?? [];
                    const pendingTasks = tasks.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS').length;
                    const waitingDocuments = (record.documents ?? []).filter((document) => document.review_status === 'PENDING').length;
                    return <Pressable key={record.id} onPress={() => router.push({ pathname: '/candidate-onboarding-details', params: { onboardingId: String(record.id) } })} style={[styles.listItem, { borderTopColor: theme.border }]}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>{record.job_title} · {readable(record.status)}</Text>
                      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Joining date: {formatDate(record.target_join_date)} · {pendingTasks} pending tasks · {waitingDocuments} documents awaiting review</Text>
                    </Pressable>;
                  }) : <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Onboarding progress will appear here when a record is available.</Text>}
                </View>

                {!Object.values(sectionLoading).some(Boolean) && !Object.keys(sectionErrors).length && !hasData ? <View style={[styles.stateCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}><Text style={[styles.itemTitle, { color: theme.text }]}>No recruitment activity yet</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Browse published jobs to find an opportunity and track your progress here.</Text></View> : null}
              </>
            )}
          </>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 22, paddingBottom: 36 },
  page: { width: '100%', maxWidth: 1040, alignSelf: 'center', gap: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  heading: { flex: 1, gap: 6 },
  eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 21 },
  outlineButton: { minHeight: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  state: { minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateCard: { borderWidth: 1, borderRadius: 17, padding: 20, gap: 12 },
  error: { color: '#B42318', fontSize: 14, lineHeight: 21 },
  profileCard: { borderWidth: 1, borderRadius: 20, padding: 22, gap: 9 },
  profileForm: { gap: 10, marginVertical: 5 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sectionState: { gap: 10, alignItems: 'flex-start', paddingVertical: 8 },
  welcome: { fontSize: 21, fontWeight: '700' },
  detail: { fontSize: 14 },
  note: { fontSize: 14, lineHeight: 21, marginTop: 5 },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 8 },
  actionButton: { minHeight: 42, justifyContent: 'center', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 11 },
  disabled: { opacity: 0.5 },
  actionText: { fontSize: 14, fontWeight: '700' },
  resumePanel: { borderWidth: 1, borderRadius: 14, padding: 15, gap: 10 },
  resumeCopy: { gap: 5 },
  resumeTitle: { fontSize: 15, fontWeight: '800' },
  resumeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  metricCard: { minHeight: 100, borderWidth: 1, borderRadius: 15, padding: 15, justifyContent: 'center', gap: 6 },
  metricValue: { fontSize: 25, fontWeight: '800' },
  metricLabel: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  summaryCard: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 11 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  summaryLabel: { fontSize: 13, lineHeight: 19 },
  summaryValue: { fontSize: 14, fontWeight: '700' },
  subheading: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  column: { flexGrow: 1 },
  columnWide: { flexBasis: 320 },
  columnNarrow: { flexBasis: '100%' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  listItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, gap: 4 },
  applicationItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 13, gap: 12 },
  applicationHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  timeline: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  timelineStep: { flex: 1, alignItems: 'center', gap: 6 },
  timelineDot: { width: 9, height: 9, borderRadius: 6 },
  timelineCurrent: { width: 13, height: 13, borderWidth: 2, borderColor: '#FFFFFF' },
  timelineLabel: { fontSize: 9, lineHeight: 12, textAlign: 'center' },
  itemTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  interviewTitle: { flex: 1 },
});
