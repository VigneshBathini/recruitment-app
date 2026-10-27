
import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Pressable,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logoutUser } from '@/services/auth.service';

export default function HomeScreen() {
  const theme = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const modules = [
    {
      title: 'Create Organization',
      description: 'Register a new organization on the platform.',
      icon: '＋',
      route: '/create-organization',
    },
    {
      title: 'Organizations',
      description: 'View and manage registered organizations.',
      icon: '▤',
      route: '/organizations',
    },
    {
      title: 'Departments',
      description: 'Create and manage organization departments.',
      icon: '▥',
      route: '/departments',
    },
    {
      title: 'Users',
      description: 'Manage organization members, roles, and departments.',
      icon: '♙',
      route: '/users',
    },
    {
  title: 'Role & Permissions',
  description: 'Manage permissions assigned to each role.',
  icon: '🔐',
  route: '/role-permissions',
},
  ] as const;

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logoutUser();
      router.replace('/login');
    } catch (error) {
      console.error('Logout failed:', error);

      const message = 'Unable to sign out. Please try again.';

      if (Platform.OS === 'web') {
        Alert.alert('Sign Out Failed', message);
      } else {
        Alert.alert('Sign Out Failed', message);
      }
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerContent}>
            <ThemedText style={styles.eyebrow}>
              RECRUITMENT WORKFLOW
            </ThemedText>

            <ThemedText style={styles.heading}>
              Dashboard
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            disabled={loggingOut}
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              {
                borderColor: theme.textSecondary,
                opacity: pressed || loggingOut ? 0.6 : 1,
              },
            ]}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <ThemedText style={styles.logoutText}>
                Sign Out
              </ThemedText>
            )}
          </Pressable>
        </View>

        <ThemedText
          style={[
            styles.subtitle,
            { color: theme.textSecondary },
          ]}
        >
          Manage your organization setup and recruitment foundation.
        </ThemedText>
      </View>

      <View style={styles.moduleList}>
        {modules.map((module) => (
          <Pressable
            key={module.title}
            onPress={() => router.push(module.route as any)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.textSecondary,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <ThemedText style={styles.icon}>
                {module.icon}
              </ThemedText>
            </View>

            <View style={styles.cardContent}>
              <ThemedText style={styles.cardTitle}>
                {module.title}
              </ThemedText>

              <ThemedText
                style={[
                  styles.cardDescription,
                  { color: theme.textSecondary },
                ]}
              >
                {module.description}
              </ThemedText>
            </View>

            <ThemedText style={styles.arrow}>›</ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
  },
  header: {
    marginBottom: Spacing.five,
    marginTop: Spacing.two,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  headerContent: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  logoutButton: {
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
  moduleList: {
    gap: Spacing.three,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    fontWeight: '600',
  },
  cardContent: {
    flex: 1,
    gap: Spacing.one,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  arrow: {
    fontSize: 28,
    fontWeight: '400',
  },
});
