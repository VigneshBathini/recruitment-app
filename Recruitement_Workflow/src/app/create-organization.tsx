import axios from 'axios';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createOrganizationSchema,
  type CreateOrganizationInput,
} from '@/schemas/organization';
import { createOrganization } from '@/services/organizations';

type FormField = keyof CreateOrganizationInput;
type FormValues = Record<FormField, string>;
type FormErrors = Partial<Record<FormField, string>>;

const initialValues: FormValues = {
  name: '',
  slug: '',
  email: '',
};

export default function HomeScreen() {
  const theme = useTheme();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string }>();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function updateField(field: FormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback(undefined);
  }

  async function handleSubmit() {
    if (submittingRef.current) {
      return;
    }

    const payload = {
      name: values.name,
      slug: values.slug,
      email: values.email.trim() || undefined,
    };
    const validation = createOrganizationSchema.safeParse(payload);

    if (!validation.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (
          (field === 'name' || field === 'slug' || field === 'email') &&
          !fieldErrors[field]
        ) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      setFeedback({ type: 'error', message: 'Please check the highlighted fields.' });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFeedback(undefined);

    try {
      const organization = await createOrganization(validation.data);
      setFeedback({
        type: 'success',
        message: `${organization.name} was created successfully.`,
      });
      setValues(initialValues);
      setErrors({});
    } catch (error) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ??
          'Could not reach the server. Check your connection and API URL, then try again.'
        : 'Something went wrong while creating the organization. Please try again.';
      setFeedback({ type: 'error', message });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.heading}>
            <View style={styles.eyebrow}>
              <View style={styles.eyebrowDot} />
              <ThemedText type="smallBold" style={styles.eyebrowText}>
                ORGANIZATION SETUP
              </ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.title}>
              Create your organization
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.description}>
              Set up your organization workspace. You can add your team and hiring
              requirements next.
            </ThemedText>
          </View>

          <ThemedView style={[styles.card, { borderColor: theme.backgroundSelected }]}>
            <View style={styles.cardHeading}>
              <ThemedText type="smallBold">Organization details</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Required fields are marked with an asterisk.
              </ThemedText>
            </View>
            <FormInput
              label="Organization name *"
              value={values.name}
              onChangeText={(value) => updateField('name', value)}
              error={errors.name}
              placeholder="e.g. Acme Inc."
              autoCapitalize="words"
              editable={!submitting}
            />
            <FormInput
              label="Unique slug"
              value={values.slug}
              onChangeText={(value) => updateField('slug', value)}
              error={errors.slug}
              placeholder="e.g. acme-inc"
              helperText="Used in your organization’s workspace URL."
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />
            <FormInput
              label="Email (optional)"
              value={values.email}
              onChangeText={(value) => updateField('email', value)}
              error={errors.email}
              placeholder="e.g. hiring@acme.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!submitting}
            />

            {feedback && (
              <View
                accessibilityRole="alert"
                style={[
                  styles.feedback,
                  {
                    backgroundColor:
                      feedback.type === 'success' ? '#E9F8EF' : '#FFF0F0',
                  },
                ]}>
                <ThemedText
                  style={{
                    color: feedback.type === 'success' ? '#176B37' : '#A32626',
                  }}>
                  {feedback.message}
                </ThemedText>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: submitting, busy: submitting }}
              disabled={submitting}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: theme.text },
                pressed && !submitting && styles.pressed,
                submitting && styles.disabledButton,
              ]}>
              {submitting ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <ThemedText style={{ color: theme.background, fontWeight: '700' }}>
                  Create organization
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
  helperText?: string;
  placeholder: string;
  autoCapitalize: 'none' | 'words';
  autoCorrect?: boolean;
  keyboardType?: 'default' | 'email-address';
  editable: boolean;
};

function FormInput({
  label,
  value,
  onChangeText,
  error,
  helperText,
  placeholder,
  autoCapitalize,
  autoCorrect,
  keyboardType = 'default',
  editable,
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
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        editable={editable}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? '#C62828' : theme.backgroundSelected,
            color: theme.text,
          },
        ]}
      />
      {!error && helperText && (
        <ThemedText type="small" themeColor="textSecondary">
          {helperText}
        </ThemedText>
      )}
      {error && (
        <ThemedText type="small" style={styles.fieldError}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: Spacing.five,
  },
  heading: {
    gap: Spacing.three,
  },
  eyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: '#E8F0FF',
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  eyebrowText: {
    color: '#1D4ED8',
  },
  title: {
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.7,
  },
  description: {
    maxWidth: 460,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.five,
    gap: Spacing.four,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 2,
  },
  cardHeading: {
    gap: Spacing.one,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  fieldError: {
    color: '#A32626',
  },
  feedback: {
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
    opacity: 0.65,
  },
});
