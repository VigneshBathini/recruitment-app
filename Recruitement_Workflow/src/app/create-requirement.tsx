import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createRequirementSchema } from '@/schemas/requirement';
import { getCurrentOrganizationUser } from '@/services/auth.service';
import { getDepartments, type Department } from '@/services/departments';
import { createRequirement } from '@/services/requirement.service';

const employmentTypes = [
  'Full-time',
  'Part-time',
  'Contract',
  'Temporary',
  'Internship',
];

type FormField =
  | 'department_id'
  | 'title'
  | 'openings'
  | 'experience_min_years'
  | 'experience_max_years'
  | 'location'
  | 'employment_type'
  | 'description';
type FormErrors = Partial<Record<FormField, string>>;
type SelectOption = { label: string; value: string };

const initialValues = {
  department_id: '',
  title: '',
  openings: '',
  experience_min_years: '',
  experience_max_years: '',
  location: '',
  employment_type: '',
  description: '',
};

function isFormField(field: PropertyKey): field is FormField {
  return Object.prototype.hasOwnProperty.call(initialValues, field);
}

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return (
      error.response?.data?.message ??
      'Could not reach the server. Check your connection and try again.'
    );
  }

  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export default function CreateRequirementScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const organization = await getCurrentOrganizationUser();
      if (!organization.permissions.includes('requirement.manage')) {
        throw new Error('You do not have permission to create requirements.');
      }

      const data = await getDepartments(organization.id);
      setDepartments(data);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  function updateField(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError('');
  }

  async function handleSubmit() {
    if (submittingRef.current || departments.length === 0) {
      return;
    }

    setErrors({});
    setSubmitError('');
    const numericErrors: FormErrors = {};
    const parseNumber = (
      field: 'department_id' | 'openings' | 'experience_min_years' | 'experience_max_years',
      label: string,
    ): number | undefined => {
      const rawValue = values[field].trim();
      if (!rawValue) {
        numericErrors[field] = field === 'department_id'
          ? 'Select a department.'
          : `${label} is required.`;
        return undefined;
      }

      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        numericErrors[field] = `Enter a valid ${label.toLowerCase()}.`;
        return undefined;
      }
      return parsed;
    };

    const departmentId = parseNumber('department_id', 'Department');
    const openings = parseNumber('openings', 'Openings');
    const minimumExperience = parseNumber('experience_min_years', 'Minimum experience');
    const maximumExperience = parseNumber('experience_max_years', 'Maximum experience');

    if (Object.keys(numericErrors).length > 0) {
      setErrors(numericErrors);
      setSubmitError('Please review the highlighted fields.');
      return;
    }

    const validation = createRequirementSchema.safeParse({
      department_id: departmentId!,
      title: values.title,
      openings: openings!,
      experience_min_years: minimumExperience!,
      experience_max_years: maximumExperience!,
      location: values.location,
      employment_type: values.employment_type,
      description: values.description.trim() || null,
    });

    if (!validation.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && isFormField(field) && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      setSubmitError('Please review the highlighted fields.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await createRequirement(validation.data);
      router.replace('/requirements');
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const departmentOptions = departments.map((department) => ({
    label: department.name,
    value: String(department.id),
  }));
  const canSubmit = !loading && !loadError && departments.length > 0;

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.heading}>
            <View
              style={[
                styles.eyebrow,
                { backgroundColor: theme.primaryMuted },
              ]}>
              <View
                style={[
                  styles.eyebrowDot,
                  { backgroundColor: theme.primary },
                ]}
              />
              <ThemedText
                type="smallBold"
                style={{ color: theme.primary }}>
                REQUIREMENT MANAGEMENT
              </ThemedText>
            </View>
            <ThemedText type="title" style={styles.title}>
              Create a requirement
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Share the role details with your hiring team.
            </ThemedText>
          </View>

          <ThemedView style={[styles.card, { borderColor: theme.border }]}>
            <View style={styles.cardHeading}>
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Role details
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Fields marked with an asterisk are required.
              </ThemedText>
            </View>

            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.primary} />
                <ThemedText themeColor="textSecondary">
                  Loading departments…
                </ThemedText>
              </View>
            ) : loadError ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.feedback,
                  { backgroundColor: theme.dangerBackground },
                ]}>
                <ThemedText style={{ color: theme.danger, flex: 1 }}>
                  {loadError}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadDepartments()}
                  hitSlop={8}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.danger }}>
                    Retry
                  </ThemedText>
                </Pressable>
              </View>
            ) : departments.length === 0 ? (
              <View
                style={[
                  styles.feedback,
                  { backgroundColor: theme.primaryMuted },
                ]}>
                <ThemedText themeColor="textSecondary">
                  Add a department to your organization before creating a
                  requirement.
                </ThemedText>
              </View>
            ) : (
              <>
                <SelectField
                  label="Department *"
                  placeholder="Choose a department"
                  value={values.department_id}
                  options={departmentOptions}
                  error={errors.department_id}
                  disabled={submitting}
                  onChange={(value) => updateField('department_id', value)}
                />
                <FormInput
                  label="Job title *"
                  value={values.title}
                  onChangeText={(value) => updateField('title', value)}
                  error={errors.title}
                  placeholder="e.g. Senior Product Designer"
                  autoCapitalize="words"
                  editable={!submitting}
                />

                <View style={[styles.row, width < 600 && styles.rowStacked]}>
                  <FormInput
                    label="Openings *"
                    value={values.openings}
                    onChangeText={(value) => updateField('openings', value)}
                    error={errors.openings}
                    placeholder="e.g. 3"
                    keyboardType="number-pad"
                    editable={!submitting}
                  />
                  <FormInput
                    label="Location *"
                    value={values.location}
                    onChangeText={(value) => updateField('location', value)}
                    error={errors.location}
                    placeholder="e.g. Hyderabad"
                    autoCapitalize="words"
                    editable={!submitting}
                  />
                </View>

                <View style={[styles.row, width < 600 && styles.rowStacked]}>
                  <FormInput
                    label="Minimum experience (years) *"
                    value={values.experience_min_years}
                    onChangeText={(value) =>
                      updateField('experience_min_years', value)
                    }
                    error={errors.experience_min_years}
                    placeholder="e.g. 2"
                    keyboardType="decimal-pad"
                    editable={!submitting}
                  />
                  <FormInput
                    label="Maximum experience (years) *"
                    value={values.experience_max_years}
                    onChangeText={(value) =>
                      updateField('experience_max_years', value)
                    }
                    error={errors.experience_max_years}
                    placeholder="e.g. 5"
                    keyboardType="decimal-pad"
                    editable={!submitting}
                  />
                </View>

                <SelectField
                  label="Employment type *"
                  placeholder="Choose an employment type"
                  value={values.employment_type}
                  options={employmentTypes.map((type) => ({
                    label: type,
                    value: type,
                  }))}
                  error={errors.employment_type}
                  disabled={submitting}
                  onChange={(value) => updateField('employment_type', value)}
                />

                <FormInput
                  label="Description"
                  value={values.description}
                  onChangeText={(value) => updateField('description', value)}
                  error={errors.description}
                  placeholder="Describe the role, responsibilities, and ideal candidate."
                  autoCapitalize="sentences"
                  editable={!submitting}
                  multiline
                />
              </>
            )}

            {submitError ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.feedback,
                  { backgroundColor: theme.dangerBackground },
                ]}>
                <ThemedText style={{ color: theme.danger }}>
                  {submitError}
                </ThemedText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: !canSubmit || submitting,
                busy: submitting,
              }}
              disabled={!canSubmit || submitting}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: theme.primary },
                pressed && !submitting && styles.pressed,
                (!canSubmit || submitting) && styles.disabledButton,
              ]}>
              {submitting ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <ThemedText
                  style={{ color: theme.primaryText, fontWeight: '700' }}>
                  Create requirement
                </ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

type FormInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  placeholder: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  editable: boolean;
  multiline?: boolean;
};

