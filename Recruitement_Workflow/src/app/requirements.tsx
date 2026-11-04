import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getDepartments, type Department } from '@/services/departments';
import {
  getPendingRequirements,
  getRequirements,
  type Requirement,
  type RequirementStatus,
} from '@/services/requirement.service';

const statusStyles: Record<
  RequirementStatus,
  { label: string; color: 'success' | 'danger' | 'primary' | 'textSecondary'; background: 'successBackground' | 'dangerBackground' | 'primaryMuted' | 'backgroundSelected' }
> = {
  DRAFT: {
    label: 'Draft',
    color: 'textSecondary',
    background: 'backgroundSelected',
  },
  PENDING_APPROVAL: {
    label: 'Pending approval',
    color: 'primary',
    background: 'primaryMuted',
  },
  APPROVED: {
    label: 'Approved',
    color: 'success',
    background: 'successBackground',
  },
  REJECTED: {
    label: 'Rejected',
    color: 'danger',
    background: 'dangerBackground',
  },
};

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'Unable to load requirements.';
  }

  return error instanceof Error ? error.message : 'Unable to load requirements.';
}

export default function RequirementsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);

  const loadRequirements = useCallback(async () => {
    try {
      setError('');
      const organization = await getCurrentOrganizationUser();
      const permissions = organization.permissions ?? [];
      setCanManage(permissions.includes('requirement.manage'));

      const requirementsRequest = permissions.includes('requirement.view')
        ? getRequirements()
        : permissions.includes('requirement.approve')
          ? getPendingRequirements()
          : Promise.resolve([]);
      const [requirementData, departmentData] = await Promise.all([
        requirementsRequest,
        getDepartments(organization.id),
      ]);

      setRequirements(requirementData);
      setDepartments(departmentData);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRequirements();
    }, [loadRequirements]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadRequirements();
  }, [loadRequirements]);

  const departmentNames = new Map(
    departments.map((department) => [department.id, department.name]),
  );
  const horizontalPadding = width < 600 ? Spacing.three : Spacing.four;

  const renderItem = ({ item }: { item: Requirement }) => {
    const status = statusStyles[item.status];
    const experience =
      item.experience_min_years === item.experience_max_years
        ? `${item.experience_min_years} years`
        : `${item.experience_min_years}–${item.experience_max_years} years`;

    return (
      <ThemedView style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.cardHeading}>
          <View style={styles.titleContainer}>
            <ThemedText type="subtitle" style={styles.requirementTitle}>
              {item.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {departmentNames.get(item.department_id) ??
                `Department ${item.department_id}`}
            </ThemedText>
          </View>
          <View
            accessibilityLabel={`Status: ${status.label}`}
            style={[
              styles.statusBadge,
              { backgroundColor: theme[status.background] },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: theme[status.color] }}>
              {status.label}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.details, { borderTopColor: theme.border }]}>
          <Detail label="Openings" value={String(item.openings)} />
          <Detail label="Experience" value={experience} />
          <Detail label="Location" value={item.location} />
          <Detail label="Employment type" value={item.employment_type} />
        </View>

        {item.description ? (
          <ThemedText
            themeColor="textSecondary"
            numberOfLines={3}
            style={styles.description}>
            {item.description}
          </ThemedText>
        ) : null}
      </ThemedView>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText themeColor="textSecondary">
          Loading requirements…
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <FlatList
        data={requirements}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: MaxContentWidth,
          },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.three }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.heading}>
              <ThemedText type="title" style={styles.pageTitle}>
                Requirements
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                Review open roles and their approval status.
              </ThemedText>
            </View>
            {canManage ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/create-requirement')}
                style={({ pressed }) => [
                  styles.createButton,
                  { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  style={{ color: theme.primaryText, fontWeight: '700' }}>
                  + Create requirement
                </ThemedText>
              </Pressable>
            ) : null}
            {error ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.errorBanner,
                  { backgroundColor: theme.dangerBackground },
                ]}>
                <ThemedText style={{ color: theme.danger, flex: 1 }}>
                  {error}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRefresh}
                  hitSlop={8}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.danger }}>
                    Retry
                  </ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">
              {error ? 'Requirements unavailable' : 'No requirements yet'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {error
                ? 'Try refreshing the list to load requirements.'
                : 'Requirements will appear here when they are available.'}
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  listContent: {
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },
  header: {
    gap: Spacing.four,
    marginBottom: Spacing.four,
  },
  heading: {
    gap: Spacing.two,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 38,
  },
  createButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 10,
    padding: Spacing.three,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  titleContainer: {
    flex: 1,
    gap: Spacing.one,
  },
  requirementTitle: {
    fontSize: 19,
    lineHeight: 27,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  detail: {
    flexBasis: '45%',
    flexGrow: 1,
    gap: Spacing.one,
  },
  description: {
    lineHeight: 21,
  },
  emptyState: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  emptyText: {
    textAlign: 'center',
  },
});
