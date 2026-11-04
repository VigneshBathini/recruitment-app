import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser, logoutUser } from '@/services/auth.service';
import type { OrganizationContext } from '@/services/token.service';
import { getPendingRequirements, getRequirements } from '@/services/requirement.service';
import type { Requirement } from '@/services/requirement.service';

const modules = [
  { title: 'Requirements', key: 'requirement', permission: 'requirement.view', icon: 'R' },
  { title: 'Jobs', key: 'job', permission: 'job.view', icon: 'J' },
  { title: 'Candidates', key: 'candidate', permission: 'candidate.view', icon: 'C' },
  { title: 'Applications', key: 'application', permission: 'application.view', icon: 'A' },
  { title: 'Interviews', key: 'interview', permission: 'interview.view', icon: 'I' },
  { title: 'Offers', key: 'offer', permission: 'offer.view', icon: 'O' },
  { title: 'Onboarding', key: 'onboarding', permission: 'onboarding.view', icon: 'N' },
];

export function RoleDashboard({ role }: { role: 'Recruiter' | 'Hiring Manager' | 'Interviewer' }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [context, setContext] = useState<OrganizationContext | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const wide = width >= 760;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getCurrentOrganizationUser();
        if (!active) return;
        setContext(current);
        if (current.permissions.includes('requirement.view') || current.permissions.includes('requirement.approve')) {
          const rows = current.permissions.includes('requirement.view')
            ? await getRequirements()
            : await getPendingRequirements();
          if (active) setRequirements(rows);
        }
      } catch (error) {
        console.error('Unable to load dashboard context:', error);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const permittedModules = modules.filter((item) => context?.permissions.some((permission) =>
    permission === item.permission || permission === `${item.key}.manage` || permission === `${item.key}.approve`,
  ));
  const cards = [
    { label: 'Approved requirements', value: loading ? '…' : context?.permissions.includes('requirement.view') ? String(requirements.filter((item) => item.status === 'APPROVED').length) : '—' },
    { label: 'Pending approval', value: loading ? '…' : context?.permissions.some((permission) => permission === 'requirement.view' || permission === 'requirement.approve') ? String(requirements.filter((item) => item.status === 'PENDING_APPROVAL').length) : '—' },
    { label: 'Organization', value: context?.name ?? (loading ? '…' : '—') },
  ];

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <View style={styles.top}>
            <View><ThemedText style={styles.brand}>Recruitment</ThemedText><ThemedText style={[styles.caption, { color: theme.textSecondary }]}>WORKFLOW PLATFORM</ThemedText></View>
            <Pressable onPress={() => void logoutUser().then(() => router.replace('/login'))} style={[styles.signOut, { borderColor: theme.border }]}><ThemedText>Sign out</ThemedText></Pressable>
          </View>
          <View style={styles.hero}>
            <ThemedText style={styles.eyebrow}>{role.toUpperCase()} WORKSPACE</ThemedText>
            <ThemedText style={styles.title}>Welcome{context ? ` to ${context.name}` : ''}</ThemedText>
            <ThemedText style={styles.subtitle}>Your recruitment work, priorities, and team tools in one place.</ThemedText>
          </View>
          <View style={styles.stats}>
            {cards.map((card) => <View key={card.label} style={[styles.statCard, { width: wide ? '32%' : '100%', backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText style={[styles.statValue, { color: theme.primary }]}>{card.value}</ThemedText><ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{card.label}</ThemedText>
            </View>)}
          </View>
          <View style={styles.section}>
            <View><ThemedText style={styles.sectionTitle}>Recruitment modules</ThemedText><ThemedText style={[styles.sectionCaption, { color: theme.textSecondary }]}>Available modules follow your organization role permissions.</ThemedText></View>
            {loading ? <ActivityIndicator color={theme.primary} /> : permittedModules.length === 0 ? <ThemedText style={[styles.empty, { color: theme.textSecondary }]}>No recruitment modules are enabled for this role yet.</ThemedText> : (
              <View style={styles.grid}>{permittedModules.map((item) => <Pressable key={item.key} onPress={() => item.key === 'requirement' ? router.push('/requirements') : router.push({ pathname: '/module', params: { key: item.key, title: item.title } } as never)} style={({ pressed }) => [styles.module, { width: wide ? '48.5%' : '100%', backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}>
                <View style={[styles.icon, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.iconText, { color: theme.primary }]}>{item.icon}</ThemedText></View>
                <View style={styles.moduleCopy}><ThemedText style={styles.moduleTitle}>{item.title}</ThemedText><ThemedText style={[styles.moduleDescription, { color: theme.textSecondary }]}>{item.key === 'requirement' ? 'Review and manage hiring needs' : `Open ${item.title.toLowerCase()} workspace`}</ThemedText></View><ThemedText style={{ color: theme.textSecondary }}>↗</ThemedText>
              </Pressable>)}</View>
            )}
          </View>
          <Pressable onPress={() => router.push('/explore')}><ThemedText style={[styles.lifecycle, { color: theme.primary }]}>Explore the recruitment lifecycle</ThemedText></Pressable>
          <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>Recruitment Workflow · {context?.slug ?? 'Organization workspace'}</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five }, page: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: Spacing.four },
  top: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { fontSize: 18, fontWeight: '800' }, caption: { fontSize: 9, letterSpacing: 1.1, fontWeight: '700' }, signOut: { paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, borderRadius: 11 },
  hero: { borderRadius: 22, padding: 26, backgroundColor: '#1C2340', gap: 10 }, eyebrow: { color: '#BFC2FF', fontSize: 10, letterSpacing: 1.1, fontWeight: '800' }, title: { color: '#FFFFFF', fontSize: 30, lineHeight: 37, fontWeight: '800' }, subtitle: { color: '#C4C9DB', fontSize: 14, lineHeight: 21 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, statCard: { minHeight: 112, borderRadius: 16, borderWidth: 1, padding: 17, justifyContent: 'center', gap: 7 }, statValue: { fontSize: 25, fontWeight: '800' }, statLabel: { fontSize: 12, fontWeight: '600' },
  section: { gap: 16 }, sectionTitle: { fontSize: 20, fontWeight: '800' }, sectionCaption: { fontSize: 13, marginTop: 4 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, module: { minHeight: 100, borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 }, icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, iconText: { fontSize: 18, fontWeight: '800' }, moduleCopy: { flex: 1, gap: 5 }, moduleTitle: { fontSize: 15, fontWeight: '700' }, moduleDescription: { fontSize: 12 }, pressed: { opacity: 0.7 }, empty: { padding: 18, borderRadius: 14, backgroundColor: '#FFFFFF' }, lifecycle: { fontSize: 13, fontWeight: '700' }, footer: { textAlign: 'center', fontSize: 11 },
});
