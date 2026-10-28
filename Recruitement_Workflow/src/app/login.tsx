import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { isAxiosError } from 'axios';

import { useTheme } from '@/hooks/use-theme';
import { loginUser } from '@/services/auth.service';
import { saveToken } from '@/services/token.service';

export default function LoginScreen() {
  const theme = useTheme();
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();

  const colors = {
    background: theme.background,
    card: theme.backgroundElement,
    text: theme.text,
    secondaryText: theme.textSecondary,
    border: theme.border,
    input: theme.backgroundElement,
    primary: theme.primary,
    primaryText: theme.primaryText,
  };

  async function handleLogin() {
    if (!organizationSlug.trim() || !email.trim() || !password) {
      Alert.alert(
        'Validation',
        'Please enter your organization, email, and password.',
      );
      return;
    }

    try {
      setLoading(true);

      const result = await loginUser({
        organization_slug: organizationSlug.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
      });

      await saveToken(result.token);

      Alert.alert('Success', `Welcome ${result.user.first_name}!`);
      router.replace('/');
    } catch (error) {
      let message = 'Unable to log in. Please try again.';

      if (isAxiosError(error)) {
        message =
          error.response?.data?.message ??
          'Cannot connect to the server. Check your API URL.';
      }

      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: width < 400 ? 16 : 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            width < 400 && styles.cardCompact,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
              <Text style={[styles.brandMarkText, { color: colors.primaryText }]}>R</Text>
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.text }]}>
                Recruitment
              </Text>
              <Text style={[styles.brandCaption, { color: colors.secondaryText }]}>
                WORKFLOW PLATFORM
              </Text>
            </View>
          </View>

          <View style={styles.intro}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
              YOUR TEAM’S WORKSPACE
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Welcome back
            </Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
              Sign in to manage your organization and recruitment workflow.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>
                Organization slug
              </Text>
              <TextInput
                accessibilityLabel="Organization slug"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={organizationSlug}
                onChangeText={setOrganizationSlug}
                placeholder="e.g. acme-talent"
                placeholderTextColor={colors.secondaryText}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>
                Work email
              </Text>
              <TextInput
                accessibilityLabel="Work email"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={colors.secondaryText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>
                Password
              </Text>
              <TextInput
                accessibilityLabel="Password"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={colors.secondaryText}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
                returnKeyType="go"
                onSubmitEditing={() => void handleLogin()}
              />
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              style={[
                styles.button,
                { backgroundColor: colors.primary },
                loading && styles.disabledButton,
              ]}
              onPress={() => void handleLogin()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryText }]}>
                  Sign in
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.footerDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.footer, { color: colors.secondaryText }]}>
            Secure access for your organization
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 470,
    padding: 30,
    borderRadius: 24,
    borderWidth: 1,
    elevation: 3,
  },
  cardCompact: {
    padding: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 34,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontSize: 23,
    fontWeight: '800',
  },
  brandName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  brandCaption: {
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 1,
    fontWeight: '700',
  },
  intro: {
    gap: 8,
    marginBottom: 26,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
  },
  form: {
    gap: 18,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 14,
  },
  button: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  disabledButton: {
    opacity: 0.65,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerDivider: {
    height: 1,
    marginTop: 24,
    marginBottom: 16,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
});