function FormInput({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  autoCapitalize = 'none',
  keyboardType = 'default',
  editable,
  multiline,
}: FormInputProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        editable={editable}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
            color: theme.text,
          },
        ]}
      />
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function SelectField({
  label,
  placeholder,
  value,
  options,
  error,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {Platform.OS === 'web' ? (
        <View
          style={[
            styles.webPickerWrap,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: error ? theme.danger : theme.border,
              opacity: disabled ? 0.55 : 1,
            },
          ]}>
          <Picker
            accessibilityLabel={label}
            enabled={!disabled}
            selectedValue={value}
            onValueChange={(nextValue) => onChange(String(nextValue ?? ''))}
            style={[
              styles.webPicker,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}>
            <Picker.Item label={placeholder} value="" color={theme.textSecondary} />
            {options.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} color={theme.text} />
            ))}
          </Picker>
        </View>
      ) : <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((current) => !current)}
        style={[
          styles.selectTrigger,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}>
        <ThemedText
          themeColor={selected ? 'text' : 'textSecondary'}
          style={styles.selectText}>
          {selected?.label ?? placeholder}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{open ? '▲' : '▼'}</ThemedText>
      </Pressable>}
      {Platform.OS !== 'web' ? <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <View style={styles.dropdownBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close options"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            accessibilityLabel={`${label} options`}
            style={[
              styles.dropdownPanel,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <ThemedText type="smallBold" style={styles.dropdownTitle}>
              {label.replace(/\s\*$/, '')}
            </ThemedText>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={styles.options}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && { backgroundColor: theme.primaryMuted },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      style={{
                        color: isSelected ? theme.primary : theme.text,
                        fontWeight: isSelected ? '700' : '500',
                      }}>
                      {option.label}
                    </ThemedText>
                    {isSelected ? (
                      <ThemedText style={{ color: theme.primary }}>Selected</ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal> : null}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.five,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  heading: {
    gap: Spacing.two,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.four,
    gap: Spacing.four,
    elevation: 2,
  },
  cardHeading: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontSize: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  rowStacked: {
    flexDirection: 'column',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 124,
    paddingTop: Spacing.three,
  },
  selectTrigger: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
  },
  selectText: {
    flex: 1,
  },
  webPickerWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  webPicker: {
    width: '100%',
    height: 48,
    paddingHorizontal: Spacing.three,
    borderWidth: 0,
  },
  dropdownBackdrop: {
    flex: 1,
    padding: Spacing.three,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 18, 32, 0.48)',
  },
  dropdownPanel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '70%',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.two,
    elevation: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  dropdownTitle: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  options: {
    flexShrink: 1,
  },
  option: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 10,
    padding: Spacing.three,
  },
  submitButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
  disabledButton: {
    opacity: 0.55,
  },
});
