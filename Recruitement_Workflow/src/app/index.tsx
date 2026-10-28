import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logoutUser } from '@/services/auth.service';

const modules = [
  {
    title: 'Create Organization',
    description: 'Set up a new organization and get your workspace started.',
    category: 'GET STARTED',
    icon: '+',
    route: '/create-organization',
  },
  {
    title: 'Organizations',
    description: 'View and manage organizations on your platform.',
    category: 'ORGANIZATION',
    icon: 'O',
    route: '/organizations',
  },
  {
    title: 'Departments',
    description: 'Organize your teams and manage department details.',
    category: 'STRUCTURE',
    icon: 'D',
    route: '/departments',
  },
  {
    title: 'Users',
    description: 'Manage team members, roles, and department access.',
    category: 'TEAM ACCESS',
    icon: 'U',
    route: '/users',
  },
  {
    title: 'Role & Permissions',
    description: 'Control which features are available to each role.',
    category: 'SECURITY',
    icon: 'R',
    route: '/role-permissions',
  },
] as const;

export default function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [loggingOut, setLoggingOut] = useState(false);
  const isWide = width >= 720;

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logoutUser();
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      Alert.alert('Sign Out Failed', 'Unable to sign out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.topBar}>
            <View style={styles.brandLockup}>
              <View style={[styles.brandMark, { backgroundColor: theme.primary }]}>
                <ThemedText style={[styles.brandMarkText, { color: theme.primaryText }]}>R</ThemedText>
              </View>
              <View>
                <ThemedText style={styles.brandName}>Recruitment</ThemedText>
                <ThemedText style={[styles.brandCaption, { color: theme.textSecondary }]}>
                  WORKFLOW PLATFORM
                </ThemedText>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              disabled={loggingOut}
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutButton,
                { borderColor: theme.backgroundSelected },
                (pressed || loggingOut) && styles.pressed,
              ]}
            >
              {loggingOut ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <ThemedText style={styles.logoutText}>Sign out</ThemedText>
              )}
            </Pressable>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <View style={styles.heroBadge}>
                <View style={styles.heroBadgeDot} />
                <ThemedText style={styles.heroBadgeText}>ADMIN WORKSPACE</ThemedText>
              </View>
              <ThemedText style={styles.heroTitle}>
                Your people.{'\n'}Your workflow.
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                A clear home for your organizations, teams, and access settings.
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/create-organization')}
                style={({ pressed }) => [
                  styles.heroButton,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={styles.heroButtonText}>
                  Set up an organization
                </ThemedText>
                <ThemedText style={styles.heroButtonArrow}>→</ThemedText>
              </Pressable>
            </View>
            {isWide && (
              <View accessibilityElementsHidden style={styles.heroArtwork}>
                <View style={styles.artworkCircleLarge} />
                <View style={styles.artworkCircleSmall} />
                <View style={styles.artworkCard}>
                  <View style={styles.artworkAvatar}>
                    <ThemedText style={styles.artworkAvatarText}>R</ThemedText>
                  </View>
                  <View style={styles.artworkLines}>
                    <View style={styles.artworkLine} />
                    <View style={styles.artworkLineShort} />
                  </View>
                  <View style={styles.artworkCheck}>
                    <ThemedText style={styles.artworkCheckText}>✓</ThemedText>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={styles.sectionHeading}>
            <View style={styles.sectionCopy}>
              <ThemedText style={styles.sectionTitle}>Workspace tools</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                The essentials for managing your recruitment foundation.
              </ThemedText>
            </View>
            <View style={[styles.toolCount, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.toolCountNumber}>{modules.length}</ThemedText>
              <ThemedText style={[styles.toolCountLabel, { color: theme.textSecondary }]}>
                tools
              </ThemedText>
            </View>
          </View>

          <View style={styles.moduleGrid}>
            {modules.map((module, index) => (
              <Pressable
                key={module.title}
                accessibilityRole="button"
                onPress={() => router.push(module.route)}
                style={({ pressed }) => [
                  styles.moduleCard,
                  {
                    width: isWide ? '48.5%' : '100%',
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.moduleIcon,
                    { backgroundColor: index === 0 ? theme.primaryMuted : theme.backgroundSelected },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.moduleIconText,
                      { color: index === 0 ? theme.primary : theme.text },
                    ]}
                  >
                    {module.icon}
                  </ThemedText>
                </View>
                <View style={styles.moduleContent}>
                  <ThemedText
                    style={[styles.moduleCategory, { color: theme.primary }]}
                  >
                    {module.category}
                  </ThemedText>
                  <ThemedText style={styles.moduleTitle}>{module.title}</ThemedText>
                  <ThemedText
                    style={[styles.moduleDescription, { color: theme.textSecondary }]}
                  >
                    {module.description}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.moduleArrow, { color: theme.textSecondary }]}>
                  ↗
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <ThemedText style={[styles.footer, { color: theme.textSecondary }]}>
            Recruitment Workflow · People-first hiring starts here
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  page: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    gap: Spacing.five,
  },
  topBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  brandName: {
    fontSize: 16,
    lineHeight: 19,
    fontWeight: '700',
  },
  brandCaption: {
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1.15,
    fontWeight: '700',
  },
  logoutButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hero: {
    minHeight: 288,
    backgroundColor: '#1C2340',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 13,
    zIndex: 1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#303858',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },
  heroBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#8D91FF',
  },
  heroBadgeText: {
    color: '#D8DAFF',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    maxWidth: 420,
    color: '#C4C9DB',
    fontSize: 14,
    lineHeight: 22,
  },
  heroButton: {
    minHeight: 46,
    marginTop: 4,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroButtonText: {
    color: '#202642',
    fontSize: 13,
    fontWeight: '700',
  },
  heroButtonArrow: {
    color: '#4F46E5',
    fontSize: 18,
    fontWeight: '700',
  },
  heroArtwork: {
    width: 300,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkCircleLarge: {
    position: 'absolute',
    width: 194,
    height: 194,
    borderRadius: 97,
    backgroundColor: '#2D365B',
    right: 36,
    top: 8,
  },
  artworkCircleSmall: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: '#4446A2',
    opacity: 0.65,
    left: 18,
    bottom: 8,
  },
  artworkCard: {
    width: 230,
    height: 96,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    transform: [{ rotate: '-5deg' }],
    elevation: 8,
  },
  artworkAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#E8E9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkAvatarText: {
    color: '#4F46E5',
    fontSize: 19,
    fontWeight: '700',
  },
  artworkLines: {
    flex: 1,
    gap: 9,
  },
  artworkLine: {
    width: '88%',
    height: 8,
    borderRadius: 5,
    backgroundColor: '#D9DCE8',
  },
  artworkLineShort: {
    width: '60%',
    height: 6,
    borderRadius: 5,
    backgroundColor: '#ECEEF4',
  },
  artworkCheck: {
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: '#E4F7EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkCheckText: {
    color: '#208753',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  sectionCopy: {
    gap: 5,
  },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  toolCount: {
    minWidth: 72,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  toolCountNumber: {
    fontSize: 17,
    fontWeight: '700',
  },
  toolCountLabel: {
    fontSize: 12,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  moduleCard: {
    minHeight: 154,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  moduleIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleIconText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  moduleContent: {
    flex: 1,
    gap: 6,
  },
  moduleCategory: {
    fontSize: 9,
    letterSpacing: 1,
    lineHeight: 13,
    fontWeight: '700',
  },
  moduleTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  moduleDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  moduleArrow: {
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    paddingTop: 2,
  },
  pressed: {
    opacity: 0.72,
  },
});
