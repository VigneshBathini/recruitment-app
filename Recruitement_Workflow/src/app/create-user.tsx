
import { useEffect, useState } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { createUser } from '@/services/user.service';
import axios from "axios";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000/api";

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
  colors: {
    text: string;
    secondaryText: string;
    border: string;
    inputBackground: string;
    selectedBackground: string;
  };
}) {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find(
    (option) => option.value === value
  );

  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.label, { color: colors.text }]}>
        {label}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((previous) => !previous)}
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
          {open ? "▲" : "▼"}
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
            {options.map((option) => {
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
                      backgroundColor: colors.selectedBackground,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: selected ? "600" : "400",
                      flex: 1,
                    }}
                  >
                    {option.label}
                  </Text>

                  {selected && (
                    <Text style={{ color: colors.text }}>✓</Text>
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

export default function CreateUserScreen() {
  const isDark = useColorScheme() === "dark";

  const colors = {
    background: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F8FAFC" : "#0F172A",
    secondaryText: isDark ? "#CBD5E1" : "#64748B",
    border: isDark ? "#475569" : "#CBD5E1",
    inputBackground: isDark ? "#1E293B" : "#FFFFFF",
    selectedBackground: isDark ? "#334155" : "#DBEAFE",
    primary: "#2563EB",
    errorBackground: isDark ? "#451A1A" : "#FEE2E2",
    errorText: isDark ? "#FCA5A5" : "#991B1B",
  };

  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [roleId, setRoleId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadFormData() {
      try {
        setLoadError("");

        const [rolesResponse, departmentsResponse] = await Promise.all([
          fetch(`${API_URL}/roles`),
          fetch(`${API_URL}/departments/${ORGANIZATION_ID}`),
        ]);

        if (!rolesResponse.ok || !departmentsResponse.ok) {
          throw new Error("Unable to load roles or departments.");
        }

        const rolesResult = await rolesResponse.json();
        const departmentsResult = await departmentsResponse.json();

        if (!rolesResult.success || !departmentsResult.success) {
          throw new Error("The server returned an error loading form data.");
        }

        if (!cancelled) {
          setRoles(rolesResult.data);
          setDepartments(departmentsResult.data);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Failed to load form data."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFormData();

    return () => {
      cancelled = true;
    };
  }, []);

 async function handleCreateUser() {
  if (!firstName.trim()) {
    Alert.alert('Validation', 'Please enter the first name.');
    return;
  }

  if (!email.trim()) {
    Alert.alert('Validation', 'Please enter the email address.');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    Alert.alert('Validation', 'Please enter a valid email address.');
    return;
  }

  if (password.length < 8) {
    Alert.alert(
      'Validation',
      'Password must contain at least 8 characters.',
    );
    return;
  }

  if (roleId === null) {
    Alert.alert('Validation', 'Please select a role.');
    return;
  }

  setSaving(true);

  try {
    await createUser({
      organization_id: ORGANIZATION_ID,
      role_id: roleId,
      department_id: departmentId,
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      email: email.trim().toLowerCase(),
      password,
    });

    Alert.alert('Success', 'User created successfully.', [
      {
        text: 'OK',
        onPress: () => router.replace('/users' as any),
      },
    ]);
  } catch (error) {
    let message = 'Something went wrong.';

    if (axios.isAxiosError(error)) {
      message =
        error.response?.data?.message ??
        error.message ??
        'Unable to create user.';
    } else if (error instanceof Error) {
      message = error.message;
    }

    Alert.alert('Create User Failed', message);
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
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={[styles.helper, { color: colors.secondaryText }]}
        >
          Loading roles and departments...
        </Text>
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
        Create User
      </Text>

      <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
        Add a member to your organization.
      </Text>

      {!!loadError && (
        <View
          style={[
            styles.errorBox,
            { backgroundColor: colors.errorBackground },
          ]}
        >
          <Text style={{ color: colors.errorText }}>
            {loadError}
          </Text>

          <Pressable
            onPress={() => router.replace("/create-user" as any)}
            style={styles.retryButton}
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              Reload screen
            </Text>
          </Pressable>
        </View>
      )}

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

      <Text style={[styles.label, { color: colors.text }]}>
        Temporary Password *
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Minimum 8 characters"
        placeholderTextColor={colors.secondaryText}
        secureTextEntry
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
        options={roles.map((role) => ({
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
          { label: "No department", value: null },
          ...departments.map((department) => ({
            label: department.name,
            value: department.id,
          })),
        ]}
        value={departmentId}
        onChange={setDepartmentId}
        colors={colors}
      />

      <Pressable
        onPress={handleCreateUser}
        disabled={saving || !!loadError}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.primary },
          (pressed || saving || !!loadError) &&
            styles.buttonDisabled,
        ]}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Create User</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingBottom: 48,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  heading: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  dropdownMenu: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  button: {
    marginTop: 28,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },

  helper: {
    marginTop: 12,
  },

  errorBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },

  retryButton: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
});
