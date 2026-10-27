
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import api from "@/services/api";

type Role = {
  id: number;
  name: string;
  description?: string | null;
};

type Permission = {
  id: number;
  name: string;
  description?: string | null;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

export default function RolePermissionsScreen() {
  const theme = useTheme();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadRolePermissions = useCallback(async (roleId: number) => {
    const response = await api.get<ApiResponse<Permission[]>>(
      `/permissions/role/${roleId}`
    );

    setSelectedPermissionIds(response.data.data.map((item) => item.id));
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        api.get<ApiResponse<Role[]>>("/roles"),
        api.get<ApiResponse<Permission[]>>("/permissions"),
      ]);

      const availableRoles = rolesResponse.data.data;
      setRoles(availableRoles);
      setPermissions(permissionsResponse.data.data);

      if (availableRoles.length > 0) {
        const firstRoleId = availableRoles[0].id;
        setSelectedRoleId(firstRoleId);
        await loadRolePermissions(firstRoleId);
      } else {
        setSelectedRoleId(null);
        setSelectedPermissionIds([]);
      }
    } catch (error) {
      console.error("Failed to load role permissions:", error);
      setLoadError(
        "Unable to load roles and permissions. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [loadRolePermissions]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  async function handleSelectRole(roleId: number) {
    if (saving || roleId === selectedRoleId) return;

    setSelectedRoleId(roleId);
    setSelectedPermissionIds([]);
    setLoading(true);
    setLoadError("");

    try {
      await loadRolePermissions(roleId);
    } catch (error) {
      console.error("Failed to load selected role:", error);
      setLoadError("Unable to load permissions for this role.");
    } finally {
      setLoading(false);
    }
  }

  function togglePermission(permissionId: number) {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  }

  async function handleSave() {
    if (selectedRoleId === null || saving) return;

    setSaving(true);

    try {
      const response = await api.put<ApiResponse<Permission[]>>(
        `/permissions/role/${selectedRoleId}`,
        { permissionIds: selectedPermissionIds }
      );

      setSelectedPermissionIds(response.data.data.map((item) => item.id));

      Alert.alert(
        "Success",
        response.data.message ?? "Role permissions updated successfully."
      );
    } catch (error) {
      console.error("Failed to save role permissions:", error);
      Alert.alert(
        "Save Failed",
        "Unable to update permissions. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading && roles.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText>Loading roles and permissions...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={styles.heading}>Role & Permissions</ThemedText>
        <ThemedText
          style={[styles.subtitle, { color: theme.textSecondary }]}
        >
          Choose a role and control which actions it can perform.
        </ThemedText>

        {loadError ? (
          <View style={styles.errorContainer}>
            <ThemedText>{loadError}</ThemedText>
            <Pressable
              onPress={() => void loadInitialData()}
              style={styles.secondaryButton}
            >
              <ThemedText>Retry</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <ThemedText style={styles.sectionTitle}>Select Role</ThemedText>

            <View style={styles.roleList}>
              {roles.map((role) => {
                const isSelected = role.id === selectedRoleId;

                return (
                  <Pressable
                    key={role.id}
                    disabled={loading || saving}
                    onPress={() => void handleSelectRole(role.id)}
                    style={[
                      styles.roleCard,
                      {
                        borderColor: isSelected
                          ? theme.text
                          : theme.textSecondary,
                        backgroundColor: isSelected
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                      },
                    ]}
                  >
                    <ThemedText style={styles.roleName}>
                      {isSelected ? "● " : "○ "}
                      {role.name}
                    </ThemedText>
                    {!!role.description && (
                      <ThemedText
                        style={[
                          styles.description,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {role.description}
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.permissionHeader}>
              <ThemedText style={styles.sectionTitle}>
                Permissions
              </ThemedText>
              <ThemedText style={{ color: theme.textSecondary }}>
                {selectedPermissionIds.length} selected
              </ThemedText>
            </View>

            {loading ? (
              <ActivityIndicator size="small" />
            ) : permissions.length === 0 ? (
              <ThemedText>No permissions are configured.</ThemedText>
            ) : (
              permissions.map((permission) => {
                const checked = selectedPermissionIds.includes(permission.id);

                return (
                  <Pressable
                    key={permission.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    disabled={saving}
                    onPress={() => togglePermission(permission.id)}
                    style={[
                      styles.permissionRow,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.textSecondary,
                        opacity: saving ? 0.6 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked
                            ? theme.text
                            : theme.textSecondary,
                          backgroundColor: checked
                            ? theme.text
                            : "transparent",
                        },
                      ]}
                    >
                      {checked && (
                        <ThemedText style={styles.checkmark}>✓</ThemedText>
                      )}
                    </View>

                    <View style={styles.permissionContent}>
                      <ThemedText style={styles.permissionName}>
                        {permission.name}
                      </ThemedText>
                      {!!permission.description && (
                        <ThemedText
                          style={[
                            styles.description,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {permission.description}
                        </ThemedText>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}

            <Pressable
              accessibilityRole="button"
              disabled={saving || loading || selectedRoleId === null}
              onPress={() => void handleSave()}
              style={[
                styles.saveButton,
                {
                  backgroundColor: theme.text,
                  opacity: saving || loading ? 0.6 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.saveButtonText}>
                  Save Permissions
                </ThemedText>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  roleList: {
    gap: Spacing.two,
  },
  roleCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  roleName: {
    fontSize: 15,
    fontWeight: "600",
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  permissionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.two,
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  permissionContent: {
    flex: 1,
    gap: Spacing.one,
  },
  permissionName: {
    fontSize: 14,
    fontWeight: "600",
  },
  saveButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#888888",
    padding: Spacing.three,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  errorContainer: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
});

