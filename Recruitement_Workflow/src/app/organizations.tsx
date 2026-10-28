
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import axios from 'axios';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getOrganizations,
  type Organization,
} from '@/services/organizations';

export default function OrganizationsScreen() {
  const theme = useTheme();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getOrganizations();
      setOrganizations(data);
    } catch (err) {
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message ??
              'Unable to load organizations. Please try again.'
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations, refreshKey]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heading}>
          <ThemedText type="title">Organizations</ThemedText>
          <ThemedText style={styles.subtitle}>
            Manage organizations registered on the recruitment platform.
          </ThemedText>
        </View>

        <View
          style={[
            styles.summary,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        >
          <ThemedText style={styles.summaryLabel}>
            Total Organizations
          </ThemedText>

          <ThemedText style={styles.summaryCount}>
            {loading ? '—' : organizations.length}
          </ThemedText>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">
            Organization List
          </ThemedText>

          <Pressable
            onPress={() => setRefreshKey((value) => value + 1)}
            style={[styles.refreshButton, { borderColor: theme.border }]}
            accessibilityRole="button"
          >
            <ThemedText>Refresh</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <View style={[styles.message, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText>Loading organizations...</ThemedText>
          </View>
        ) : error ? (
          <View style={[styles.message, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText>{error}</ThemedText>

            <Pressable
              onPress={() => setRefreshKey((value) => value + 1)}
              style={[styles.actionButton, { borderColor: theme.border }]}
              accessibilityRole="button"
            >
              <ThemedText>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : organizations.length === 0 ? (
          <View style={[styles.message, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText type="subtitle">
              No organizations found
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Create an organization first to see it here.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {organizations.map((organization) => {
              const isActive = Boolean(organization.is_active);

              return (
                <View
                  key={organization.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleContainer}>
                      <ThemedText type="subtitle">
                        {organization.name}
                      </ThemedText>

                      <ThemedText style={styles.slug}>
                        {organization.slug}
                      </ThemedText>
                    </View>

                    <View
                      style={[
                        styles.status,
                        {
                          backgroundColor: isActive
                            ? theme.successBackground
                            : theme.backgroundSelected,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.statusText,
                          { color: isActive ? theme.success : theme.textSecondary },
                        ]}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </ThemedText>
                    </View>
                  </View>

                  <View
                    style={[styles.divider, { backgroundColor: theme.border }]}
                  />

                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>
                      Organization ID
                    </ThemedText>
                    <ThemedText>
                      {organization.id}
                    </ThemedText>
                  </View>

                  <View style={styles.detailRow}>
                    <ThemedText style={styles.detailLabel}>
                      Email
                    </ThemedText>
                    <ThemedText style={styles.email}>
                      {organization.email || 'Not provided'}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  heading: {
    gap: Spacing.one,
  },
  subtitle: {
    opacity: 0.7,
  },
  summary: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: 16,
    gap: Spacing.two,
  },
  summaryLabel: {
    opacity: 0.7,
  },
  summaryCount: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  refreshButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
  },
  list: {
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: 16,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardTitleContainer: {
    flex: 1,
    gap: Spacing.one,
  },
  slug: {
    opacity: 0.65,
  },
  status: {
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  detailLabel: {
    opacity: 0.65,
  },
  email: {
    flex: 1,
    textAlign: 'right',
  },
  message: {
    padding: Spacing.four,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    gap: Spacing.three,
  },
  actionButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
  },
});
