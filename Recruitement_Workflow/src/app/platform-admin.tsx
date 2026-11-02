import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logoutUser } from '@/services/auth.service';
import { getOrganizations, type Organization } from '@/services/organizations';

export default function PlatformAdminScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const isWide = width >= 720;

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrganizations(await getOrganizations());
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message ?? 'Unable to load organization totals.'
          : 'Unable to load organization totals.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logoutUser();
      router.replace('/login');
    } catch {
      Alert.alert('Sign out failed', 'Unable to sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  const activeOrganizations = organizations.filter((item) => Boolean(item.is_active)).length;
  const inactiveOrganizations = organizations.length - activeOrganizations;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, { maxWidth: isWide ? 1120 : 680 }]}>
          <View style={styles.topBar}>
            <View style={styles.brandLockup}>
              <View style={[styles.brandMark, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.brandMarkText, { color: theme.primaryText }]}>R</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.brandName}>Recruitment</ThemedText>
                <ThemedText style={[styles.brandCaption, { color: theme.textSecondary }]}>PLATFORM CONTROL</ThemedText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              disabled={signingOut}
              onPress={() => void handleSignOut()}
              style={[styles.signOutButton, { borderColor: theme.border }]}
            >
              {signingOut ? <ActivityIndicator size="small" color={theme.primary} /> : <ThemedText>Sign out</ThemedText>}
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <View style={styles.eyebrow}>
                <View style={styles.eyebrowDot} />
                <ThemedText style={styles.eyebrowText}>PLATFORM ADMIN</ThemedText>
              </View>
              <ThemedText style={styles.heroTitle}>Manage every organization from one place.</ThemedText>
              <ThemedText style={styles.heroBody}>
                Review organization activity, maintain workspaces, and keep platform access organized.
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/create-organization')}
                style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
              >
                <ThemedText style={styles.heroButtonText}>Create organization</ThemedText>
                <ThemedText style={styles.heroButtonArrow}>→</ThemedText>
              </Pressable>
            </View>
            {isWide && (
              <View accessibilityElementsHidden style={styles.heroArt}>
                <View style={styles.heroOrbBack} />
                <View style={styles.heroOrbFront} />
                <View style={styles.heroArtCard}>
                  <View style={styles.heroArtIcon}><ThemedText style={styles.heroArtIconText}>O</ThemedText></View>
                  <View style={styles.heroArtLines}><View /><View /></View>
                  <View style={styles.heroArtStatus} />
                </View>
              </View>
            )}
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <ThemedText style={styles.sectionTitle}>Platform overview</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Organization status at a glance.</ThemedText>
            </View>
            <Pressable accessibilityRole="button" disabled={loading} onPress={() => void loadOrganizations()} style={[styles.refreshButton, { borderColor: theme.border }]}>
              <ThemedText>{loading ? 'Loading…' : 'Refresh'}</ThemedText>
            </Pressable>
          </View>

          {error ? (
            <View style={[styles.errorCard, { backgroundColor: theme.dangerBackground }]}>
              <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => void loadOrganizations()}>
                <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>Try again</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.statsRow}>
              <StatCard label="Organizations" value={loading ? '—' : String(organizations.length)} tone="primary" />
              <StatCard label="Active" value={loading ? '—' : String(activeOrganizations)} tone="success" />
              <StatCard label="Inactive" value={loading ? '—' : String(inactiveOrganizations)} tone="neutral" />
            </View>
          )}

          <View style={styles.sectionHeading}>
            <View>
              <ThemedText style={styles.sectionTitle}>Management tools</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Choose a platform task to continue.</ThemedText>
            </View>
          </View>

          <View style={styles.toolsGrid}>
            <ToolCard
              title="Organizations"
              description="Browse workspaces, update details, and change organization status."
              icon="O"
              onPress={() => router.push('/organizations')}
              wide={isWide}
            />
            <ToolCard
              title="Create organization"
              description="Set up a new organization workspace on the platform."
              icon="+"
              onPress={() => router.push('/create-organization')}
              wide={isWide}
            />
            <ToolCard
              title="Department Management"
              description="Choose an organization to review or update its departments."
              icon="D"
              onPress={() => router.push('/departments')}
              wide={isWide}
            />
            <ToolCard
              title="User Management"
              description="Choose an organization to manage its users, roles, and access."
              icon="U"
              onPress={() => router.push('/users')}
              wide={isWide}
            />
          </View>

          <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>Recruitment Workflow · Platform Administration</ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );

  function StatCard({ label, value, tone }: { label: string; value: string; tone: 'primary' | 'success' | 'neutral' }) {
    const accent = tone === 'success' ? theme.success : tone === 'primary' ? theme.primary : theme.textSecondary;
    return (
      <ThemedView style={[styles.statCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border, width: isWide ? '32%' : '100%' }]}>
        <View style={[styles.statDot, { backgroundColor: accent }]} />
        <ThemedText style={[styles.statValue, { color: theme.text }]}>{value}</ThemedText>
        <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      </ThemedView>
    );
  }

  function ToolCard({ title, description, icon, onPress, wide }: { title: string; description: string; icon: string; onPress: () => void; wide: boolean }) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.toolCard, { width: wide ? '48.5%' : '100%', backgroundColor: theme.backgroundElement, borderColor: theme.border }, pressed && styles.pressed]}
      >
        <View style={[styles.toolIcon, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.toolIconText, { color: theme.primary }]}>{icon}</ThemedText></View>
        <View style={styles.toolCopy}>
          <ThemedText style={styles.toolTitle}>{title}</ThemedText>
          <ThemedText style={[styles.toolDescription, { color: theme.textSecondary }]}>{description}</ThemedText>
        </View>
        <ThemedText style={[styles.toolArrow, { color: theme.textSecondary }]}>↗</ThemedText>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Spacing.three, paddingBottom: Spacing.five },
  page: { width: '100%', alignSelf: 'center', gap: Spacing.four },
  topBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { fontSize: 22, fontWeight: '800' },
  brandName: { fontSize: 16, lineHeight: 19, fontWeight: '700' },
  brandCaption: { fontSize: 9, lineHeight: 14, letterSpacing: 1.15, fontWeight: '700' },
  signOutButton: { minHeight: 42, paddingHorizontal: 15, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { minHeight: 275, backgroundColor: '#1C2340', borderRadius: 24, overflow: 'hidden', padding: 26, flexDirection: 'row', alignItems: 'center' },
  heroCopy: { flex: 1, alignItems: 'flex-start', gap: 13, zIndex: 1 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#303858', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8D91FF' },
  eyebrowText: { color: '#D8DAFF', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  heroTitle: { maxWidth: 520, color: '#FFFFFF', fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5 },
  heroBody: { maxWidth: 460, color: '#C4C9DB', fontSize: 14, lineHeight: 22 },
  heroButton: { minHeight: 46, marginTop: 3, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroButtonText: { color: '#202642', fontSize: 13, fontWeight: '700' },
  heroButtonArrow: { color: '#4F46E5', fontSize: 18, fontWeight: '700' },
  heroArt: { width: 280, height: 210, alignItems: 'center', justifyContent: 'center' },
  heroOrbBack: { position: 'absolute', width: 182, height: 182, borderRadius: 100, backgroundColor: '#2D365B', right: 24, top: 8 },
  heroOrbFront: { position: 'absolute', width: 116, height: 116, borderRadius: 70, backgroundColor: '#4446A2', opacity: 0.7, left: 16, bottom: 4 },
  heroArtCard: { width: 224, height: 92, paddingHorizontal: 17, borderRadius: 18, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 12, transform: [{ rotate: '-4deg' }], elevation: 8 },
  heroArtIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E8E9FF', alignItems: 'center', justifyContent: 'center' },
  heroArtIconText: { color: '#4F46E5', fontSize: 18, fontWeight: '700' },
  heroArtLines: { flex: 1, gap: 8 },
  heroArtStatus: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#39B778' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  sectionSubtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  refreshButton: { paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderRadius: 11 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  statCard: { minHeight: 118, borderWidth: 1, borderRadius: 16, padding: 17, gap: 5 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statValue: { fontSize: 27, lineHeight: 32, fontWeight: '700' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  toolsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  toolCard: { minHeight: 145, borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
  toolIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolIconText: { fontSize: 18, fontWeight: '700' },
  toolCopy: { flex: 1, gap: 6 },
  toolTitle: { fontSize: 16, fontWeight: '700' },
  toolDescription: { fontSize: 12, lineHeight: 18 },
  toolArrow: { fontSize: 18, fontWeight: '600' },
  errorCard: { padding: 16, borderRadius: 14, gap: 10 },
  footer: { textAlign: 'center', fontSize: 11, paddingTop: 2 },
  pressed: { opacity: 0.72 },
});
