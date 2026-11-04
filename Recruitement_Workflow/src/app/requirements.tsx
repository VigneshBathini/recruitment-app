import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createRequirementSchema } from '@/schemas/requirement';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getDepartments, type Department } from '@/services/departments';
import {
  getPendingRequirements,
  getRequirements,
  approveRequirement,
  rejectRequirement,
  submitRequirement,
  updateRequirement,
  type RequirementInput,
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

const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'];

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'Unable to load requirements.';
  }

  return error instanceof Error ? error.message : 'Unable to load requirements.';
}

function formatReviewDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

type EditValues = Omit<RequirementInput, 'department_id' | 'openings' | 'experience_min_years' | 'experience_max_years' | 'description'> & {
  department_id: string;
  openings: string;
  experience_min_years: string;
  experience_max_years: string;
  description: string;
};

type RequirementDialog = {
  kind: 'submit' | 'approve' | 'reject';
  requirement: Requirement;
} | null;

export default function RequirementsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [dialog, setDialog] = useState<RequirementDialog>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingEditDepartments, setLoadingEditDepartments] = useState(false);
  const [editError, setEditError] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [working, setWorking] = useState(false);
  const [workingRequirementId, setWorkingRequirementId] = useState<number | null>(null);

  const loadRequirements = useCallback(async () => {
    try {
      setError('');
      const organization = await getCurrentOrganizationUser();
      const permissions = organization.permissions ?? [];
      setCanManage(permissions.includes('requirement.manage'));
      setCanApprove(permissions.includes('requirement.approve'));

      const requirementsRequest = permissions.includes('requirement.view') || permissions.includes('requirement.manage')
        ? getRequirements()
        : permissions.includes('requirement.approve')
          ? getPendingRequirements()
          : Promise.resolve([]);
      const requirementData = await requirementsRequest;

      setRequirements(requirementData);
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

  async function openEditor(requirement: Requirement) {
    setEditingRequirement(requirement);
    setEditValues({
      department_id: String(requirement.department_id),
      title: requirement.title,
      openings: String(requirement.openings),
      experience_min_years: String(requirement.experience_min_years),
      experience_max_years: String(requirement.experience_max_years),
      location: requirement.location ?? '',
      employment_type: requirement.employment_type ?? '',
      description: requirement.description ?? '',
    });
    setEditError('');
    setLoadingEditDepartments(true);
    try {
      const organization = await getCurrentOrganizationUser();
      setDepartments(await getDepartments(organization.id));
    } catch (departmentError) {
      setEditError(getErrorMessage(departmentError));
    } finally {
      setLoadingEditDepartments(false);
    }
  }

  function openDialog(kind: 'submit' | 'approve' | 'reject', requirement: Requirement) {
    setDialog({ kind, requirement });
    setRejectionReason('');
    setReasonError('');
  }

  async function performDialogAction() {
    if (!dialog || working) return;
    if (dialog.kind === 'reject' && !rejectionReason.trim()) {
      setReasonError('A rejection reason is required.');
      return;
    }

    setWorking(true);
    setWorkingRequirementId(dialog.requirement.id);
    try {
      if (dialog.kind === 'submit') await submitRequirement(dialog.requirement.id);
      else if (dialog.kind === 'approve') await approveRequirement(dialog.requirement.id);
      else await rejectRequirement(dialog.requirement.id, rejectionReason.trim());

      const successMessage = dialog.kind === 'submit'
        ? 'Requirement submitted for approval.'
        : dialog.kind === 'approve'
          ? 'Requirement approved.'
          : 'Requirement rejected.';
      setDialog(null);
      setFeedback({ kind: 'success', message: successMessage });
      await loadRequirements();
    } catch (actionError) {
      setDialog(null);
      setFeedback({ kind: 'error', message: getErrorMessage(actionError) });
    } finally {
      setWorking(false);
      setWorkingRequirementId(null);
    }
  }

  async function saveEdit() {
    if (!editingRequirement || !editValues || working) return;
    setEditError('');
    const validation = createRequirementSchema.safeParse({
      ...editValues,
      department_id: Number(editValues.department_id),
      openings: editValues.openings.trim() === '' ? undefined : Number(editValues.openings),
      experience_min_years: editValues.experience_min_years.trim() === '' ? undefined : Number(editValues.experience_min_years),
      experience_max_years: editValues.experience_max_years.trim() === '' ? undefined : Number(editValues.experience_max_years),
      description: editValues.description.trim() || null,
    });
    if (!validation.success) {
      setEditError(validation.error.issues[0]?.message ?? 'Please check the requirement details.');
      return;
    }

    setWorking(true);
    setWorkingRequirementId(editingRequirement.id);
    try {
      await updateRequirement(editingRequirement.id, validation.data);
      setEditingRequirement(null);
      setEditValues(null);
      setFeedback({ kind: 'success', message: 'Requirement details saved.' });
      await loadRequirements();
    } catch (editActionError) {
      setEditError(getErrorMessage(editActionError));
    } finally {
      setWorking(false);
      setWorkingRequirementId(null);
    }
  }

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
              {item.department_name ?? `Department ${item.department_id}`}
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

        {item.reviewer_name || item.reviewed_at || item.rejection_reason ? (
          <View style={[styles.reviewDetails, { borderTopColor: theme.border }]}>
            {item.reviewer_name ? <Detail label="Reviewed by" value={item.reviewer_name} /> : null}
            {formatReviewDate(item.reviewed_at) ? <Detail label="Review date" value={formatReviewDate(item.reviewed_at)!} /> : null}
            {item.rejection_reason ? (
              <View style={styles.rejectionReason}>
                <ThemedText type="smallBold" style={{ color: theme.danger }}>Rejection reason</ThemedText>
                <ThemedText themeColor="textSecondary">{item.rejection_reason}</ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}

        {(canManage && (item.status === 'DRAFT' || item.status === 'REJECTED')) ||
        (canApprove && item.status === 'PENDING_APPROVAL') ? (
          <View style={styles.actions}>
            {canManage && (item.status === 'DRAFT' || item.status === 'REJECTED') ? (
              <>
                <ActionButton label="Edit" onPress={() => openEditor(item)} theme={theme} disabled={working} />
                <ActionButton label="Submit for approval" onPress={() => openDialog('submit', item)} theme={theme} disabled={working} primary />
              </>
            ) : null}
            {canApprove && item.status === 'PENDING_APPROVAL' ? (
              <>
                <ActionButton label="Approve" onPress={() => openDialog('approve', item)} theme={theme} disabled={working} primary />
                <ActionButton label="Reject" onPress={() => openDialog('reject', item)} theme={theme} disabled={working} danger />
              </>
            ) : null}
          </View>
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
            {feedback ? (
              <View style={[styles.feedbackBanner, { backgroundColor: feedback.kind === 'success' ? theme.successBackground : theme.dangerBackground }]}>
                <ThemedText style={{ color: feedback.kind === 'success' ? theme.success : theme.danger }}>{feedback.message}</ThemedText>
                <Pressable accessibilityRole="button" onPress={() => setFeedback(null)} hitSlop={8}>
                  <ThemedText style={{ color: feedback.kind === 'success' ? theme.success : theme.danger, fontWeight: '700' }}>Dismiss</ThemedText>
                </Pressable>
              </View>
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
      <Modal
        visible={Boolean(editingRequirement && editValues)}
        transparent
        animationType="fade"
        onRequestClose={() => !working && setEditingRequirement(null)}>
        {editingRequirement && editValues ? (
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !working && setEditingRequirement(null)} />
            <View style={[styles.modalCard, styles.editModalCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="subtitle">Edit requirement</ThemedText>
              <ThemedText themeColor="textSecondary">{editingRequirement.status === 'REJECTED' ? 'Update the role details, then submit it again for approval.' : 'Update this draft requirement.'}</ThemedText>
              <ScrollView style={styles.editFields} keyboardShouldPersistTaps="handled">
                <View style={styles.editField}>
                  <ThemedText type="smallBold">Department</ThemedText>
                  {loadingEditDepartments ? (
                    <ThemedText themeColor="textSecondary">Loading departments…</ThemedText>
                  ) : (
                    <View style={[styles.editPickerWrap, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                      <Picker
                        accessibilityLabel="Department"
                        selectedValue={editValues.department_id}
                        onValueChange={(department_id) => setEditValues((current) => current ? { ...current, department_id: String(department_id ?? '') } : current)}
                        style={[styles.editPicker, { color: theme.text, backgroundColor: theme.backgroundElement }]}>
                        {!departments.some((department) => String(department.id) === editValues.department_id) ? (
                          <Picker.Item label={editingRequirement.department_name ?? `Department ${editingRequirement.department_id}`} value={editValues.department_id} color={theme.text} />
                        ) : null}
                        {departments.map((department) => (
                          <Picker.Item key={department.id} label={department.name} value={String(department.id)} color={theme.text} />
                        ))}
                      </Picker>
                    </View>
                  )}
                </View>
                <EditField label="Job title" value={editValues.title} onChangeText={(title) => setEditValues((current) => current ? { ...current, title } : current)} theme={theme} />
                <EditField label="Openings" value={editValues.openings} keyboardType="number-pad" onChangeText={(openings) => setEditValues((current) => current ? { ...current, openings } : current)} theme={theme} />
                <View style={[styles.modalRow, width < 640 && styles.modalColumn]}>
                  <EditField label="Minimum experience" value={editValues.experience_min_years} keyboardType="decimal-pad" onChangeText={(experience_min_years) => setEditValues((current) => current ? { ...current, experience_min_years } : current)} theme={theme} />
                  <EditField label="Maximum experience" value={editValues.experience_max_years} keyboardType="decimal-pad" onChangeText={(experience_max_years) => setEditValues((current) => current ? { ...current, experience_max_years } : current)} theme={theme} />
                </View>
                <EditField label="Location" value={editValues.location} onChangeText={(location) => setEditValues((current) => current ? { ...current, location } : current)} theme={theme} />
                <View style={styles.editField}>
                  <ThemedText type="smallBold">Employment type</ThemedText>
                  <View style={[styles.editPickerWrap, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <Picker
                      accessibilityLabel="Employment type"
                      selectedValue={editValues.employment_type}
                      onValueChange={(employment_type) => setEditValues((current) => current ? { ...current, employment_type: String(employment_type ?? '') } : current)}
                      style={[styles.editPicker, { color: theme.text, backgroundColor: theme.backgroundElement }]}>
                      {!employmentTypes.includes(editValues.employment_type) ? (
                        <Picker.Item label={editValues.employment_type} value={editValues.employment_type} color={theme.text} />
                      ) : null}
                      {employmentTypes.map((employmentType) => (
                        <Picker.Item key={employmentType} label={employmentType} value={employmentType} color={theme.text} />
                      ))}
                    </Picker>
                  </View>
                </View>
                <EditField label="Description" value={editValues.description ?? ''} multiline onChangeText={(description) => setEditValues((current) => current ? { ...current, description } : current)} theme={theme} />
              </ScrollView>
              {editError ? <ThemedText style={{ color: theme.danger }}>{editError}</ThemedText> : null}
              <View style={styles.modalActions}>
                <ActionButton label="Cancel" onPress={() => setEditingRequirement(null)} theme={theme} disabled={working} />
                <ActionButton label={working && workingRequirementId === editingRequirement.id ? 'Saving…' : 'Save changes'} onPress={() => void saveEdit()} theme={theme} disabled={working} primary />
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal
        visible={Boolean(dialog)}
        transparent
        animationType="fade"
        onRequestClose={() => !working && setDialog(null)}>
        {dialog ? (
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !working && setDialog(null)} />
            <View style={[styles.modalCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="subtitle">{dialog.kind === 'submit' ? 'Submit for approval?' : dialog.kind === 'approve' ? 'Approve requirement?' : 'Reject requirement?'}</ThemedText>
              <ThemedText themeColor="textSecondary">{dialog.requirement.title}</ThemedText>
              {dialog.kind === 'reject' ? (
                <View style={styles.editField}>
                  <ThemedText type="smallBold">Rejection reason *</ThemedText>
                  <TextInput
                    accessibilityLabel="Rejection reason"
                    value={rejectionReason}
                    onChangeText={(value) => { setRejectionReason(value); setReasonError(''); }}
                    placeholder="Explain why this requirement is being rejected"
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    textAlignVertical="top"
                    style={[styles.editInput, styles.reasonInput, { backgroundColor: theme.backgroundElement, borderColor: reasonError ? theme.danger : theme.border, color: theme.text }]}
                  />
                  {reasonError ? <ThemedText type="small" style={{ color: theme.danger }}>{reasonError}</ThemedText> : null}
                </View>
              ) : (
                <ThemedText themeColor="textSecondary">{dialog.kind === 'submit' ? 'The hiring manager will be able to review this requirement.' : 'This will mark the requirement as approved.'}</ThemedText>
              )}
              <View style={styles.modalActions}>
                <ActionButton label="Cancel" onPress={() => setDialog(null)} theme={theme} disabled={working} />
                <ActionButton
                  label={working ? 'Saving…' : dialog.kind === 'submit' ? 'Submit' : dialog.kind === 'approve' ? 'Approve' : 'Reject'}
                  onPress={() => void performDialogAction()}
                  theme={theme}
                  disabled={working}
                  primary={dialog.kind !== 'reject'}
                  danger={dialog.kind === 'reject'}
                />
              </View>
            </View>
          </View>
        ) : null}
      </Modal>
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

function ActionButton({
  label,
  onPress,
  theme,
  disabled,
  primary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  disabled: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: primary ? theme.primary : danger ? theme.dangerBackground : theme.backgroundElement,
          borderColor: primary ? theme.primary : danger ? theme.danger : theme.border,
          opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
        },
      ]}>
      <ThemedText style={{ color: primary ? theme.primaryText : danger ? theme.danger : theme.text, fontWeight: '700' }}>{label}</ThemedText>
    </Pressable>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  theme,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  theme: ReturnType<typeof useTheme>;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.editField}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.editInput, multiline && styles.reasonInput, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
      />
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
  reviewDetails: {
    borderTopWidth: 1,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  rejectionReason: {
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  feedbackBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: 10,
    padding: Spacing.three,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.three,
    backgroundColor: 'rgba(15, 18, 32, 0.48)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.four,
    gap: Spacing.three,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  editModalCard: {
    maxWidth: 720,
    maxHeight: '92%',
  },
  editFields: {
    flexShrink: 1,
  },
  modalRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  modalColumn: {
    flexDirection: 'column',
  },
  editField: {
    flex: 1,
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  editInput: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  editPickerWrap: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editPicker: {
    width: '100%',
    height: 44,
    paddingHorizontal: Spacing.three,
  },
  reasonInput: {
    minHeight: 112,
    paddingVertical: Spacing.two,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
