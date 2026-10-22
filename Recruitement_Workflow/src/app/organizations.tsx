
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
import {
  getOrganizations,
  type Organization,
} from '@/services/organizations';

export default function OrganizationsScreen() {
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

        <View style={styles.summary}>
          <ThemedText style={styles.summaryLabel}>
            Total Organizations
          </ThemedText>

          <ThemedText type="title">
            {loading ? '—' : organizations.length}
          </ThemedText>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle">
            Organization List
          </ThemedText>

          <Pressable
            onPress={() => setRefreshKey((value) => value + 1)}
            style={styles.refreshButton}
            accessibilityRole="button"
          >
            <ThemedText>Refresh</ThemedText>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.message}>
            <ActivityIndicator size="large" />
            <ThemedText>Loading organizations...</ThemedText>
          </View>
        ) : error ? (
          <View style={styles.message}>
            <ThemedText>{error}</ThemedText>

            <Pressable
              onPress={() => setRefreshKey((value) => value + 1)}
              style={styles.actionButton}
              accessibilityRole="button"
            >
              <ThemedText>Try Again</ThemedText>
            </Pressable>
          </View>
        ) : organizations.length === 0 ? (
          <View style={styles.message}>
            <ThemedText type="subtitle">
              No organizations found
            </ThemedText>
            <ThemedText style={styles.subtitle}>
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
                  style={styles.card}
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
                        isActive
                          ? styles.activeStatus
                          : styles.inactiveStatus,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.statusText,
                          isActive
                            ? styles.activeText
                            : styles.inactiveText,
                        ]}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.divider} />

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
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: 900,
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
    borderColor: '#80808055',
    borderRadius: 12,
    gap: Spacing.two,
  },
  summaryLabel: {
    opacity: 0.7,
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
    borderColor: '#80808055',
    borderRadius: 8,
  },
  list: {
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#80808055',
    borderRadius: 12,
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
  activeStatus: {
    backgroundColor: '#D9F5DF',
  },
  inactiveStatus: {
    backgroundColor: '#EEEEEE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#176B32',
  },
  inactiveText: {
    color: '#555555',
  },
  divider: {
    height: 1,
    backgroundColor: '#80808033',
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
    borderColor: '#80808055',
    borderRadius: 12,
    alignItems: 'center',
    gap: Spacing.three,
  },
  actionButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: '#80808055',
    borderRadius: 8,
  },
});
