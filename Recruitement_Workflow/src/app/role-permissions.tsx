
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import api from "@/services/api";
import { getAccountType } from "@/services/token.service";
import { getManagedOrganizations, type Organization } from "@/services/organizations";

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
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [showOrganizations, setShowOrganizations] = useState(false);

  const loadRolePermissions = useCallback(async (roleId: number) => {
    const response = await api.get<ApiResponse<Permission[]>>(
      `/permissions/role/${roleId}?organizationId=${organizationId}`
    );

    setSelectedPermissionIds(response.data.data.map((item) => item.id));
  }, [organizationId]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const accountType = await getAccountType();
      const orgs = await getManagedOrganizations();
      const selectedOrgId = accountType === "platform_admin" ? organizationId : orgs[0]?.id ?? null;
      setIsPlatformAdmin(accountType === "platform_admin");
      setOrganizations(orgs);
      if (selectedOrgId === null) {
        setOrganizationId(null);
        setRoles([]);
        setPermissions([]);
        setSelectedRoleId(null);
        setSelectedPermissionIds([]);
        return;
      }
      if (organizationId !== selectedOrgId) setOrganizationId(selectedOrgId);
      const orgQuery = `?organizationId=${selectedOrgId}`;
      const [rolesResponse, permissionsResponse] = await Promise.all([
        api.get<ApiResponse<Role[]>>(`/roles${orgQuery}`),
        api.get<ApiResponse<Permission[]>>(`/permissions${orgQuery}`),
      ]);

      const availableRoles = rolesResponse.data.data;
      setRoles(availableRoles);
      setPermissions(permissionsResponse.data.data);

      if (availableRoles.length > 0) {
        const firstRoleId = availableRoles[0].id;
        setSelectedRoleId(firstRoleId);
        const permissionsForRole = await api.get<ApiResponse<Permission[]>>(`/permissions/role/${firstRoleId}${orgQuery}`);
        setSelectedPermissionIds(permissionsForRole.data.data.map((item) => item.id));
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
  }, [loadRolePermissions, organizationId]);

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
        `/permissions/role/${selectedRoleId}?organizationId=${organizationId}`,
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
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText>Loading roles and permissions...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={[styles.hero, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primaryMuted }]}>
            <ThemedText style={[styles.heroIconText, { color: theme.primary }]}>R</ThemedText>
          </View>
          <View style={styles.heroCopy}>
            <ThemedText style={[styles.heroEyebrow, { color: theme.primary }]}>ACCESS CONTROL</ThemedText>
            <ThemedText style={styles.heading}>Role & Permissions</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>Choose a role and control which actions it can perform.</ThemedText>
          </View>
        </ThemedView>

        {loadError ? (
          <View style={styles.errorContainer}>
            <ThemedText>{loadError}</ThemedText>
            <Pressable
              onPress={() => void loadInitialData()}
              style={[styles.secondaryButton, { borderColor: theme.border }]}
            >
              <ThemedText>Retry</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            {isPlatformAdmin && (
              <ThemedView style={[styles.organizationPanel, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <View style={styles.organizationHeading}>
                  <View style={[styles.stepMark, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.stepMarkText, { color: theme.primary }]}>01</ThemedText></View>
                  <View style={styles.organizationCopy}>
                    <ThemedText style={styles.sectionTitle}>Select Organization</ThemedText>
                    <ThemedText style={[styles.description, { color: theme.textSecondary }]}>Choose an organization</ThemedText>
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showOrganizations }} onPress={() => setShowOrganizations((value) => !value)} style={[styles.organizationSelector, { borderColor: showOrganizations ? theme.primary : theme.border, backgroundColor: theme.background }]}>
                  <View style={[styles.organizationMark, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.organizationMarkText, { color: theme.primary }]}>O</ThemedText></View>
                  <ThemedText style={styles.organizationSelected} numberOfLines={1}>{organizations.find((item) => item.id === organizationId)?.name ?? "Choose an organization"}</ThemedText>
                  <ThemedText style={[styles.organizationChevron, { color: theme.primary }]}>{showOrganizations ? '-' : '+'}</ThemedText>
                </Pressable>
                {showOrganizations && <View style={[styles.organizationOptions, { borderColor: theme.border }]}>{organizations.map((organization) => {
                  const selected = organization.id === organizationId;
                  return <Pressable key={organization.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setShowOrganizations(false); setOrganizationId(organization.id); }} style={[styles.organizationOption, { backgroundColor: selected ? theme.primaryMuted : theme.backgroundElement }]}>
                    <ThemedText style={{ color: selected ? theme.primary : theme.text }}>{organization.name}</ThemedText>
                    {selected && <ThemedText style={[styles.selectedLabel, { color: theme.primary }]}>Selected</ThemedText>}
                  </Pressable>;
                })}</View>}
              </ThemedView>
            )}
            <View style={styles.sectionHeading}>
              <View style={[styles.stepMark, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.stepMarkText, { color: theme.primary }]}>{isPlatformAdmin ? '02' : '01'}</ThemedText></View>
              <View style={styles.organizationCopy}>
                <ThemedText style={styles.sectionTitle}>Select Role</ThemedText>
                <ThemedText style={[styles.description, { color: theme.textSecondary }]}>Choose a role to review its permissions</ThemedText>
              </View>
            </View>

            {roles.length === 0 && (
              <View style={[styles.emptyState, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.emptyIconText, { color: theme.primary }]}>P</ThemedText></View>
                <ThemedText style={styles.emptyTitle}>{isPlatformAdmin && organizationId === null ? 'Choose an organization' : 'No roles are configured.'}</ThemedText>
                <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>{isPlatformAdmin && organizationId === null ? 'Select an organization above to view its roles.' : 'Roles for this organization will appear here when configured.'}</ThemedText>
              </View>
            )}
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
                          ? theme.primary
                          : theme.border,
                        backgroundColor: isSelected
                          ? theme.primaryMuted
                          : theme.backgroundElement,
                        width: isWide ? '48.5%' : '100%',
                      },
                    ]}
                  >
                    <View style={styles.roleCardHeader}>
                      <ThemedText style={styles.roleName}>{role.name}</ThemedText>
                      {isSelected && <ThemedText style={[styles.selectedLabel, { color: theme.primary }]}>SELECTED</ThemedText>}
                    </View>
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
              <View style={styles.permissionTitleBlock}>
                <ThemedText style={styles.sectionTitle}>Permissions</ThemedText>
                <ThemedText style={[styles.description, { color: theme.textSecondary }]}>Actions available to the selected role</ThemedText>
              </View>
              <View style={[styles.countPill, { backgroundColor: theme.primaryMuted }]}>
                <ThemedText style={[styles.countText, { color: theme.primary }]}>{selectedPermissionIds.length} selected</ThemedText>
              </View>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : permissions.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: theme.primaryMuted }]}><ThemedText style={[styles.emptyIconText, { color: theme.primary }]}>P</ThemedText></View>
                <ThemedText style={styles.emptyTitle}>{isPlatformAdmin && organizationId === null ? 'Choose an organization' : 'No permissions are configured.'}</ThemedText>
                <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>{isPlatformAdmin && organizationId === null ? 'Select an organization above to view its roles and permissions.' : 'Permissions for the selected role will appear here when configured.'}</ThemedText>
              </View>
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
                        borderColor: theme.border,
                        opacity: saving ? 0.6 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked
                            ? theme.primary
                            : theme.border,
                          backgroundColor: checked
                              ? theme.primary
                            : "transparent",
                        },
                      ]}
                    >
                      {checked && (
                        <ThemedText
                          style={[styles.checkmark, { color: theme.primaryText }]}
                        >
                          {String.fromCharCode(10003)}
                        </ThemedText>
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

            {!isPlatformAdmin && <Pressable
              accessibilityRole="button"
              disabled={saving || loading || selectedRoleId === null}
              onPress={() => void handleSave()}
              style={[
                styles.saveButton,
                {
                  backgroundColor: theme.primary,
                  opacity: saving || loading ? 0.6 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <ThemedText
                  style={[styles.saveButtonText, { color: theme.primaryText }]}
                >
                  Save Permissions
                </ThemedText>
              )}
            </Pressable>}
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
    maxWidth: 960,
    alignSelf: "center",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
  },
  heading: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: { fontSize: 21, fontWeight: '800' },
  heroCopy: { flex: 1, gap: Spacing.one },
  heroEyebrow: { fontSize: 10, letterSpacing: 1.1, fontWeight: '800' },
  organizationPanel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  organizationHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  organizationCopy: { flex: 1, gap: 3 },
  stepMark: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepMarkText: { fontSize: 11, fontWeight: '800' },
  organizationSelector: { minHeight: 58, borderWidth: 1, borderRadius: 13, paddingHorizontal: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  organizationMark: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  organizationMarkText: { fontSize: 16, fontWeight: '800' },
  organizationSelected: { flex: 1, fontSize: 14, fontWeight: '700' },
  organizationChevron: { fontSize: 21, fontWeight: '700', paddingHorizontal: 4 },
  organizationOptions: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  organizationOption: { minHeight: 46, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  emptyState: { borderWidth: 1, borderRadius: 15, padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  emptyIconText: { fontSize: 20, fontWeight: '800' },
  emptyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyDescription: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 420 },
  permissionTitleBlock: { flex: 1, gap: 3 },
  countPill: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7 },
  countText: { fontSize: 11, fontWeight: '800' },
  selectedLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  roleCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  roleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  roleCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
    minHeight: 76,
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
    borderRadius: 14,
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
    borderRadius: 12,
    padding: Spacing.three,
    marginTop: Spacing.two,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    padding: Spacing.three,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  errorContainer: {
    gap: Spacing.three,
    padding: Spacing.three,
  },
});
