
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import axios from 'axios';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from '@/schemas/department';

import {
  createDepartment,
  getDepartments,
  updateDepartment,
  type Department,
} from '@/services/departments';

import {
  getOrganizations,
  type Organization,
} from '@/services/organizations';

export default function DepartmentsScreen() {
  const theme = useTheme();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState<number | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showOrganizations, setShowOrganizations] = useState(false);

  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const selectedOrganization = organizations.find(
    (organization) => organization.id === selectedOrganizationId,
  );

  const loadOrganizations = useCallback(async () => {
    setLoadingOrganizations(true);
    setError('');

    try {
      const data = await getOrganizations();

      setOrganizations(data);

      setSelectedOrganizationId((currentId) => {
        if (currentId !== null && data.some((item) => item.id === currentId)) {
          return currentId;
        }

        return data[0]?.id ?? null;
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load organizations.'));
    } finally {
      setLoadingOrganizations(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    if (selectedOrganizationId === null) {
      setDepartments([]);
      return;
    }

    setLoadingDepartments(true);
    setError('');

    try {
      const data = await getDepartments(selectedOrganizationId);
      setDepartments(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to load departments.'));
    } finally {
      setLoadingDepartments(false);
    }
  }, [selectedOrganizationId]);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  function resetForm() {
    setName('');
    setDescription('');
    setEditingId(null);
    setFeedback('');
  }

  function startEditing(department: Department) {
    setEditingId(department.id);
    setName(department.name);
    setDescription(department.description ?? '');
    setFeedback('');
    setError('');
  }

  async function handleSubmit() {
    if (submitting) return;

    setError('');
    setFeedback('');

    if (selectedOrganizationId === null && editingId === null) {
      setError('Please select an organization first.');
      return;
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (editingId === null) {
      const validation = createDepartmentSchema.safeParse({
        organization_id: selectedOrganizationId,
        name: trimmedName,
        description: trimmedDescription,
      });

      if (!validation.success) {
        setError(validation.error.issues[0]?.message ?? 'Check your input.');
        return;
      }

      setSubmitting(true);

      try {
        const created = await createDepartment(validation.data);

        if (created.organization_id === selectedOrganizationId) {
          setDepartments((current) => [
            ...current.filter((item) => item.id !== created.id),
            created,
          ].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          await loadDepartments();
        }

        resetForm();
        setFeedback('Department created successfully.');
      } catch (err) {
        setError(getErrorMessage(err, 'Unable to create department.'));
      } finally {
        setSubmitting(false);
      }

      return;
    }

    const validation = updateDepartmentSchema.safeParse({
      name: trimmedName,
      description: trimmedDescription,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Check your input.');
      return;
    }

    setSubmitting(true);

    try {
      const updated = await updateDepartment(editingId, validation.data);

      setDepartments((current) =>
        current
          .map((item) => (item.id === editingId ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      resetForm();
      setFeedback('Department updated successfully.');
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to update department.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <ThemedText type="title">Department Management</ThemedText>
          <ThemedText themeColor="textSecondary">
            Manage departments within each organization.
          </ThemedText>
        </View>

        <ThemedView
          style={[
            styles.card,
            { borderColor: theme.backgroundSelected },
          ]}
        >
          <ThemedText type="subtitle">Select Organization</ThemedText>

          {loadingOrganizations ? (
            <ActivityIndicator />
          ) : organizations.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              No organizations found. Create an organization first.
            </ThemedText>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowOrganizations((value) => !value)}
                style={[
                  styles.selector,
                  { borderColor: theme.backgroundSelected },
                ]}
              >
                <ThemedText>
                  {selectedOrganization?.name ?? 'Select organization'}
                </ThemedText>
                <ThemedText>{showOrganizations ? '▲' : '▼'}</ThemedText>
              </Pressable>

              {showOrganizations && (
                <View
                  style={[
                    styles.dropdown,
                    { borderColor: theme.backgroundSelected },
                  ]}
                >
                  {organizations.map((organization) => (
                    <Pressable
                      key={organization.id}
                      onPress={() => {
                        setSelectedOrganizationId(organization.id);
                        setShowOrganizations(false);
                        resetForm();
                        setError('');
                      }}
                      style={styles.dropdownItem}
                    >
                      <ThemedText>
                        {organization.name}
                        {organization.id === selectedOrganizationId
                          ? '  ✓'
                          : ''}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </ThemedView>

        <ThemedView
          style={[
            styles.card,
            { borderColor: theme.backgroundSelected },
          ]}
        >
          <ThemedText type="subtitle">
            {editingId === null ? 'Create Department' : 'Edit Department'}
          </ThemedText>

          <View style={styles.field}>
            <ThemedText type="smallBold">Department Name *</ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Engineering"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              editable={!submitting}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="smallBold">Description</ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Enter department description"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={3}
              editable={!submitting}
              style={[
                styles.input,
                styles.multilineInput,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
            />
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          )}

          {!!feedback && (
            <View style={styles.successBox}>
              <ThemedText style={styles.successText}>{feedback}</ThemedText>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={submitting || loadingOrganizations}
            onPress={handleSubmit}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.text },
              submitting && styles.disabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText
                style={{ color: theme.background, fontWeight: '700' }}
              >
                {editingId === null ? 'Create Department' : 'Save Changes'}
              </ThemedText>
            )}
          </Pressable>

          {editingId !== null && (
            <Pressable
              accessibilityRole="button"
              onPress={resetForm}
              style={[
                styles.secondaryButton,
                { borderColor: theme.backgroundSelected },
              ]}
            >
              <ThemedText>Cancel Editing</ThemedText>
            </Pressable>
          )}
        </ThemedView>

        <View style={styles.listHeading}>
          <ThemedText type="subtitle">Departments</ThemedText>

          <Pressable
            accessibilityRole="button"
            onPress={() => void loadDepartments()}
            disabled={loadingDepartments}
            style={[
              styles.secondaryButton,
              { borderColor: theme.backgroundSelected },
            ]}
          >
            <ThemedText>Refresh</ThemedText>
          </Pressable>
        </View>

        {loadingDepartments ? (
          <ActivityIndicator size="large" />
        ) : selectedOrganizationId === null ? (
          <ThemedText themeColor="textSecondary">
            Select an organization to view its departments.
          </ThemedText>
        ) : departments.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            No departments found for this organization.
          </ThemedText>
        ) : (
          <View style={styles.departmentList}>
            {departments.map((department) => (
              <ThemedView
                key={department.id}
                style={[
                  styles.departmentCard,
                  { borderColor: theme.backgroundSelected },
                ]}
              >
                <View style={styles.departmentInfo}>
                  <ThemedText type="subtitle">{department.name}</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    {department.description || 'No description provided'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Department ID: {department.id}
                  </ThemedText>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => startEditing(department)}
                  style={[
                    styles.editButton,
                    { borderColor: theme.backgroundSelected },
                  ]}
                >
                  <ThemedText>Edit</ThemedText>
                </Pressable>
              </ThemedView>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  heading: {
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  selector: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: Spacing.three,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 90,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: Spacing.three,
  },
  secondaryButton: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  errorBox: {
    padding: Spacing.three,
    borderRadius: 8,
    backgroundColor: '#FFF0F0',
  },
  errorText: {
    color: '#A32626',
  },
  successBox: {
    padding: Spacing.three,
    borderRadius: 8,
    backgroundColor: '#E9F8EF',
  },
  successText: {
    color: '#176B37',
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  departmentList: {
    gap: Spacing.three,
  },
  departmentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  departmentInfo: {
    flex: 1,
    gap: Spacing.two,
  },
  editButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
