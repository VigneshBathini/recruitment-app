import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function JobPageHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  const theme = useTheme();
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to job descriptions" onPress={onBack} style={[styles.back, { borderColor: theme.border }]}><ThemedText style={{ color: theme.primary, fontWeight: '700' }}>‹  Jobs</ThemedText></Pressable>
    <ThemedText style={styles.title}>{title}</ThemedText><ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</ThemedText>
  </View>;
}

export function JobStatusBadge({ status }: { status: string }) {
  const theme = useTheme();
  const normalized = status.toUpperCase();
  const color = normalized === 'APPROVED' || normalized === 'PUBLISHED' ? theme.success : normalized === 'REJECTED' ? theme.danger : normalized === 'PENDING_APPROVAL' ? theme.primary : theme.textSecondary;
  const backgroundColor = normalized === 'APPROVED' || normalized === 'PUBLISHED' ? theme.successBackground : normalized === 'REJECTED' ? theme.dangerBackground : normalized === 'PENDING_APPROVAL' ? theme.primaryMuted : theme.backgroundSelected;
  return <View style={[styles.badge, { backgroundColor }]}><ThemedText style={{ color, fontSize: 11, fontWeight: '800' }}>{normalized.replace(/_/g, ' ')}</ThemedText></View>;
}

export function JobState({ loading, error, empty, onRetry }: { loading?: boolean; error?: string; empty?: string; onRetry?: () => void }) {
  const theme = useTheme();
  if (loading) return <View style={styles.state}><ActivityIndicator color={theme.primary} /><ThemedText style={{ color: theme.textSecondary }}>Loading job workspace…</ThemedText></View>;
  if (error) return <View style={[styles.state, styles.card, { borderColor: theme.border }]}><ThemedText style={{ color: theme.danger, textAlign: 'center' }}>{error}</ThemedText>{onRetry ? <JobButton label="Try again" onPress={onRetry} variant="secondary" /> : null}</View>;
  if (empty) return <View style={[styles.state, styles.card, { borderColor: theme.border }]}><ThemedText style={{ color: theme.textSecondary, textAlign: 'center' }}>{empty}</ThemedText></View>;
  return null;
}

export function JobButton({ label, onPress, variant = 'primary', disabled }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const theme = useTheme();
  const backgroundColor = variant === 'primary' ? theme.primary : variant === 'danger' ? theme.dangerBackground : theme.backgroundElement;
  const color = variant === 'primary' ? theme.primaryText : variant === 'danger' ? theme.danger : theme.primary;
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor, borderColor: variant === 'primary' ? theme.primary : theme.border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}><ThemedText style={{ color, fontWeight: '800' }}>{label}</ThemedText></Pressable>;
}

export const jobCardStyle = (backgroundColor: string, borderColor: string) => [styles.card, { backgroundColor, borderColor }];

const styles = StyleSheet.create({ header: { gap: 7 }, back: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderRadius: 10, marginBottom: 5 }, title: { fontSize: 27, lineHeight: 34, fontWeight: '800' }, subtitle: { fontSize: 14, lineHeight: 21 }, badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 30 }, state: { minHeight: 130, alignItems: 'center', justifyContent: 'center', gap: 13, padding: Spacing.four }, card: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: 12 }, button: { alignSelf: 'flex-start', minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderRadius: 11 } });
