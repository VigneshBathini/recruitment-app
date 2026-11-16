import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { isAxiosError } from 'axios';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { loginCandidate, registerCandidate, updateCandidatePhone } from '@/services/candidate-auth.service';
import { saveCandidateToken } from '@/services/candidate-session.service';

type CandidateAuthFormProps = { mode: 'login' | 'register' };
type Field = 'organization_slug' | 'first_name' | 'last_name' | 'email' | 'password' | 'phone';

const labels: Record<Field, string> = {
  organization_slug: 'Organization slug',
  first_name: 'First name',
  last_name: 'Last name',
  email: 'Email',
  password: 'Password',
  phone: 'Phone',
};

export function CandidateAuthForm({ mode }: CandidateAuthFormProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isRegister = mode === 'register';
  const [values, setValues] = useState<Record<Field, string>>({
    organization_slug: '', first_name: '', last_name: '', email: '', password: '', phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  function updateField(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validateForm(): string | null {
    const organizationSlug = values.organization_slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) return 'Enter a valid organization slug.';
    if (isRegister && !values.first_name.trim()) return 'Enter your first name.';
    if (isRegister && !values.last_name.trim()) return 'Enter your last name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) return 'Enter a valid email address.';
    if (values.password.length < (isRegister ? 8 : 1) || values.password.length > 72) {
      return isRegister ? 'Password must be between 8 and 72 characters.' : 'Enter your password.';
    }
    if (isRegister && !values.phone.trim()) return 'Enter your phone number.';
    if (isRegister && values.phone.trim().length > 30) return 'Phone number must be 30 characters or fewer.';
    return null;
  }

  async function submit() {
    const validationMessage = validateForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }
    setErrorMessage('');
    setLoading(true);
    let phoneSaveFailed = false;
    try {
      const organization_slug = values.organization_slug.trim().toLowerCase();
      const email = values.email.trim().toLowerCase();
      if (isRegister) {
        const result = await registerCandidate({
          organization_slug,
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          email,
          password: values.password,
          phone: values.phone.trim(),
        });
        await saveCandidateToken(result.token, organization_slug);
        try {
          await updateCandidatePhone(values.phone.trim());
        } catch (phoneError) {
          console.warn('Candidate registered, but phone profile update failed:', phoneError);
          phoneSaveFailed = true;
        }
      } else {
        const result = await loginCandidate({ organization_slug, email, password: values.password });
        await saveCandidateToken(result.token, organization_slug);
      }
      if (phoneSaveFailed) {
        Alert.alert('Account created', 'Your phone number could not be saved. You can update it later from your profile.');
      }
      router.replace('/candidate-dashboard');
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ?? 'Could not connect to the server. Check your connection and try again.'
        : error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  const fields: Field[] = isRegister
    ? ['organization_slug', 'first_name', 'last_name', 'email', 'phone', 'password']
    : ['organization_slug', 'email', 'password'];

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: width < 400 ? 16 : 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.brandMark, { backgroundColor: theme.primary }]}><Text style={[styles.brandLetter, { color: theme.primaryText }]}>R</Text></View>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>CANDIDATE PORTAL</Text>
          <Text style={[styles.title, { color: theme.text }]}>{isRegister ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {isRegister ? 'Create an account to apply for opportunities at your organization.' : 'Sign in to continue to your candidate dashboard.'}
          </Text>

          <View style={styles.form}>
            {fields.map((field) => (
              <View key={field} style={styles.field}>
                <Text style={[styles.label, { color: theme.text }]}>{labels[field]}</Text>
                <TextInput
                  accessibilityLabel={labels[field]}
                  value={values[field]}
                  onChangeText={(value) => updateField(field, field === 'organization_slug' ? value.toLowerCase() : value)}
                  placeholder={field === 'organization_slug' ? 'e.g. acme-talent' : field === 'phone' ? '+1 555 0100' : labels[field]}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'}
                  secureTextEntry={field === 'password'}
                  textContentType={field === 'password' ? (isRegister ? 'newPassword' : 'password') : field === 'email' ? 'emailAddress' : 'none'}
                  returnKeyType={field === 'password' ? 'go' : 'next'}
                  onSubmitEditing={field === 'password' ? () => void submit() : undefined}
                />
              </View>
            ))}
          </View>

          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}

          <Pressable accessibilityRole="button" onPress={() => void submit()} disabled={loading} style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, (pressed || loading) && styles.buttonPressed]}>
            {loading ? <ActivityIndicator color={theme.primaryText} /> : <Text style={[styles.buttonText, { color: theme.primaryText }]}>{isRegister ? 'Create account' : 'Sign in'}</Text>}
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={[styles.switchText, { color: theme.textSecondary }]}>{isRegister ? 'Already have an account?' : 'New to this organization?'}</Text>
            <Pressable disabled={loading} onPress={() => router.replace(isRegister ? '/candidate-login' : '/candidate-register')}>
              <Text style={[styles.link, { color: theme.primary }]}>{isRegister ? 'Sign in' : 'Register'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  card: { width: '100%', maxWidth: 480, padding: 26, borderWidth: 1, borderRadius: 22, gap: 13 },
  brandMark: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandLetter: { fontSize: 22, fontWeight: '800' },
  eyebrow: { fontSize: 10, letterSpacing: 1.1, fontWeight: '800', marginTop: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 6 },
  form: { gap: 14 },
  field: { gap: 7 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 11, paddingHorizontal: 13, fontSize: 15 },
  error: { color: '#B42318', fontSize: 13, lineHeight: 19 },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginTop: 5 },
  buttonPressed: { opacity: 0.72 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, flexWrap: 'wrap', marginTop: 3 },
  switchText: { fontSize: 13 },
  link: { fontSize: 13, fontWeight: '700' },
});
