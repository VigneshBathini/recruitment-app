
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import axios from 'axios';

import {
  getUsers,
  updateUser,
  type User,
} from '@/services/user.service';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'http://192.168.1.128:5000/api';

const ORGANIZATION_ID = 1;

type Role = {
  id: number;
  name: string;
  description: string | null;
};

type Department = {
  id: number;
  name: string;
};

type Option = {
  label: string;
  value: number | null;
};

type DropdownColors = {
  text: string;
  secondaryText: string;
  border: string;
  inputBackground: string;
  selectedBackground: string;
};

function CustomDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
  colors,
}: {
  label: string;
  placeholder: string;
  options: Option[];
  value: number | null;
  onChange: (value: number | null) => void;
  colors: DropdownColors;
}) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find(
    option => option.value === value,
  );

  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(previous => !previous)}
        style={[
          styles.dropdownTrigger,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <Text
          style={{
            color: selectedOption
              ? colors.text
              : colors.secondaryText,
            flex: 1,
          }}
        >
          {selectedOption?.label ?? placeholder}
        </Text>

        <Text style={{ color: colors.text }}>
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>

      {open && (
        <View
          style={[
            styles.dropdownMenu,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.dropdownScroll}
          >
            {options.map(option => {
              const selected = option.value === value;

              return (
                <Pressable
                  key={String(option.value)}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.dropdownOption,
                    selected && {
                      backgroundColor:
                        colors.selectedBackground,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: selected ? '600' : '400',
                      flex: 1,
                    }}
                  >
                    {option.label}
                  </Text>

                  {selected && (
                    <Text style={{ color: colors.text }}>
                      ✓
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

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

  return error instanceof Error
    ? error.message
    : fallback;
}

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isDark = useColorScheme() === 'dark';

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    text: isDark ? '#F8FAFC' : '#0F172A',
    secondaryText: isDark ? '#CBD5E1' : '#64748B',
    border: isDark ? '#475569' : '#CBD5E1',
    inputBackground: isDark ? '#1E293B' : '#FFFFFF',
    selectedBackground: isDark ? '#334155' : '#DBEAFE',
    primary: '#2563EB',
    errorBackground: isDark ? '#451A1A' : '#FEE2E2',
    errorText: isDark ? '#FCA5A5' : '#991B1B',
  };

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [user, setUser] = useState<User | null>(null);

  const [roleId, setRoleId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] =
    useState<number | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadEditData() {
      try {
        setLoading(true);
        setLoadError('');

        if (!id || Array.isArray(id)) {
          throw new Error('Invalid user ID.');
        }

        const userId = Number(id);

        if (!Number.isInteger(userId) || userId <= 0) {
          throw new Error('Invalid user ID.');
        }

        const [users, rolesResponse, departmentsResponse] =
          await Promise.all([
            getUsers(ORGANIZATION_ID),
            fetch(`${API_URL}/roles`),
            fetch(
              `${API_URL}/departments/${ORGANIZATION_ID}`,
            ),
          ]);

        if (
          !rolesResponse.ok ||
          !departmentsResponse.ok
        ) {
          throw new Error(
            'Unable to load roles or departments.',
          );
        }

        const rolesResult = await rolesResponse.json();
        const departmentsResult =
          await departmentsResponse.json();

        if (
          !rolesResult.success ||
          !departmentsResult.success
        ) {
          throw new Error(
            'The server returned an error loading form data.',
          );
        }

        const selectedUser = users.find(
          item => item.id === userId,
        );

        if (!selectedUser) {
          throw new Error(
            'User not found in this organization.',
          );
        }

        if (cancelled) return;

        setUser(selectedUser);
        setRoles(rolesResult.data);
        setDepartments(departmentsResult.data);

        setFirstName(selectedUser.first_name);
        setLastName(selectedUser.last_name ?? '');
        setEmail(selectedUser.email);
        setRoleId(selectedUser.role_id);
        setDepartmentId(selectedUser.department_id);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            getErrorMessage(
              error,
              'Failed to load user details.',
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEditData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleUpdateUser() {
    if (!user) return;

    if (!firstName.trim()) {
      Alert.alert('Validation', 'Enter the first name.');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Validation', 'Enter the email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert(
        'Validation',
        'Enter a valid email address.',
      );
      return;
    }

    if (roleId === null) {
      Alert.alert('Validation', 'Please select a role.');
      return;
    }

    setSaving(true);

    try {
      await updateUser(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim().toLowerCase(),
        role_id: roleId,
        department_id: departmentId,
      });

      Alert.alert(
        'Success',
        'User updated successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/users'),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Update Failed',
        getErrorMessage(
          error,
          'Unable to update user.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
        <Text
          style={[
            styles.helper,
            { color: colors.secondaryText },
          ]}
        >
          Loading user details...
        </Text>
      </View>
    );
  }

  if (loadError || !user) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={{ color: colors.errorText }}>
          {loadError || 'User not found.'}
        </Text>

        <Pressable
          onPress={() => router.replace('/users')}
          style={styles.backButton}
        >
          <Text style={styles.buttonText}>
            Back to Users
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: colors.text }]}>
        Edit User
      </Text>

      <Text
        style={[
          styles.subtitle,
          { color: colors.secondaryText },
        ]}
      >
        Update this organization member's details.
      </Text>

      <Text style={[styles.label, { color: colors.text }]}>
        First Name *
      </Text>
      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Enter first name"
        placeholderTextColor={colors.secondaryText}
        autoCapitalize="words"
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}
      />

      <Text style={[styles.label, { color: colors.text }]}>
        Last Name
      </Text>
      <TextInput
        value={lastName}
        onChangeText={setLastName}
        placeholder="Enter last name"
        placeholderTextColor={colors.secondaryText}
        autoCapitalize="words"
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}
      />

      <Text style={[styles.label, { color: colors.text }]}>
        Email *
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Enter email address"
        placeholderTextColor={colors.secondaryText}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}
      />

      <CustomDropdown
        label="Role *"
        placeholder="Select a role"
       options={roles
  .filter(role => role.name !== 'Organization Admin')
  .map(role => ({
    label: role.name,
    value: role.id,
  }))}
        value={roleId}
        onChange={setRoleId}
        colors={colors}
      />

      <CustomDropdown
        label="Department"
        placeholder="No department"
        options={[
          { label: 'No department', value: null },
          ...departments.map(department => ({
            label: department.name,
            value: department.id,
          })),
        ]}
        value={departmentId}
        onChange={setDepartmentId}
        colors={colors}
      />

      <Pressable
        onPress={handleUpdateUser}
        disabled={saving}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary },
          (pressed || saving) && styles.buttonDisabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Save Changes
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        disabled={saving}
        style={styles.cancelButton}
      >
        <Text
          style={[
            styles.cancelText,
            { color: colors.secondaryText },
          ]}
        >
          Cancel
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingBottom: 48,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  heading: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },

  fieldContainer: {
    marginTop: 16,
  },

  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },

  dropdownTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  dropdownMenu: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 4,
  },

  dropdownScroll: {
    maxHeight: 220,
  },

  dropdownOption: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  button: {
    marginTop: 28,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  helper: {
    marginTop: 12,
  },

  backButton: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
  },

  cancelButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },

  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
