import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';


import {
  getUsers,
  updateUserStatus,
  type User,
} from '@/services/user.service';
import { useTheme } from '@/hooks/use-theme';

const ORGANIZATION_ID = 1;

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ??
      error.message ??
      fallback
    );
  }

  return error instanceof Error ? error.message : fallback;
}

export default function UsersScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(
    null,
  );

  // Load users through the service.
  const fetchUsers = useCallback(async () => {
    try {
      setError('');

      const data = await getUsers(ORGANIZATION_ID);

      setUsers(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Refresh the list when requested.
  const handleRefresh = () => {
    setRefreshing(true);
    void fetchUsers();
  };

  // Activate or deactivate a user.
  const handleToggleStatus = (user: User) => {
    if (updatingUserId !== null) {
      return;
    }

    const nextIsActive = user.is_active !== 1;
    const action = nextIsActive ? 'Activate' : 'Deactivate';

    const fullName = [
      user.first_name,
      user.last_name,
    ]
      .filter(Boolean)
      .join(' ');

    Alert.alert(
      `${action} User`,
      `Are you sure you want to ${action.toLowerCase()} ${fullName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: action,
          style: nextIsActive ? 'default' : 'destructive',
          onPress: async () => {
            setUpdatingUserId(user.id);

            try {
              const updatedUser = await updateUserStatus(
                user.id,
                nextIsActive,
              );

              setUsers((previousUsers) =>
                previousUsers.map((currentUser) =>
                  currentUser.id === updatedUser.id
                    ? updatedUser
                    : currentUser,
                ),
              );

              Alert.alert(
                'Success',
                updatedUser.is_active === 1
                  ? 'User activated successfully.'
                  : 'User deactivated successfully.',
              );
            } catch (err) {
              Alert.alert(
                'Update Failed',
                getErrorMessage(
                  err,
                  'Failed to update user status.',
                ),
              );
            } finally {
              setUpdatingUserId(null);
            }
          },
        },
      ],
    );
  };

  // Initial loading screen.
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />

        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
          Loading users...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
    <View
      style={[
        styles.container,
        { paddingHorizontal: width < 400 ? 16 : 24 },
      ]}
    >
      {/* Page heading */}
      <Text style={[styles.title, { color: theme.text }]}>Users</Text>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Manage organization members, roles, and departments.
      </Text>

      {/* Create User navigation */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/create-user' as any)}
        style={({ pressed }) => [
          styles.createButton,
          { backgroundColor: theme.primary },
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={[styles.createButtonText, { color: theme.primaryText }]}>
          + Create User
        </Text>
      </Pressable>

      {/* Error message */}
      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: theme.dangerBackground }]}>
          <Text style={{ color: theme.danger }}>{error}</Text>

          <Pressable
            onPress={() => {
              setLoading(true);
              void fetchUsers();
            }}
          >
            <Text style={[styles.retry, { color: theme.primary }]}>Try again</Text>
          </Pressable>
        </View>
      )}

      {/* Users list */}
      {!error && (
        <FlatList
          style={styles.list}
          data={users}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={
            users.length === 0 ? styles.emptyContainer : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No users found for this organization.
            </Text>
          }
          renderItem={({ item }) => {
            const isActive = item.is_active === 1;
            const isUpdating = updatingUserId === item.id;

            return (
              <View style={[styles.userCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                {/* User avatar */}
                <View style={[styles.avatar, { backgroundColor: theme.primaryMuted }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>
                    {item.first_name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* User information */}
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: theme.text }]}>
                    {item.first_name}{' '}
                    {item.last_name ?? ''}
                  </Text>

                  <Text style={[styles.email, { color: theme.textSecondary }]}>
                    {item.email}
                  </Text>

                  <Text style={[styles.detail, { color: theme.textSecondary }]}>
                    Role: {item.role_name}
                  </Text>

                  <Text style={[styles.detail, { color: theme.textSecondary }]}>
                    Department:{' '}
                    {item.department_name ?? 'Not assigned'}
                  </Text>

                  {/* Current status */}
                  <Text
                    style={[
                      styles.status,
                      isActive
                        ? { color: theme.success, backgroundColor: theme.successBackground }
                        : { color: theme.danger, backgroundColor: theme.dangerBackground },
                    ]}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Text>

                  {/* Activate / Deactivate button */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      `${isActive ? 'Deactivate' : 'Activate'} ${item.first_name}`
                    }
                    disabled={updatingUserId !== null}
                    onPress={() => handleToggleStatus(item)}
                    style={({ pressed }) => [
                      styles.statusButton,
                      isActive
                        ? { backgroundColor: theme.dangerBackground }
                        : { backgroundColor: theme.successBackground },
                      (pressed || updatingUserId !== null) &&
                        styles.buttonPressed,
                    ]}
                  >
                    {isUpdating ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.text}
                      />
                    ) : (
                      <Text style={[styles.statusButtonText, { color: isActive ? theme.danger : theme.success }]}>
                        {isActive
                          ? 'Deactivate User'
                          : 'Activate User'}
                      </Text>
                    )}
                  </Pressable>

                  
<Pressable
  accessibilityRole="button"
  onPress={() =>
    router.push({
      pathname: '/edit-user' as any,
      params: { id: String(item.id) },
    })
  }
  style={({ pressed }) => [
    styles.statusButton,
    { backgroundColor: theme.primaryMuted, marginTop: 8 },
    pressed && styles.buttonPressed,
  ]}
>
  <Text style={[styles.statusButtonText, { color: theme.primary }]}>
    Edit User
  </Text>
</Pressable>

                </View>
              </View>
            );
          }}
        />
      )}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingVertical: 24,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  helperText: {
    marginTop: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },

  createButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },

  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  buttonPressed: {
    opacity: 0.75,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },

  userInfo: {
    flex: 1,
    minWidth: 0,
  },

  userName: {
    fontSize: 17,
    fontWeight: '600',
  },

  email: {
    marginTop: 4,
    marginBottom: 10,
  },

  detail: {
    marginTop: 4,
    fontSize: 13,
  },

  status: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },

  statusButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  emptyText: {
    padding: 24,
    textAlign: 'center',
  },

  errorBox: {
    padding: 16,
    borderRadius: 10,
  },

  retry: {
    marginTop: 10,
    fontWeight: '600',
  },
});