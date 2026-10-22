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
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';


import {
  getUsers,
  updateUserStatus,
  type User,
} from '@/services/user.service';

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />

        <Text style={styles.helperText}>
          Loading users...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Page heading */}
      <Text style={styles.title}>Users</Text>

      <Text style={styles.subtitle}>
        Manage organization members, roles, and departments.
      </Text>

      {/* Create User navigation */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/create-user' as any)}
        style={({ pressed }) => [
          styles.createButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.createButtonText}>
          + Create User
        </Text>
      </Pressable>

      {/* Error message */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable
            onPress={() => {
              setLoading(true);
              void fetchUsers();
            }}
          >
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        </View>
      )}

      {/* Users list */}
      {!error && (
        <FlatList
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
            <Text style={styles.emptyText}>
              No users found for this organization.
            </Text>
          }
          renderItem={({ item }) => {
            const isActive = item.is_active === 1;
            const isUpdating = updatingUserId === item.id;

            return (
              <View style={styles.userCard}>
                {/* User avatar */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.first_name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* User information */}
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {item.first_name}{' '}
                    {item.last_name ?? ''}
                  </Text>

                  <Text style={styles.email}>
                    {item.email}
                  </Text>

                  <Text style={styles.detail}>
                    Role: {item.role_name}
                  </Text>

                  <Text style={styles.detail}>
                    Department:{' '}
                    {item.department_name ?? 'Not assigned'}
                  </Text>

                  {/* Current status */}
                  <Text
                    style={[
                      styles.status,
                      isActive
                        ? styles.active
                        : styles.inactive,
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
                        ? styles.deactivateButton
                        : styles.activateButton,
                      (pressed || updatingUserId !== null) &&
                        styles.buttonPressed,
                    ]}
                  >
                    {isUpdating ? (
                      <ActivityIndicator
                        size="small"
                        color="#0F172A"
                      />
                    ) : (
                      <Text style={styles.statusButtonText}>
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
    { backgroundColor: '#DBEAFE', marginTop: 8 },
    pressed && styles.buttonPressed,
  ]}
>
  <Text style={styles.statusButtonText}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },

  helperText: {
    marginTop: 10,
    color: '#64748B',
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: '#64748B',
    fontSize: 14,
  },

  createButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },

  createButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D4ED8',
  },

  userInfo: {
    flex: 1,
    minWidth: 0,
  },

  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
  },

  email: {
    marginTop: 4,
    marginBottom: 10,
    color: '#64748B',
  },

  detail: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
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

  active: {
    color: '#166534',
    backgroundColor: '#DCFCE7',
  },

  inactive: {
    color: '#991B1B',
    backgroundColor: '#FEE2E2',
  },

  statusButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },

  deactivateButton: {
    backgroundColor: '#FEE2E2',
  },

  activateButton: {
    backgroundColor: '#DCFCE7',
  },

  statusButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  emptyText: {
    padding: 24,
    textAlign: 'center',
    color: '#64748B',
  },

  errorBox: {
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
  },

  errorText: {
    color: '#991B1B',
  },

  retry: {
    marginTop: 10,
    color: '#1D4ED8',
    fontWeight: '600',
  },
});